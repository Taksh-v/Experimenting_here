import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    llamaConfigured: Boolean(
      process.env.LLAMA_CLOUD_API_KEY?.trim() ||
        process.env.LLAMAPARSE_API_KEY?.trim()
    ),
    groqConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
    runtime: process.version
  });
}
