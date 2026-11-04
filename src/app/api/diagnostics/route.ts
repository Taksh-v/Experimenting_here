import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    llamaConfigured: Boolean(
      process.env.LLAMA_CLOUD_API_KEY?.trim() ||
        process.env.LLAMAPARSE_API_KEY?.trim()
    ),
    groqConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
    groqModel: process.env.GROQ_MODEL?.trim() || null,
    jobTokensConfigured: Boolean(
      process.env.JOB_TOKEN_SECRET?.trim() &&
        process.env.JOB_TOKEN_SECRET.trim().length >= 32
    ),
    turnstileConfigured: Boolean(
      process.env.TURNSTILE_SECRET_KEY?.trim() &&
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
    ),
    rateLimitConfigured: Boolean(
      (process.env.UPSTASH_REDIS_REST_URL?.trim() ||
        process.env.KV_REST_API_URL?.trim()) &&
        (process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
          process.env.KV_REST_API_TOKEN?.trim()) &&
        process.env.RATE_LIMIT_SALT?.trim()
    ),
    rateLimitEnabled:
      process.env.RATE_LIMIT_ENABLED?.trim().toLowerCase() === "true",
    runtime: process.version
  });
}
