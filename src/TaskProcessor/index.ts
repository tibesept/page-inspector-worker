import { JobTask, JobWorkerResultDTO } from "../types";
import { apiService } from "../ApiService";
import logger from "../logger";
import PageAnalyzer from "../PageAnalyzer";

type TSerializedParsing = {
    success: boolean;
    result: string;
}

export default class TaskProcessor {

    private task: JobTask;
    private analyzer: PageAnalyzer;

    constructor(task: JobTask) {
        this.task = task;

        this.analyzer = new PageAnalyzer(this.task.type, this.task.depth)
    }

    async processTask() {
        const task = this.task;

        logger.info(task, `Processing task`);

        const doJobExist = await apiService.doJobExist(task.jobId);

        logger.info(doJobExist, "Do job exist?:");

        if (!doJobExist) {
            logger.fatal(task, "Job do not exist!");
            return;
        }

        const parsingResult = await this.analyzer.parsePage(task.url);
        const serializedParsing = this.serializeParsingOutput(parsingResult);
        this.updateJob(serializedParsing);
    }


    private serializeParsingOutput(parsing: any): TSerializedParsing {
        logger.debug("Preparing parsing result");

        let success = true;
        let result = "";

        if(!parsing?.image) {
            return {
                success,
                result
            }
        }

        try {
            result = JSON.stringify({
                screenshot: Buffer.from(parsing.image).toString("base64"),
                status: parsing.response?.status() || null,
                seo: {
                    ...parsing.seoData,
                    robotsTxtExists: parsing.robotsTxt !== null,
                },
            });
        } catch(e) {
            logger.error(e, "Error during serializing parsing result")
            success = false
        }

        return {
            success,
            result
        }
        
    }

    private async updateJob(data: TSerializedParsing) {
        logger.debug("Updating job");
        const task = this.task;

        const statusMap: Record<number, string> = {
            0: "failed", // status = false
            1: "ready"  // status = true
        }

        let status = statusMap[Number(data.success)]; // меппим результат сериализации в текущий статус
        let result = data.result;

        try {
            await apiService.updateJobTask(task.jobId, {
                status,
                result
            });

            logger.info("Job done.");
        } catch (error) {
            await apiService.updateJobTask(task.jobId, {
                status: "failed",
                result: "",
            });
            logger.fatal("Job failed!");
        }
    }
}
