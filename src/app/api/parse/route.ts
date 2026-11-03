import { NextResponse } from "next/server";
import { AppError, publicError } from "@/server/errors";
import { parseResume } from "@/server/pipeline";
import { qualityReport } from "@/server/quality";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 9 * 1024 * 1024) {
      throw new AppError("FILE_TOO_LARGE", "The file is larger than 8 MB.");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("INVALID_REQUEST", "Choose a resume to upload.");
    }
    const parsed = await parseResume(file);
    return NextResponse.json({
      ...parsed,
      quality: qualityReport(parsed.resume, parsed.fidelity, parsed.engine)
    });
  } catch (error) {
    const response = publicError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
