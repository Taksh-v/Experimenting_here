import { describe, expect, it } from "vitest";
import { emptyResume } from "@/domain/resume";
import { fidelityReport } from "./fidelity";

describe("fidelity report", () => {
  it("flags source lines absent from the structured resume", () => {
    const resume = {
      ...structuredClone(emptyResume),
      contact: { ...emptyResume.contact, name: "Alex Example" },
      skills: ["TypeScript"]
    };
    const report = fidelityReport(
      "Alex Example\nSkills\nTypeScript\nWon the National Robotics Prize",
      resume
    );
    expect(report.needsReview).toContain("Won the National Robotics Prize");
    expect(report.coverage).toBeLessThan(100);
  });
});
