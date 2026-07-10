import { z } from 'zod';

export const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).max(120),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MEILI_HOST: z.string().url(),
  MEILI_MASTER_KEY: z.string().min(16),
  SESSION_SECRET: z.string().min(32),
  URL_HASH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  EVIDENCE_STORAGE_DRIVER: z.enum(['local_private', 's3_private']).default('local_private'),
  LOCAL_EVIDENCE_ROOT: z
    .string()
    .min(1)
    .refine(
      (value) => !/^[/\\]|^[A-Za-z]:/.test(value) && !value.split(/[\\/]/).includes('..'),
      'LOCAL_EVIDENCE_ROOT must be a relative path without parent traversal',
    )
    .default('./evidence-storage'),
  S3_ENDPOINT: z.string().url().optional().or(z.literal('')),
  S3_REGION: z.string().optional().or(z.literal('')),
  S3_BUCKET: z.string().optional().or(z.literal('')),
  S3_ACCESS_KEY_ID: z.string().optional().or(z.literal('')),
  S3_SECRET_ACCESS_KEY: z.string().optional().or(z.literal('')),
  REGION_STATS_ENABLED: z.coerce.boolean().default(false),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppEnv = z.infer<typeof envSchema>;
