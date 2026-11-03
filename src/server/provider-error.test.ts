import { afterEach, expect, it, vi } from "vitest";
import { providerErrorMessage } from "./provider-error";

afterEach(() => vi.unstubAllEnvs());

it("reads plain API error objects thrown by the SDK", () => {
  expect(providerErrorMessage({ detail: "Invalid API key" })).toBe("Invalid API key");
  expect(providerErrorMessage({ detail: [{ loc: ["body", "file"], msg: "Field required", input: "private content" }] }))
    .toBe("body.file: Field required");
  expect(providerErrorMessage({ status: "FAILED", error_message: "OCR could not read page 2" }))
    .toBe("OCR could not read page 2");
});

it("reads Error instances and redacts credentials", () => {
  vi.stubEnv("LLAMA_CLOUD_API_KEY", "secret-test-value");
  expect(providerErrorMessage(new Error("Rejected secret-test-value")))
    .toBe("Rejected [redacted]");
});
