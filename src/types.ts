import { z } from "zod";

// helper
export const jobAnalyzerSettings = z.object({
    depth: z.number().min(1),
    links: z.boolean(),
    seo: z.boolean(),
    lighthouse: z.boolean(),
    techstack: z.boolean(),
});

// BODY VALIDATION
export const createJobBodySchema = z.object({
    userId: z.number(),
    url: z.string().url({ message: "Неверный формат URL" }),
    type: z.number(),
    settings: jobAnalyzerSettings,
});

export const updateJobBodySchema = z.object({
    status: z.string(),
    result: z.string(),
});

// ---- DTO (API RESPONSES) ----

export const userSchemaDTO = z.object({
    userId: z.number(),
    balance: z.number(),
});

export const postJobSchemaDTO = z.object({
    jobId: z.number(),
    userId: z.number(),
    status: z.string(),
});

export const jobsReadySchemaDTO = z.array(
    z.object({
        jobId: z.number(),
    }),
);

export const jobSchemaDTO = z
    .object({
        // get FULL job
        userId: z.number(),
        jobId: z.number(),
        type: z.number().nullable(),
        url: z.string().nullable(),
        result: z.string().nullable(),
        status: z.string().nullable(),
        settings: jobAnalyzerSettings,
    })
    .nullable();

//  ---- RABBIT ----

export const jobTaskSchema = z.object({
    jobId: z.number(),
    userId: z.number(),
    url: z.string(),
    status: z.string(),
    type: z.number(),
    settings: z.string(),
});

// ----- WORKER -----
export const lighthouseResultSchema = z.object({
    // Общие оценки (0-1)
    performance: z.number().nullable(),
    accessibility: z.number().nullable(),
    bestPractices: z.number().nullable(),
    seo: z.number().nullable(),

    // Core Web Vitals
    lcp: z.number().nullable(), // Largest Contentful Paint (ms)
    cls: z.number().nullable(), // Cumulative Layout Shift (score)
    tbt: z.number().nullable(), // Total Blocking Time (ms)
});
export const seoResultSchema = z.object({
        title: z.string().nullable(),
        description: z.string().nullable(),
        h1: z.string().nullable(),
        linksCount: z.number().nullable(),
        internalLinks: z.number().nullable(),
        externalLinks: z.number().nullable(),
        brokenLinks: z.array(
        z.object({
            url: z.string(),
            status: z.number(),
            error: z.string().nullable(),
        }),
    ).nullable()
}).nullable()
export const jobWorkerResultSchema = z.object({
    screenshot: z.string(), // base64 строка
    status: z.number().nullable(), // HTTP-код или null
    robotsTxtExists: z.boolean().nullable(),
    seo: seoResultSchema,
    lighthouse: lighthouseResultSchema.nullable(),
    techStack: z.array(z.string()).nullable(),
});

export type JobWorkerResultDTO = z.infer<typeof jobWorkerResultSchema>;
export type JobWorkerLighthouseResult = z.infer<typeof lighthouseResultSchema>;
export type JobWorkerSeoResult = z.infer<typeof seoResultSchema>;

// TYPES
export type CreateJobBody = z.infer<typeof createJobBodySchema>;
export type UpdateJobBody = z.infer<typeof updateJobBodySchema>;
export type JobsReadyDTO = z.infer<typeof jobsReadySchemaDTO>;
export type JobDTO = z.infer<typeof jobSchemaDTO>;
export type UserDTO = z.infer<typeof userSchemaDTO>;
export type CreateJobDTO = z.infer<typeof postJobSchemaDTO>;

export type JobTask = z.infer<typeof jobTaskSchema>;
export type JobAnalyzerSettingsDB = z.infer<typeof jobAnalyzerSettings>;
