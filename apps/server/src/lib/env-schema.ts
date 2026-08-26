import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  SEARCH_API_KEY: z.string().min(1),
  SEARCH_MODEL: z.string().min(1),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().min(1),
  SCHEDULER_SECRET: z.string().min(24),
  MAX_SOURCE_CONTENT_BYTES: z.coerce.number().int().positive().default(500_000),
  CORS_ORIGINS: z.string().default(""),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const result = serverEnvSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }

  return result.data;
}
