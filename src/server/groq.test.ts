import { describe, expect, it } from "vitest";
import { emptyResume, type Answers, type Resume } from "@/domain/resume";
import { applyGapAnswers } from "./groq";

const baseAnswers: Answers = {
  targetRole: "Platform Engineer",
  jobDescription: "",
  quantifiedResults: "",
  skills: "",
  carefulContext: "",
  gapAnswers: []
};

describe("applyGapAnswers", () => {
  it("keeps a role metric separate when no bullet association was confirmed", () => {
    const resume: Resume = {
      ...structuredClone(emptyResume),
      experience: [
        {
          id: "role-1",
          title: "Engineer",
          company: "Example",
          location: "",
          start: "",
          end: "",
          bullets: ["Built the internal deployment platform"]
        }
      ]
    };

    const result = applyGapAnswers(resume, {
      ...baseAnswers,
      gapAnswers: [{ id: "metric-role-1", answer: "Reduced deployment time by 40%" }]
    });

    expect(result.experience[0]?.bullets).toEqual([
      "Built the internal deployment platform",
      "Reduced deployment time by 40%"
    ]);
    expect(resume.experience[0]?.bullets).toEqual([
      "Built the internal deployment platform"
    ]);
  });

  it("applies verified contact and skill answers deterministically", () => {
    const result = applyGapAnswers(structuredClone(emptyResume), {
      ...baseAnswers,
      gapAnswers: [
        { id: "email", answer: "alex@example.com" },
        { id: "skills", answer: "TypeScript, PostgreSQL" }
      ]
    });

    expect(result.contact.email).toBe("alex@example.com");
    expect(result.skills).toEqual(["TypeScript", "PostgreSQL"]);
  });
});

