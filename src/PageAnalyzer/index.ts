import puppeteer from "puppeteer";
import logger from "../logger.js";
import lighthouse from "lighthouse";
import { Flags } from "lighthouse";

import { launch } from "chrome-launcher";
import { JobWorkerBrokenLinksType } from "../types.js";
  
const RETRY_COUNT = 2; // Количество повторных попыток
const RETRY_DELAY = 3000; // Начальная задержка в мс
const USER_AGENT =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1";

export interface SeoData {
    title: string | null;
    description: string | null;
    h1: string | null;
    linksCount: number;
    internalLinks: number;
    externalLinks: number;
}

export interface PageAnalysisResult {
    response: puppeteer.HTTPResponse | null;
    image: Buffer;
    seoData: SeoData;
    robotsTxt: string | null;
    brokenLinks: JobWorkerBrokenLinksType;
}

export default class PageAnalyzer {
    private readonly type;
    private readonly depth;

    constructor(type: number, depth: number) {
        this.type = type; // Тип задачи. Платная/бесплатная
        this.depth = depth; // Глубина задачи
    }

    async analyze(url: string) {
        return this.parsePage(url);
    }

    async parsePage(url: string): Promise<PageAnalysisResult> {
        const browser = await puppeteer.launch({
            headless: true,
        });

        logger.debug("Browser setup");
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setViewport({
            width: 720,
            height: 1280,
            isMobile: true,
        });

        logger.debug("Going to page");
        const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
        });


        logger.debug("Evaluate");

        const seoData = await page.evaluate(() => {
            const title = document.title || null;
            const description =
                document
                    .querySelector("meta[name='description']")
                    ?.getAttribute("content") || null;
            const h1 = document.querySelector("h1")?.innerText || null;

            const links = Array.from(document.querySelectorAll("a"))
                .map((a) => (a as HTMLAnchorElement).href)
                .filter(Boolean);

            return {
                title,
                description,
                h1,
                linksCount: links.length,
                internalLinks: links.filter((l) =>
                    l.includes(location.hostname),
                ).length,
                externalLinks: links.filter(
                    (l) => !l.includes(location.hostname),
                ).length,
            };
        });

        logger.debug("Robots.txt check");
        let robotsTxt: string | null = null;
        try {
            const robotsUrl = new URL("/robots.txt", url).toString();
            const res = await fetch(robotsUrl, {});
            if (res.ok) {
                robotsTxt = await res.text();
            }
        } catch {
            logger.warn("Robots.txt not accessible");
        }

        logger.debug("Screenshotting");
        const image = await page.screenshot({
            type: "jpeg",
            quality: 20,
            clip: {
                x: 0,
                y: 0,
                width: 640,
                height: 360,
            },
            omitBackground: true,
        });



        // ПОИСК БИТЫХ ССЫЛОК
        const brokenLinks: JobWorkerBrokenLinksType = []

        const links = await page.$$eval('a, area', anchors =>
            anchors.map(anchor => anchor.href)
        );

        const CONCURRENCY_LIMIT = 10; // Лимит одновременных запросов
        const CHUNK_DELAY = 1000; // Новая константа: задержка в 1 секунду между пачками

        const results = [];
        const linksToCheck = [...new Set(links)];
        logger.info(`Unique links found: ${linksToCheck.length}`);

        // Обрабатываем ссылки пачками
        for (let i = 0; i < linksToCheck.length; i += CONCURRENCY_LIMIT) {
            const chunk = linksToCheck.slice(i, i + CONCURRENCY_LIMIT);
            
            logger.info(`Checking chunk ${Math.floor(i / CONCURRENCY_LIMIT) + 1}...`);
        
            const promises = chunk.map(link => this.checkLinkBroken(link));
            const chunkResults = await Promise.all(promises);
            
            results.push(...chunkResults.filter(result => result !== null));
        
            // Делаем паузу перед следующей пачкой
            if (i + CONCURRENCY_LIMIT < linksToCheck.length) {
                await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
            }
        }
        logger.info("All links checked.");

        logger.debug("Closing browser");
        await browser.close();

        return {
            response,
            image: Buffer.from(image),
            seoData,
            robotsTxt,
            brokenLinks
        };
    }



    // async runLightHouse(url: string) {
    //     async function runLighthouse(url: string) {
    //         // Запускаем Chrome
    //         const chrome = await launch({ chromeFlags: ["--headless", "--no-sandbox"] });
          
    //         const options: Flags = {
    //           logLevel: "info",
    //           output: "json", // или "html", или массив ["json","html"]
    //           onlyCategories: ["performance", "seo", "best-practices"],
    //           port: chrome.port,
    //         };
          
    //         // Запускаем Lighthouse
    //         const runnerResult = await lighthouse(url, options);
          
    //         // runnerResult.report — это строка (HTML или JSON в зависимости от options.output)
    //         // runnerResult.lhr — готовый объект с результатами
    //         console.log("Performance score was", runnerResult?.lhr.categories.performance.score);
          
    //         await chrome.kill();
          
    //         return runnerResult;
    //       }
    // }


    async checkLinkBroken(url: string, retriesLeft = RETRY_COUNT): Promise<JobWorkerBrokenLinksType[number] | null> {

        // Пропускаем не-HTTP ссылки
        const nonHttpProtocolsRegex = /^(#|javascript:|mailto:|tel:|sms:|fax:|file:|data:|blob:)/;
        if (!url || nonHttpProtocolsRegex.test(url)) {
            return null;
        }

        let wasGetRequest = false; 

    
        try {
            // Сначала пытаемся сделать HEAD запрос
            let response = await fetch(url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(8000),
                headers: { 'User-Agent': USER_AGENT },
                redirect: 'follow' // fetch следует за редиректами по умолчанию
            });
    
            // Если HEAD заблокирован (403/405), пробуем GET
            if (response.status === 403 || response.status === 405) {
                logger.debug(`HEAD failed for ${url} with status ${response.status}. Retrying with GET.`);
                response = await fetch(url, {
                    method: 'GET',
                    signal: AbortSignal.timeout(10000),
                    headers: { 'User-Agent': USER_AGENT }
                });
                wasGetRequest = true;
            }
            
            // Проверяем статус ответа
            if (response.status >= 400 && response.status !== 418) {
                // Если это ошибка, которую стоит повторить (серверная или rate limit)
                if ((response.status === 429 || response.status >= 500) && retriesLeft > 0) {
                    logger.warn(`Retrying ${url} after status ${response.status}. Retries left: ${retriesLeft}`);
                    // Ждем и рекурсивно вызываем функцию
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    return this.checkLinkBroken(url, retriesLeft - 1);
                }
                // Если это битая ссылка
                return { url, status: response.status, error: null };
            }
    
            if (wasGetRequest) { // soft 404
                const body = await response.text();
                if (/<title>.*(404|not found|не найдена).*<\/title>/i.test(body)) {
                     logger.warn(`Soft 404 detected on ${url}`);
                     return { url, status: 200, error: 'Soft 404 Detected' };
                }
            }
            
            // Если все хорошо
            return null;
    
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown';
    
            // Если ошибка связана с сетью и есть попытки, пробуем снова
            if (retriesLeft > 0) {
                 logger.warn(`Retrying ${url} after network error: ${errorMessage}. Retries left: ${retriesLeft}`);
                 await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                 return this.checkLinkBroken(url, retriesLeft - 1);
            }
    
            // Если попытки кончились, считаем ссылку битой
            return { url, status: -1, error: errorMessage };
        }
    }
}
