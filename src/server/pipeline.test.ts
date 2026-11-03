import { afterEach, expect, it, vi } from "vitest";
import { emptyResume } from "@/domain/resume";

const mocks = vi.hoisted(() => ({ llama: vi.fn(), groq: vi.fn() }));
vi.mock("./llamaparse", () => ({ extractWithLlamaParse: mocks.llama }));
vi.mock("./groq", () => ({ structureWithGroq: mocks.groq }));
import { parseResume } from "./pipeline";

afterEach(() => vi.resetAllMocks());

it("passes LlamaParse output to Groq and returns an editable resume", async () => {
  const source = "Taksh Vadaliya\nSkills\nPython\nExperience\nAI Engineer";
  mocks.llama.mockResolvedValue(source);
  mocks.groq.mockResolvedValue({
    ...structuredClone(emptyResume),
    contact: { ...emptyResume.contact, name: "Taksh Vadaliya" },
    skills: ["Python"]
  });
  const file = new File(["%PDF-image-only"], "resume.pdf", { type: "application/pdf" });
  const result = await parseResume(file);
  expect(mocks.llama).toHaveBeenCalledWith(expect.any(Uint8Array), "resume.pdf");
  expect(mocks.groq).toHaveBeenCalledWith(source);
  expect(result.engine).toBe("llamaparse+groq");
  expect(result.resume.contact.name).toBe("Taksh Vadaliya");
});

it("does not send partial local PDF text to Groq after LlamaParse fails", async () => {
  mocks.llama.mockRejectedValue(new Error("Provider unavailable"));
  await expect(parseResume(new File(["%PDF-test"], "resume.pdf"))).rejects.toThrow("Provider unavailable");
  expect(mocks.groq).not.toHaveBeenCalled();
});
