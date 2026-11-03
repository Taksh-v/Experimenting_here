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

export const experienceSchema = z.object({
  title: text,
  company: text,
  location: text,
  start: text,
  end: text,
  bullets: textList
});

export const educationSchema = z.object({
  degree: text,
  school: text,
  location: text,
  start: text,
  end: text
});

export const projectSchema = z.object({
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
  quantifiedResults: z.string().trim().max(5_000),
  skills: z.string().trim().max(3_000),
  carefulContext: z.string().trim().max(3_000)
});

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
};
