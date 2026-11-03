import type { FidelityReport, QualityReport, Resume } from "@/domain/resume";

/**
 * Deterministic resume-quality rubric. No LLM is involved: the score is a
 * pure function of the structured resume, so it is stable, explainable and
 * unit-testable. Five dimensions are weighted into a 0–100 overall score.
 */

const WEAK_PHRASES = [
  "responsible for",
  "helped with",
  "worked on",
  "duties included",
  "in charge of",
  "assisted with",
  "involved in"
];

const ACTION_VERB =
  /^(led|built|designed|implemented|launched|migrated|optimized|automated|reduced|increased|improved|delivered|managed|created|developed|architected|scaled|streamlined|established|mentored|owned|shipped|refactored|analyzed|negotiated|generated|cut|grew|saved|drove|coordinated|deployed|integrated|monitored|resolved|trained|presented|authored|published)/i;

const METRIC = /\b\d+(?:[.,]\d+)?\s*(%|percent|x|k|m|b|usd|\$|€|£|users|customers|requests|hours|days|weeks|months|people|engineers|developers|clients|stores|schools|students|members|records|transactions|queries|services|endpoints|tests)\b|\$\s?\d|\b\d{1,3}(?:,\d{3})+\b/i;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function completeness(resume: Resume) {
  const reasons: string[] = [];
  let checks = 0;
  let passed = 0;

  const check = (condition: boolean, label: string) => {
    checks += 1;
    if (condition) passed += 1;
    else reasons.push(`Missing: ${label}`);
  };

  check(Boolean(resume.contact.name), "name");
  check(Boolean(resume.contact.email), "email");
  check(Boolean(resume.contact.phone), "phone");
  check(Boolean(resume.contact.location), "location");
  check(Boolean(resume.summary), "professional summary");
  check(resume.skills.length >= 5, "at least 5 skills");
  check(resume.experience.length > 0, "work experience");
  check(resume.education.length > 0, "education");
  check(resume.projects.length > 0 || resume.certifications.length > 0, "projects or certifications");

  if (resume.experience.length > 0 && resume.experience.every((e) => e.start || e.end)) {
    // dates present everywhere — counted via work-experience check already
  } else if (resume.experience.length > 0) {
    reasons.push("Some roles are missing start/end dates");
  }
  if (reasons.length === 0) reasons.push("All core sections are present");
  return { score: clamp((passed / checks) * 100), reasons };
}

function evidenceDensity(resume: Resume) {
  const reasons: string[] = [];
  const bullets = resume.experience.flatMap((entry) => entry.bullets);
  if (bullets.length === 0) {
    return { score: 0, reasons: ["No experience bullet points found"] };
  }
  const withMetric = bullets.filter((bullet) => METRIC.test(bullet)).length;
  const ratio = withMetric / bullets.length;
  const score = clamp(ratio * 130); // ~77% of bullets quantified → 100
  reasons.push(`${withMetric} of ${bullets.length} bullets contain measurable results`);
  if (ratio < 0.4) reasons.push("Add numbers (%, counts, time saved) to more bullets");
  else if (ratio >= 0.6) reasons.push("Strong evidence density");
  return { score, reasons };
}

function actionOrientation(resume: Resume) {
  const reasons: string[] = [];
  const bullets = resume.experience.flatMap((entry) => entry.bullets);
  if (bullets.length === 0) {
    return { score: 0, reasons: ["No experience bullet points found"] };
  }
  const weak = bullets.filter((bullet) =>
    WEAK_PHRASES.some((phrase) => bullet.toLowerCase().includes(phrase))
  ).length;
  const strongStart = bullets.filter((bullet) => ACTION_VERB.test(bullet.trim())).length;
  const startRatio = strongStart / bullets.length;
  const weakPenalty = (weak / bullets.length) * 40;
  const score = clamp(startRatio * 100 - weakPenalty + 15);
  reasons.push(`${strongStart} of ${bullets.length} bullets start with an action verb`);
  if (weak > 0) reasons.push(`${weak} bullets use passive phrases like "responsible for"`);
  else reasons.push("No passive filler phrases detected");
  return { score, reasons };
}

function contactReadiness(resume: Resume) {
  const reasons: string[] = [];
  const c = resume.contact;
  let score = 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email);
  if (c.name) score += 25; else reasons.push("Name is missing");
  if (emailValid) score += 30; else reasons.push("Email looks invalid or missing");
  if (c.phone.replace(/\D/g, "").length >= 7) score += 25; else reasons.push("Phone number is missing or too short");
  if (c.location) score += 10; else reasons.push("Location is missing");
  if (c.linkedin || c.website) score += 10; else reasons.push("No LinkedIn or portfolio link");
  if (reasons.length === 0) reasons.push("Recruiters can reach you through every common channel");
  return { score: clamp(score), reasons };
}

function parseConfidence(fidelity: FidelityReport, engine: string) {
  const reasons: string[] = [];
  const coverage = fidelity.coverage;
  let score = clamp(coverage);
  if (engine === "rules") {
    score = Math.min(score, 80);
    reasons.push("Structured locally with heading rules instead of the AI extractor");
  }
  if (fidelity.needsReview.length > 0) {
    reasons.push(`${fidelity.needsReview.length} source lines could not be confidently mapped — review them below`);
  } else {
    reasons.push("Every source line was confidently represented");
  }
  return { score, reasons };
}

export function qualityReport(
  resume: Resume,
  fidelity: FidelityReport,
  engine: string
): QualityReport {
  const completenessResult = completeness(resume);
  const evidence = evidenceDensity(resume);
  const action = actionOrientation(resume);
  const contact = contactReadiness(resume);
  const confidence = parseConfidence(fidelity, engine);

  const dimensions = {
    completeness: completenessResult.score,
    evidenceDensity: evidence.score,
    actionOrientation: action.score,
    contactReadiness: contact.score,
    parseConfidence: confidence.score
  };

  const score = clamp(
    dimensions.completeness * 0.25 +
      dimensions.evidenceDensity * 0.2 +
      dimensions.actionOrientation * 0.15 +
      dimensions.contactReadiness * 0.2 +
      dimensions.parseConfidence * 0.2
  );

  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const verdict =
    grade === "A"
      ? "Ready to send. This resume is complete, evidence-rich, and machine-readable."
      : grade === "B"
        ? "Solid foundation. Fix the flagged items below before sending."
        : grade === "C"
          ? "Needs work. Several quality signals are weak — review the suggestions."
          : "Not recruiter-ready yet. Add the missing sections and evidence first.";

  return {
    score,
    grade,
    verdict,
    dimensions,
    reasons: {
      completeness: completenessResult.reasons,
      evidenceDensity: evidence.reasons,
      actionOrientation: action.reasons,
      contactReadiness: contact.reasons,
      parseConfidence: confidence.reasons
    }
  };
}
