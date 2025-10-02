import puppeteer from "puppeteer";
import logger from "../logger.js";
import lighthouse from "lighthouse";
import { Flags } from "lighthouse";

import { launch } from "chrome-launcher";
import { JobWorkerBrokenLinksType } from "../types.js";
  
const userAgent =
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
        await page.setUserAgent(userAgent);
        await page.setViewport({
            width: 720,
            height: 1280,
            isMobile: true,
        });

        logger.debug("Going to page");
        const response = await page.goto(url, {
            waitUntil: "networkidle0", // дожидаемся завершения сетевой активности
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

        logger.debug("Closing browser");


        // ПОИСК БИТЫХ ССЫЛОК
        const brokenLinks: JobWorkerBrokenLinksType = []

        const links = await page.$$eval('a', anchors =>
            anchors.map(anchor => anchor.href)
        );
        const uniqueLinks = [...new Set(links)];
        logger.info(uniqueLinks.length, "Unique links found:");

        const checkPromises = uniqueLinks.map(async (link) => {
            if (!link || link.startsWith('mailto:') || link.startsWith('tel:')) {
                return; // Пропускаем не-HTTP ссылки
            }
            try {
                const response = await fetch(link, { method: 'HEAD', signal: AbortSignal.timeout(5000) }); // таймаут
                if (response.status >= 400) { 
                    logger.debug({ link, status: response.status }, "bad link found");
                    brokenLinks.push({ url: link, status: response.status, error: null });
                }
            } catch (error) {
                let errorMessage = 'unknown';

                if (error instanceof Error) {
                    errorMessage = error.message;
                }
                logger.error({ error, link }, "link check error")
                brokenLinks.push({ url: link, status: -1, error: errorMessage });
            }
        });

        await Promise.all(checkPromises);


        await browser.close();

        return {
            response,
            image: Buffer.from(image),
            seoData,
            robotsTxt,
            brokenLinks
        };
    }



    async runLightHouse(url: string) {
        async function runLighthouse(url: string) {
            // Запускаем Chrome
            const chrome = await launch({ chromeFlags: ["--headless", "--no-sandbox"] });
          
            const options: Flags = {
              logLevel: "info",
              output: "json", // или "html", или массив ["json","html"]
              onlyCategories: ["performance", "seo", "best-practices"],
              port: chrome.port,
            };
          
            // Запускаем Lighthouse
            const runnerResult = await lighthouse(url, options);
          
            // runnerResult.report — это строка (HTML или JSON в зависимости от options.output)
            // runnerResult.lhr — готовый объект с результатами
            console.log("Performance score was", runnerResult?.lhr.categories.performance.score);
          
            await chrome.kill();
          
            return runnerResult;
          }
    }
}
