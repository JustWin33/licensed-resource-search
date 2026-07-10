import { envSchema, type AppEnv } from './index';

let cached: AppEnv | undefined;

export function getServerEnv(): AppEnv {
  cached ??= envSchema.parse(process.env);
  return cached;
}
