import "dotenv/config";

export interface IAppConfig {
    env: "dev" | "prod";
    worker_auth_token: string;
    rabbit_url: string;
    queue_name: string;
    api_url: string;
}

const getEnv = <T>(key: string, parser?: (value: string) => T): T => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Отсутствует в .env: ${key}`);
    }
    if (parser) {
        return parser(value);
    }
    return value as T;
};

export const config: IAppConfig = {
    env: getEnv("NODE_ENV"),
    worker_auth_token: getEnv("WORKER_AUTH_TOKEN"),
    rabbit_url: getEnv("RABBIT_URL"),
    queue_name: getEnv("RABBIT_QUEUE_NAME"),
    api_url: getEnv("API_URL"),
};
