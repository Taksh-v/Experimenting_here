import { describe, expect, it } from "vitest";
import { emptySessionV2, type Fact, type Goal } from "./v2";
import { assembleResume, buildResumePlan, deriveV2Gaps } from "./v2-planner";

const goal: Goal = {
  targetRole: "AI Engineer",
  stage: "early_career",
  market: "india",
  jobDescription: "",
  requirements: []
};

function fact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: crypto.randomUUID(),
    type: "project",
    fields: { name: "Voice Agent" },
    originalText: "Built a voice agent",
    sourceRefs: [{ segmentId: "s1", quote: "Built a voice agent" }],
    origin: "extracted",
    status: "confirmed",
    uncertaintyReasons: [],
    alternatives: [],
    attributes: { involvement: "unknown", quantities: [], outcome: "unknown" },
    parked: false,
    history: [],
    ...overrides
  };
}

describe("v2 planning", () => {
  it("asks only about missing evidence and caps questions", () => {
    const facts = Array.from({ length: 8 }, () => fact());
    const gaps = deriveV2Gaps(facts, goal);
    expect(gaps).toHaveLength(8);
    expect(gaps.every((gap) => gap.state === "open")).toBe(true);
  });

  it("plans only confirmed, unparked facts", () => {
    const included = fact();
    const plan = buildResumePlan([
      included,
      fact({ status: "uncertain" }),
      fact({ parked: true })
    ], goal);
    expect(plan.includedFactIds).toEqual([included.id]);
    expect(plan.sectionOrder.indexOf("education")).toBeLessThan(
      plan.sectionOrder.indexOf("role")
    );
  });

  it("assembles sections and linked bullets", () => {
    const item = fact();
    const plan = buildResumePlan([item], goal);
    const session = {
      ...emptySessionV2(),
      facts: [item],
      goal,
      plan,
      bullets: [{
        id: "b1",
        text: "Built a voice agent",
        factIds: [item.id],
        gates: {},
        state: "verified" as const,
        alternatives: []
      }]
    };
    const resume = assembleResume(session);
    expect(resume.sections[0].factIds).toContain(item.id);
    expect(resume.sections[0].bulletIds).toContain("b1");
  });
});
