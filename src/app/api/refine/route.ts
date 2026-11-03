import { NextResponse } from "next/server";
import { answersSchema, resumeSchema } from "@/domain/resume";
import { AppError, publicError } from "@/server/errors";
import { refineWithGroq } from "@/server/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      throw new AppError("INVALID_REQUEST", "The request is invalid.");
    }
    const value = body as Record<string, unknown>;
    const resume = resumeSchema.parse(value.resume);
    const answers = answersSchema.parse(value.answers);
    const refined = await refineWithGroq(resume, answers);
    return NextResponse.json({ resume: refined });
  } catch (error) {
    const response = publicError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
