import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { extractLocalText, validateUpload } from "./file-extraction";

describe("resume file extraction", () => {
  it("rejects an extension whose bytes are not a PDF", () => {
    const bytes = new TextEncoder().encode("not a pdf");
    const file = new File([bytes], "resume.pdf", { type: "application/pdf" });
    expect(() => validateUpload(file, bytes)).toThrow("valid PDF or DOCX");
  });

  it("extracts DOCX headers, body, and footers", async () => {
    const bytes = zipSync({
      "[Content_Types].xml": strToU8("<Types />"),
      "word/header1.xml": strToU8(
        "<w:hdr><w:p><w:r><w:t>Alex Example</w:t></w:r></w:p></w:hdr>"
      ),
      "word/document.xml": strToU8(
        "<w:document><w:body><w:p><w:r><w:t>Professional Experience</w:t></w:r></w:p><w:p><w:r><w:t>Built reliable systems for customers.</w:t></w:r></w:p></w:body></w:document>"
      ),
      "word/footer1.xml": strToU8(
        "<w:ftr><w:p><w:r><w:t>alex@example.com</w:t></w:r></w:p></w:ftr>"
      )
    });
    const file = new File([bytes], "resume.docx");
    expect(validateUpload(file, bytes)).toBe("docx");
    const result = await extractLocalText("docx", bytes);
    expect(result).toContain("Alex Example");
    expect(result).toContain("Built reliable systems");
    expect(result).toContain("alex@example.com");
  });
});
