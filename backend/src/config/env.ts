import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_PREFIX: z.string().default('/api'),

  CORS_ORIGIN: z.string().refine(
    (val) => val === '*' || z.string().url().safeParse(val).success,
    { message: 'CORS_ORIGIN must be a valid URL or "*" for all origins' }
  ).default('*'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // ── Agnes AI ──
  AGNES_API_KEY: z.string().default(''),
  AGNES_BASE_URL: z.string().default('https://apihub.agnes-ai.com/v1'),
  AGNES_MODEL: z.string().default('agnes-2.5-flash'),

  // ── Daily digest ──
  CONTENT_DIR: z.string().default(''),
  DIGEST_TIMEZONE: z.string().default('Asia/Shanghai'),
  ADMIN_TOKEN: z.string().default(''),
  BACKFILL_DAYS: z.string().transform(Number).default('3'),

  // ── Article briefings ──
  // How many stories get their source article read and distilled per issue.
  BRIEFING_LIMIT: z.string().transform(Number).default('12'),
  // Characters of article text kept per story before it is handed to the model.
  BRIEFING_MAX_CHARS: z.string().transform(Number).default('4000'),
  BRIEFING_TIMEOUT_MS: z.string().transform(Number).default('12000'),
  // How many article pages are fetched at the same time.
  BRIEFING_CONCURRENCY: z.string().transform(Number).default('4'),
})

const parseEnv = () => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:', error)
    process.exit(1)
  }
}

export const env = parseEnv()
