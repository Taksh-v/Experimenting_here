export type ErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "INVALID_FILE"
  | "UNREADABLE_FILE"
  | "NOT_A_RESUME"
  | "PROVIDER_ERROR"
  | "INVALID_REQUEST";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function publicError(error: unknown) {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: { error: "The submitted resume data is invalid.", code: "INVALID_REQUEST" satisfies ErrorCode }
    };
  }

  console.error("Unexpected resume processing error", error);
  return {
    status: 500,
    body: {
      error: "The resume could not be processed. Please try again.",
      code: "PROVIDER_ERROR" satisfies ErrorCode
    }
  };
}
import { ZodError } from "zod";

