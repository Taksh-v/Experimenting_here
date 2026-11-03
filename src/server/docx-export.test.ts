import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { emptyResume } from "@/domain/resume";
import { resumeToDocxBytes } from "./docx-export";

describe("DOCX export", () => {
  it("produces a readable document containing confirmed resume text", async () => {
    const bytes = await resumeToDocxBytes({
      ...structuredClone(emptyResume),
      contact: {
        ...emptyResume.contact,
        name: "Alex Example",
        email: "alex@example.com"
      },
      summary: "Platform engineer focused on reliable systems.",
      skills: ["TypeScript", "PostgreSQL"]
    });

    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    const files = unzipSync(bytes);
    const documentXml = strFromU8(files["word/document.xml"]);
    expect(documentXml).toContain("Alex Example");
    expect(documentXml).toContain("Platform engineer focused on reliable systems.");
    expect(documentXml).toContain("TypeScript, PostgreSQL");
  });
});
