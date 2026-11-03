import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, publicError } from "@/server/errors";
import { validateUpload, extractLocalText } from "@/server/file-extraction";
import { guardProviderRequest } from "@/server/beta-guard";
import { startLlamaParseJob } from "@/server/llamaparse-job";
import { textToSegments } from "@/server/segments";

export const runtime = "nodejs";
export const maxDuration = 30;

const sessionIdSchema = z.string().uuid();
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const sessionId = sessionIdSchema.parse(form.get("sessionId"));
    const turnstileToken = String(form.get("turnstileToken") ?? "");
    if (!(file instanceof File)) {
      throw new AppError("INVALID_REQUEST", "Choose a PDF resume.");
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("FILE_TOO_LARGE", "The first release accepts files up to 4 MB.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = validateUpload(file, bytes);
    if (kind !== "pdf") {
      throw new AppError("UNSUPPORTED_FILE", "This endpoint accepts PDF files only.");
    }
    let pageCount = 0;
    try {
      const { getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes.slice());
      pageCount = pdf.numPages;
      await pdf.cleanup();
    } catch {
      throw new AppError(
        "INVALID_FILE",
        "The PDF is password-protected, damaged, or unreadable."
      );
    }
    if (pageCount > 4) {
      throw new AppError("INVALID_FILE", "The first release accepts PDFs up to 4 pages.");
    }
    await guardProviderRequest(request, {
      sessionId,
      action: "resume_start",
      turnstileToken
    });
    const documentHash = createHash("sha256").update(bytes).digest("hex");
    const local = await extractLocalText("pdf", bytes).catch(() => "");
    let token = "";
    let warning = "";
    try {
      token = await startLlamaParseJob(bytes, file.name, sessionId, documentHash);
    } catch (error) {
      if (local.length < 800) throw error;
      const failure = publicError(error);
      warning =
        "LlamaParse was unavailable. Continuing with the complete embedded PDF text. " +
        failure.body.error;
    }
    return NextResponse.json({
      token,
      fallback: !token,
      warning,
      documentHash,
      pageCount,
      localSegments: local ? textToSegments(local, "local") : [],
      localQuality: {
        characters: local.length,
        usable: local.length >= 800
      }
    });
  } catch (error) {
    const response = publicError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
