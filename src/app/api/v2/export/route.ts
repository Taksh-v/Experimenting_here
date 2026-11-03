import { NextResponse } from "next/server";
import { sessionV2Schema } from "@/domain/v2";
import { sessionToLegacyResume } from "@/domain/v2-adapter";
import { publicError } from "@/server/errors";
import { resumeToDocxBytes } from "@/server/docx-export";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = sessionV2Schema.parse(await request.json());
    const resume = sessionToLegacyResume(session);
    const bytes = await resumeToDocxBytes(resume);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="evolving-resume.docx"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const response = publicError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
