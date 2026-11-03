import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";
import { providerErrorMessage } from "./provider-error";

const BASE_URL = "https://api.cloud.llamaindex.ai/api/parsing";

type Json = Record<string, unknown>;
type Capability = {
  jobId: string;
  sessionId: string;
  documentHash: string;
  exp: number;
};

function apiKey() {
  const key =
    process.env.LLAMA_CLOUD_API_KEY?.trim() ||
    process.env.LLAMAPARSE_API_KEY?.trim();
  if (!key) {
    throw new AppError("PROVIDER_ERROR", "LlamaParse is not configured.", 503);
  }
  return key;
}

function tokenSecret() {
  const secret = process.env.JOB_TOKEN_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new AppError(
      "PROVIDER_ERROR",
      "JOB_TOKEN_SECRET must contain at least 32 characters.",
      503
    );
  }
  return secret;
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(BASE_URL + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + apiKey(),
      ...init.headers
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000)
  });
  const raw = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new AppError(
      "PROVIDER_ERROR",
      "LlamaParse HTTP " + response.status + ": " + providerErrorMessage(body),
      502
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("PROVIDER_ERROR", "LlamaParse returned an invalid response.", 502);
  }
  return body as Json;
}

function sign(encoded: string) {
  return createHmac("sha256", tokenSecret()).update(encoded).digest("base64url");
}

export function createJobToken(capability: Capability) {
  const encoded = Buffer.from(JSON.stringify(capability)).toString("base64url");
  return encoded + "." + sign(encoded);
}

export function verifyJobToken(token: string): Capability {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) {
    throw new AppError("INVALID_REQUEST", "The extraction token is invalid.", 401);
  }
  const expected = sign(encoded);
  const valid =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) {
    throw new AppError("INVALID_REQUEST", "The extraction token is invalid.", 401);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new AppError("INVALID_REQUEST", "The extraction token is invalid.", 401);
  }
  const record = value as Partial<Capability>;
  if (
    typeof record.jobId !== "string" ||
    typeof record.sessionId !== "string" ||
    typeof record.documentHash !== "string" ||
    typeof record.exp !== "number" ||
    record.exp < Date.now()
  ) {
    throw new AppError("INVALID_REQUEST", "The extraction token has expired.", 401);
  }
  return record as Capability;
}

export async function startLlamaParseJob(
  bytes: Uint8Array,
  filename: string,
  sessionId: string,
  documentHash: string
) {
  const form = new FormData();
  form.append("file", new Blob([bytes.slice().buffer], { type: "application/pdf" }), filename);
  form.append("language", "en");
  form.append("disable_ocr", "false");
  form.append("high_res_ocr", "true");
  form.append("layout_aware", "true");
  form.append("do_not_cache", "true");
  const upload = await request("/upload", { method: "POST", body: form });
  if (typeof upload.id !== "string" || !upload.id) {
    throw new AppError("PROVIDER_ERROR", "LlamaParse did not return a job ID.", 502);
  }
  return createJobToken({
    jobId: upload.id,
    sessionId,
    documentHash,
    exp: Date.now() + 15 * 60_000
  });
}

export async function readLlamaParseJob(token: string) {
  const capability = verifyJobToken(token);
  const path = "/job/" + encodeURIComponent(capability.jobId);
  const job = await request(path);
  const status = String(job.status ?? "");
  if (["PENDING", "QUEUED", "PROCESSING"].includes(status)) {
    return { status: "pending" as const, capability };
  }
  if (status !== "SUCCESS") {
    throw new AppError(
      "PROVIDER_ERROR",
      "LlamaParse job failed: " + providerErrorMessage(job),
      502
    );
  }
  for (const format of ["markdown", "text"] as const) {
    const result = await request(path + "/result/" + format);
    const text = typeof result[format] === "string" ? result[format].trim() : "";
    if (text.length >= 40) {
      return { status: "complete" as const, text, format, capability };
    }
  }
  throw new AppError(
    "UNREADABLE_FILE",
    "LlamaParse completed but extracted too little readable text.",
    422
  );
}
