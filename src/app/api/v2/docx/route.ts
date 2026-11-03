import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, publicError } from "@/server/errors";
import { extractLocalText, validateUpload } from "@/server/file-extraction";
import { textToSegments } from "@/server/segments";
import { guardProviderRequest } from "@/server/beta-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const sessionId = z.string().uuid().parse(form.get("sessionId"));
    const turnstileToken = String(form.get("turnstileToken") ?? "");
    if (!(file instanceof File)) throw new AppError("INVALID_REQUEST", "Choose a DOCX resume.");
    if (file.size > 4 * 1024 * 1024) {
      throw new AppError("FILE_TOO_LARGE", "The first release accepts files up to 4 MB.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (validateUpload(file, bytes) !== "docx") {
      throw new AppError("UNSUPPORTED_FILE", "Upload a valid DOCX file.");
    }
    await guardProviderRequest(request, {
      sessionId,
      action: "resume_start",
      turnstileToken
    });
    const text = await extractLocalText("docx", bytes);
    return NextResponse.json({ segments: textToSegments(text, "local") });
  } catch (error) {
    const response = publicError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
