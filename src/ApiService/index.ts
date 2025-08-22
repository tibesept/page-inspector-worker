import { _apiHttpClient } from "../HttpClient";
import { CreateJobDTO, postJobSchemaDTO, UpdateJobBody } from "../types";
import { z } from "zod";

// TODO: норм интерфейс для обращения к rabbit без постоянных коннектов
// TODO: норм ApiService
// TODO: ERROR HANDLER
// TODO: gracefully closing app, close rabbit connection

type HttpClient = typeof _apiHttpClient;

class ApiService {
    constructor(private readonly client: HttpClient) {}

    // JOBS
    public updateJobTask(
        id: number,
        body: UpdateJobBody,
    ): Promise<CreateJobDTO> {
        return this.client.get(`/jobs/ready`, postJobSchemaDTO);
    }

    public doJobExist(id: number): Promise<Boolean> {
        return this.client.get(`/jobs/check/${id}`, z.boolean());
    }
}

/**
 * Единственный экземпляр ApiService, который используется ботом
 * он создается с единственным экземпляром http клиента.
 */
export const apiService = new ApiService(_apiHttpClient);
