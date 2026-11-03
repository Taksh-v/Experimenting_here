import { describe, expect, it } from "vitest";
import { parseWithRules } from "./rules-parser";

describe("deterministic resume parser", () => {
  it("extracts known sections and preserves unknown sections", () => {
    const resume = parseWithRules(`
Alex Example
alex@example.com

PROFESSIONAL SUMMARY
Backend engineer focused on reliable services.

SKILLS
TypeScript, PostgreSQL, Docker

PROFESSIONAL EXPERIENCE
Senior Engineer
Acme Corp
Jan 2021 - Present
- Reduced incident volume by 30%.

EDUCATION
BSc Computer Science
Example University
2016 - 2020

AWARDS
Engineering Excellence Award, 2023
`);

    expect(resume.contact.name).toBe("Alex Example");
    expect(resume.contact.email).toBe("alex@example.com");
    expect(resume.skills).toContain("TypeScript");
    expect(resume.experience[0]?.company).toBe("Acme Corp");
    expect(resume.additionalSections).toEqual([
      {
        heading: "AWARDS",
        items: ["Engineering Excellence Award, 2023"]
      }
    ]);
  });
});
