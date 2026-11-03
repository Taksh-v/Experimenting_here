import { NextResponse } from "next/server";
import { AppError, publicError } from "@/server/errors";
import { parseResume } from "@/server/pipeline";

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
    return NextResponse.json(await parseResume(file));
  } catch (error) {
    const response = publicError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
