import type { Fact, Gap, Goal, ResumePlan, SessionV2 } from "./v2";

function field(fact: Fact, key: string) {
  const value = fact.fields[key];
  return typeof value === "string" ? value.trim() : "";
}

export function deriveV2Gaps(facts: Fact[], goal: Goal): Gap[] {
  const confirmed = facts.filter((fact) => fact.status === "confirmed" && !fact.parked);
  const gaps: Gap[] = [];
  for (const fact of confirmed.filter((item) => ["role", "project"].includes(item.type))) {
    const label =
      field(fact, "title") ||
      field(fact, "name") ||
      field(fact, "company") ||
      fact.type;
    if (!field(fact, "actions") && !field(fact, "description")) {
      gaps.push({
        id: crypto.randomUUID(),
        factId: fact.id,
        prompt: "What did you personally do in “" + label + "”, and which tools or methods did you use?",
        state: "open",
        answer: ""
      });
    }
    if (fact.attributes.outcome === "unknown") {
      gaps.push({
        id: crypto.randomUUID(),
        factId: fact.id,
        prompt: "What changed because of your work in “" + label + "”? You may answer qualitatively or skip.",
        state: "open",
        answer: ""
      });
    }
  }
  if (goal.jobDescription) {
    gaps.push({
      id: crypto.randomUUID(),
      prompt: "Is there relevant experience for " + goal.targetRole + " that is missing from the uploaded resume?",
      state: "open",
      answer: ""
    });
  }
  return gaps.slice(0, 8);
}

export function buildResumePlan(facts: Fact[], goal: Goal): ResumePlan {
  const included = facts.filter((fact) => fact.status === "confirmed" && !fact.parked);
  const sectionOrder =
    goal.stage === "experienced"
      ? ["contact", "role", "project", "skill", "education", "certification", "award", "other"]
      : ["contact", "education", "project", "role", "skill", "certification", "award", "other"];
  const bulletBudget = Object.fromEntries(
    included
      .filter((fact) => ["role", "project"].includes(fact.type))
      .map((fact) => [fact.id, fact.type === "role" ? 4 : 2])
  );
  const substantial = included.filter((fact) => ["role", "project"].includes(fact.type)).length;
  return {
    sectionOrder,
    includedFactIds: included.map((fact) => fact.id),
    bulletBudget,
    pageTarget: goal.stage === "experienced" && substantial > 6 ? 2 : 1
  };
}

export function assembleResume(session: SessionV2) {
  if (!session.plan) throw new Error("Resume plan is missing.");
  const sectionMap = new Map<string, { factIds: string[]; bulletIds: string[] }>();
  const factById = new Map(session.facts.map((fact) => [fact.id, fact]));
  for (const factId of session.plan.includedFactIds) {
    const fact = factById.get(factId);
    if (!fact) continue;
    const section = sectionMap.get(fact.type) ?? { factIds: [], bulletIds: [] };
    section.factIds.push(fact.id);
    sectionMap.set(fact.type, section);
  }
  for (const bullet of session.bullets) {
    const first = factById.get(bullet.factIds[0]);
    if (!first) continue;
    const section = sectionMap.get(first.type) ?? { factIds: [], bulletIds: [] };
    section.bulletIds.push(bullet.id);
    sectionMap.set(first.type, section);
  }
  return {
    sections: session.plan.sectionOrder.flatMap((type) => {
      const values = sectionMap.get(type);
      if (!values || (!values.factIds.length && !values.bulletIds.length)) return [];
      return [{
        id: crypto.randomUUID(),
        heading: type === "role" ? "Experience" : type[0].toUpperCase() + type.slice(1),
        ...values
      }];
    }),
    approved: false
  };
}
