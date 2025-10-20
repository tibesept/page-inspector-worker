import { z } from "zod";

// BODY VALIDATION
export const createJobBodySchema = z.object({
    userId: z.number(),
    url: z.string().url({ message: "Неверный формат URL" }),
    type: z.number(),
    depth: z.number().int().min(1), // Глубина должна быть хотя бы 1
});

export const updateJobBodySchema = z.object({
    status: z.string(),
    result: z.string(),
});

// DTO (API RESPONSES)

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
        userId: z.number(),
        type: z.number(),
        url: z.string(),
        depth: z.number(),
        result: z.string(),
        jobId: z.number(),
        status: z.string(),
    })
    .nullable();

// RABBIT

export const jobTaskSchema = z.object({
    jobId: z.number(),
    userId: z.number(),
    url: z.string(),
    status: z.string(),
    type: z.number(),
    depth: z.number()
});


// WORKER
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
export const jobWorkerResultSchema = z.object({
    screenshot: z.string(), // base64 строка
    status: z.number().nullable(), // HTTP-код или null
    seo: z.object({
        title: z.string().nullable(),
        description: z.string().nullable(),
        h1: z.string().nullable(),
        linksCount: z.number(),
        internalLinks: z.number(),
        externalLinks: z.number(),
        robotsTxtExists: z.boolean(),
    }),
    brokenLinks: z.array(z.object({
        url: z.string(),
        status: z.number(),
        error: z.string().nullable()
    })),
    lighthouse: lighthouseResultSchema.nullable(),
    techStack: z.array(z.string()).nullable()
});


export type JobWorkerResultDTO = z.infer<typeof jobWorkerResultSchema>;
export type JobWorkerBrokenLinksType = JobWorkerResultDTO['brokenLinks'];
export type JobWorkerLighthouseResult = z.infer<typeof lighthouseResultSchema>;

// TYPES
export type CreateJobBody = z.infer<typeof createJobBodySchema>;
export type UpdateJobBody = z.infer<typeof updateJobBodySchema>
export type JobsReadyDTO = z.infer<typeof jobsReadySchemaDTO>;
export type JobDTO = z.infer<typeof jobSchemaDTO>;
export type UserDTO = z.infer<typeof userSchemaDTO>;
export type CreateJobDTO = z.infer<typeof postJobSchemaDTO>;

export type JobTask = z.infer<typeof jobTaskSchema>;
