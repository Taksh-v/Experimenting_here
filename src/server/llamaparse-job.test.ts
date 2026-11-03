import { afterEach, describe, expect, it, vi } from "vitest";
import { createJobToken, verifyJobToken } from "./llamaparse-job";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("LlamaParse job capability", () => {
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
