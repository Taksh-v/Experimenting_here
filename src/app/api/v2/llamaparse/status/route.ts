import { NextResponse } from "next/server";
import { AppError, publicError } from "@/server/errors";
import { readLlamaParseJob } from "@/server/llamaparse-job";
import { textToSegments } from "@/server/segments";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    if (!token) throw new AppError("INVALID_REQUEST", "The extraction token is missing.");
    const result = await readLlamaParseJob(token);
    if (result.status === "pending") {
      return NextResponse.json({ status: "pending" });
    }
    return NextResponse.json({
      status: "complete",
      documentHash: result.capability.documentHash,
      sessionId: result.capability.sessionId,
      segments: textToSegments(result.text, "llamaparse")
    });
  } catch (error) {
    const response = publicError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
