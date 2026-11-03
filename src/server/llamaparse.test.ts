import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn(), options: vi.fn() }));
vi.mock("llama-cloud-services/reader", () => ({
  LlamaParseReader: class {
    constructor(options: unknown) { mocks.options(options); }
    loadDataAsContent = mocks.load;
  }
}));

import { extractWithLlamaParse } from "./llamaparse";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("LlamaParse provider failures", () => {
  it("propagates API errors instead of interpreting them as empty OCR", async () => {
    vi.stubEnv("LLAMA_CLOUD_API_KEY", "test-key");
    mocks.load.mockRejectedValueOnce(new Error("401 Unauthorized"));
    await expect(extractWithLlamaParse(new Uint8Array([1]), "resume.pdf"))
      .rejects.toThrow("401 Unauthorized");
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ ignoreErrors: false }));
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it("returns successfully extracted text", async () => {
    vi.stubEnv("LLAMA_CLOUD_API_KEY", "test-key");
    const text = "Candidate resume with education, experience, projects, and contact details.";
    mocks.load.mockResolvedValueOnce([{ text }]);
    await expect(extractWithLlamaParse(new Uint8Array([1]), "resume.pdf"))
      .resolves.toBe(text);
  });
});
