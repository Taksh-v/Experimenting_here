import { NextRequest } from "next/server";
import { resumeSchema } from "@/domain/resume";
import { publicError } from "@/server/errors";
import { resumeToDocxBytes } from "@/server/docx-export";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const value = body as Record<string, unknown>;
    const resume = resumeSchema.parse(value.resume);
    const bytes = await resumeToDocxBytes(resume);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const name = (resume.contact.name || "resume")
      .trim()
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "resume";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${name}-ats.docx"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const response = publicError(error);
    return Response.json(response.body, { status: response.status });
  }
}

