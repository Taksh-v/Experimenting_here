import { afterEach, expect, it, vi } from "vitest";
import { extractWithLlamaParse } from "./llamaparse";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const text = "Taksh Vadaliya Professional Experience Education Projects Skills";
function setup(bodies: unknown[]) {
  vi.stubEnv("LLAMA_CLOUD_API_KEY", "test-key");
  const fetcher = vi.fn();
  for (const body of bodies) fetcher.mockResolvedValueOnce(Response.json(body));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

it("uploads the PDF with native multipart then fetches the completed job", async () => {
  const fetcher = setup([{ id: "job-1" }, { status: "SUCCESS" }, { markdown: text }]);
  await expect(extractWithLlamaParse(new Uint8Array([37, 80, 68, 70]), "resume.pdf")).resolves.toBe(text);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toMatch(/\/upload$/);
  expect(options.headers).toEqual({ Authorization: "Bearer test-key" });
  const file = options.body.get("file") as File;
  expect(file.name).toBe("resume.pdf");
  expect(file.type).toBe("application/pdf");
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]));
  expect(options.body.get("disable_ocr")).toBe("false");
  expect(fetcher.mock.calls[2][0]).toContain("/job/job-1/result/markdown");
});

it("reads alternate output from the same job without another upload", async () => {
  const fetcher = setup([{ id: "job-2" }, { status: "SUCCESS" }, { markdown: "" }, { text }]);
  await expect(extractWithLlamaParse(new Uint8Array([1]), "resume.pdf")).resolves.toBe(text);
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/upload"))).toHaveLength(1);
  expect(fetcher.mock.calls[3][0]).toContain("/job/job-2/result/text");
});

it("preserves structured API rejections", async () => {
  setup([]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "Invalid API key" }, { status: 401 })));
  await expect(extractWithLlamaParse(new Uint8Array([1]), "resume.pdf")).rejects.toThrow("LlamaParse HTTP 401: Invalid API key");
});

it("rejects failed jobs and empty output", async () => {
  setup([{ id: "j" }, { status: "ERROR", detail: "Document rejected" }]);
  await expect(extractWithLlamaParse(new Uint8Array([1]), "resume.pdf")).rejects.toThrow("Document rejected");
  setup([{ id: "j" }, { status: "SUCCESS" }, { markdown: "" }, { text: "" }]);
  await expect(extractWithLlamaParse(new Uint8Array([1]), "resume.pdf")).rejects.toThrow("too little readable text");
});

it("fails clearly when LlamaParse is not configured", async () => {
  vi.stubEnv("LLAMA_CLOUD_API_KEY", "");
  vi.stubEnv("LLAMAPARSE_API_KEY", "");
  await expect(extractWithLlamaParse(new Uint8Array([1]), "resume.pdf")).rejects.toThrow("not configured");
});
