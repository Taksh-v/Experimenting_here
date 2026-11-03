import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { extractLocalText, validateUpload } from "./file-extraction";

function makePdf(text: string) {
  const escaped = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 14 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

describe("resume file extraction", () => {
  it("rejects an extension whose bytes are not a PDF", () => {
    const bytes = new TextEncoder().encode("not a pdf");
    const file = new File([bytes], "resume.pdf", { type: "application/pdf" });
    expect(() => validateUpload(file, bytes)).toThrow("valid PDF or DOCX");
  });

  it("extracts text with the worker-free serverless PDF build", async () => {
    const bytes = makePdf(
      "Alex Example Resume Professional Experience Software Engineer Acme Corporation"
    );
    const file = new File([bytes], "resume.pdf", { type: "application/pdf" });
    expect(validateUpload(file, bytes)).toBe("pdf");
    await expect(extractLocalText("pdf", bytes)).resolves.toContain(
      "Alex Example Resume"
    );
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
