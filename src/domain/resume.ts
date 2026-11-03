import { z } from "zod";

const text = z.preprocess(
  (value) => (value === null || value === undefined ? "" : String(value)),
  z.string().trim().max(20_000)
);

const textList = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  z.array(text).max(200)
);

export const contactSchema = z.object({
  name: text,
  title: text,
  email: text,
  phone: text,
  location: text,
  linkedin: text,
  website: text
});

const id = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : crypto.randomUUID(),
  z.string().max(64)
);

export const experienceSchema = z.object({
  id: id.optional(),
  title: text,
  company: text,
  location: text,
  start: text,
  end: text,
  bullets: textList
});

export const educationSchema = z.object({
  id: id.optional(),
  degree: text,
  school: text,
  location: text,
  start: text,
  end: text
});

export const projectSchema = z.object({
  id: id.optional(),
  name: text,
  description: text,
  technologies: textList,
  url: text
});

export const additionalSectionSchema = z.object({
  heading: text,
  items: textList
});

export const resumeSchema = z.object({
  contact: contactSchema,
  summary: text,
  skills: textList,
  experience: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(experienceSchema).max(50)
  ),
  education: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(educationSchema).max(30)
  ),
  certifications: textList,
  projects: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(projectSchema).max(50)
  ),
  additionalSections: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(additionalSectionSchema).max(30)
  )
});

export const emptyResume: Resume = {
  contact: {
    name: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    website: ""
  },
  summary: "",
  skills: [],
  experience: [],
  education: [],
  certifications: [],
  projects: [],
  additionalSections: []
};

export const answersSchema = z.object({
  targetRole: z.string().trim().min(1).max(200),
  jobDescription: z.string().trim().max(12_000).default(""),
  quantifiedResults: z.string().trim().max(5_000),
  skills: z.string().trim().max(3_000),
  carefulContext: z.string().trim().max(3_000),
  gapAnswers: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(z.object({ id: z.string().max(64), answer: z.string().trim().max(2_000) }))
      .max(20)
  ).optional()
});

export function gapSummary(answers: Answers): string {
  const filled = (answers.gapAnswers ?? []).filter((item) => item.answer);
  if (!filled.length) return "";
  return filled.map((item) => `[gap:${item.id}] ${item.answer}`).join("\n");
}

export type Resume = z.infer<typeof resumeSchema>;
export type Answers = z.infer<typeof answersSchema>;

export type ParseEngine = "llamaparse+groq" | "local+groq" | "rules";

export type FidelityReport = {
  sourceLines: number;
  representedLines: number;
  coverage: number;
  needsReview: string[];
};

export type ParsedResume = {
  resume: Resume;
  engine: ParseEngine;
  fidelity: FidelityReport;
  warnings: string[];
  quality?: QualityReport;
};

/**
 * Gap-aware questions derived from the actual parsed resume, not a static
 * questionnaire. Each item names what is missing and where it belongs.
 */
export const gapQuestionSchema = z.object({
  id: z.string(),
  field: z.string(),
  prompt: z.string(),
  hint: z.string().optional()
});

export type GapQuestion = z.infer<typeof gapQuestionSchema>;

export function deriveGapQuestions(resume: Resume): GapQuestion[] {
  const gaps: GapQuestion[] = [];
  const push = (id: string, field: string, prompt: string, hint?: string) =>
    gaps.push({ id, field, prompt, hint });

  if (!resume.contact.name) push("name", "contact.name", "What is your full name?");
  if (!resume.contact.email) push("email", "contact.email", "What email should recruiters use?");
  if (!resume.contact.phone) push("phone", "contact.phone", "What phone number should appear on the resume?");
  if (!resume.contact.location) push("location", "contact.location", "Which city/country should be listed?", "ATS parsers and recruiters both expect a location line.");
  if (!resume.summary) push("summary", "summary", "In two sentences, what role are you targeting and what is your strongest proof point?");

  if (resume.skills.length < 5) {
    push("skills", "skills", `Only ${resume.skills.length} skill${resume.skills.length === 1 ? "" : "s"} were found. Which additional tools or skills belong on this resume?`, "List real skills — the generator will not invent them.");
  }

  resume.experience.forEach((entry, index) => {
    const label = entry.title || entry.company || `Role ${index + 1}`;
    if (!entry.start && !entry.end) {
      push(`dates-${entry.id ?? index}`, `experience[${index}]`, `Add start/end dates for "${label}".`);
    }
    if (entry.bullets.length === 0) {
      push(`bullets-${entry.id ?? index}`, `experience[${index}]`, `What did you achieve in "${label}"? Add one or two concrete points.`);
    } else if (!entry.bullets.some((bullet) => /\d/.test(bullet))) {
      push(`metric-${entry.id ?? index}`, `experience[${index}]`, `No numbers appear under "${label}". What measurable result can you add?`, "A percentage, count, or timeframe — only facts you can stand behind.");
    }
  });

  if (resume.education.length === 0) {
    push("education", "education", "No education section was detected. Add your degree/diploma and institution, or confirm you want to leave it out.");
  }

  return gaps.slice(0, 8);
}

/**
 * Deterministic, rubric-based quality scoring. Scores are computed from the
 * structured resume data only — never by an LLM — so they are stable,
 * explainable, and testable. Each dimension is 0–100 with a list of human
 * readable reasons explaining what raised or lowered it.
 */
export const qualityDimensionsSchema = z.object({
  completeness: z.number().int().min(0).max(100),
  evidenceDensity: z.number().int().min(0).max(100),
  actionOrientation: z.number().int().min(0).max(100),
  contactReadiness: z.number().int().min(0).max(100),
  parseConfidence: z.number().int().min(0).max(100)
});

export type QualityDimensionReasons = {
  completeness: string[];
  evidenceDensity: string[];
  actionOrientation: string[];
  contactReadiness: string[];
  parseConfidence: string[];
};

export type QualityReport = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  verdict: string;
  dimensions: z.infer<typeof qualityDimensionsSchema>;
  reasons: QualityDimensionReasons;
};
