import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createJobToken,
  readLlamaParseJob,
  startLlamaParseJob,
  verifyJobToken
} from "./llamaparse-job";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("LlamaParse job capability", () => {
  const secret = "a-secure-test-secret-that-is-longer-than-32-characters";

  it("round-trips a signed job without exposing credentials", () => {
    vi.stubEnv("JOB_TOKEN_SECRET", "a-secure-test-secret-that-is-longer-than-32-characters");
    const capability = {
      jobId: "job-1",
      sessionId: "session-1",
      documentHash: "abc123",
      exp: Date.now() + 60_000
    };
    const token = createJobToken(capability);
    expect(token).not.toContain("a-secure-test-secret");
    expect(verifyJobToken(token)).toEqual(capability);
  });

  it("starts a v2 parse job with one JSON configuration", async () => {
    vi.stubEnv("JOB_TOKEN_SECRET", secret);
    vi.stubEnv("LLAMA_CLOUD_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "v2-job", status: "PENDING" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await startLlamaParseJob(
      new Uint8Array([37, 80, 68, 70]),
      "resume.pdf",
      "session-1",
      "hash-1"
    );

    expect(verifyJobToken(token).jobId).toBe("v2-job");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cloud.llamaindex.ai/api/v2/parse/upload");
    const form = init.body as FormData;
    const configuration = JSON.parse(String(form.get("configuration")));
    expect(configuration).toMatchObject({
      tier: "agentic",
      version: "latest",
      disable_cache: true,
      processing_options: { ocr_parameters: { languages: ["en"] } }
    });
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("polls v2 and joins completed markdown pages", async () => {
    vi.stubEnv("JOB_TOKEN_SECRET", secret);
    vi.stubEnv("LLAMA_CLOUD_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          job: { id: "v2-job", status: "COMPLETED" },
          markdown: {
            pages: [
              { page_number: 1, success: true, markdown: "# Person\nContact details and experience" },
              { page_number: 2, success: true, markdown: "## Education\nDegree and institution" }
            ]
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const token = createJobToken({
      jobId: "v2-job",
      sessionId: "session-1",
      documentHash: "hash-1",
      exp: Date.now() + 60_000
    });

    const result = await readLlamaParseJob(token);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.cloud.llamaindex.ai/api/v2/parse/v2-job?expand=markdown&expand=text"
    );
    expect(result).toMatchObject({
      status: "complete",
      format: "markdown",
      text: "# Person\nContact details and experience\n\n## Education\nDegree and institution"
    });
  });

  it("treats a running v2 job as pending", async () => {
    vi.stubEnv("JOB_TOKEN_SECRET", secret);
    vi.stubEnv("LLAMA_CLOUD_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ job: { id: "v2-job", status: "RUNNING" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    const token = createJobToken({
      jobId: "v2-job",
      sessionId: "session-1",
      documentHash: "hash-1",
      exp: Date.now() + 60_000
    });

    await expect(readLlamaParseJob(token)).resolves.toMatchObject({ status: "pending" });
  });

  it("rejects tampering and expiration", () => {
    vi.stubEnv("JOB_TOKEN_SECRET", "a-secure-test-secret-that-is-longer-than-32-characters");
    const token = createJobToken({
      jobId: "job-1",
      sessionId: "session-1",
      documentHash: "abc123",
      exp: Date.now() - 1
    });
    expect(() => verifyJobToken(token)).toThrow("expired");
    expect(() => verifyJobToken(token + "x")).toThrow("invalid");
  });
});
