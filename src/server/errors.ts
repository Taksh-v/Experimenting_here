import { ZodError } from "zod";

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
    const paths = [
      ...new Set(
        error.issues
          .map((issue) => issue.path.join("."))
          .filter(Boolean)
      )
    ].slice(0, 5);
    return {
      status: 400,
      body: {
        error:
          "The submitted resume data is invalid" +
          (paths.length ? " at " + paths.join(", ") : "") +
          ".",
        code: "INVALID_REQUEST" satisfies ErrorCode
      }
    };
  }

  if (error instanceof SyntaxError) {
    return {
      status: 400,
      body: {
        error: "The request body is not valid JSON.",
        code: "INVALID_REQUEST" satisfies ErrorCode
      }
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

