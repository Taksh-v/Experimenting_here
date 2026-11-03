import { AppError } from "./errors";
import { providerErrorMessage } from "./provider-error";

const BASE_URL = "https://api.cloud.llamaindex.ai/api/v2/parse";

type Json = Record<string, unknown>;

export async function extractWithLlamaParse(bytes: Uint8Array, filename: string): Promise<string> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY?.trim() || process.env.LLAMAPARSE_API_KEY?.trim();
  if (!apiKey) throw new AppError("PROVIDER_ERROR", "LlamaParse is not configured. Set LLAMA_CLOUD_API_KEY on the server.", 503);
  const signal = AbortSignal.timeout(110_000);
  async function request(path: string, init: RequestInit = {}): Promise<Json> {
    const response = await fetch(BASE_URL + path, {
      ...init, headers: { Authorization: "Bearer " + apiKey }, signal, cache: "no-store"
    });
    const raw = await response.text();
    let body: unknown;
    try { body = JSON.parse(raw); } catch { body = null; }
    if (!response.ok) throw new AppError("PROVIDER_ERROR", "LlamaParse HTTP " + response.status + ": " + providerErrorMessage(body), 502);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError("PROVIDER_ERROR", "LlamaParse returned an invalid response.", 502);
    return body as Json;
  }
  try {
    const form = new FormData();
    form.append("file", new Blob([bytes.slice().buffer], {
      type: filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }), filename);
    form.append("configuration", JSON.stringify({
      tier: "cost_effective",
      version: "latest"
    }));
    const upload = await request("/upload", { method: "POST", body: form });
    const uploadJob = upload.job && typeof upload.job === "object" && !Array.isArray(upload.job)
      ? upload.job as Json
      : upload;
    const jobId = typeof uploadJob.id === "string" ? uploadJob.id : "";
    if (!jobId) throw new AppError("PROVIDER_ERROR", "LlamaParse did not return a parsing job ID.", 502);
    const path = "/" + encodeURIComponent(jobId);
    for (;;) {
      const job = await request(path + "?expand=markdown_full,text_full");
      const status = job.job && typeof job.job === "object" && !Array.isArray(job.job)
        ? (job.job as Json).status
        : job.status;
      if (status === "COMPLETED") {
        for (const format of ["markdown_full", "text_full", "markdown", "text"]) {
          const text = typeof job[format] === "string" ? job[format].trim() : "";
          if (text.length >= 40) return text;
        }
        throw new AppError("UNREADABLE_FILE", "LlamaParse completed but extracted too little readable text. Review the document in Llama Cloud.", 422);
      }
      if (!["PENDING", "RUNNING", "QUEUED", "PROCESSING"].includes(String(status))) {
        throw new AppError("PROVIDER_ERROR", "LlamaParse job failed: " + providerErrorMessage(job), 502);
      }
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 1000);
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      });
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal.aborted) throw new AppError("PROVIDER_ERROR", "LlamaParse exceeded the extraction time limit. Please retry.", 504);
    throw new AppError("PROVIDER_ERROR", "LlamaParse connection failed: " + providerErrorMessage(error), 502);
  }
}
