import { z } from "zod";

const value = z.string().trim().max(20_000);
const id = z.string().min(1).max(128);

export const sourceSegmentSchema = z.object({
  id,
  page: z.number().int().min(1).optional(),
  block: z.number().int().min(0),
  reader: z.enum(["local", "llamaparse", "paste"]),
  text: value,
  order: z.number().int().min(0),
  kind: z.enum(["heading", "line", "bullet", "table_cell", "link", "unknown"]),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }).optional()
});

export const linkSchema = z.object({
  url: value,
  anchorText: value,
  page: z.number().int().min(1).optional(),
  origin: z.enum(["annotation", "visible_text", "docx_relationship"])
});

export const documentSchema = z.object({
  id,
  filename: value,
  fileType: z.enum(["pdf", "docx", "paste"]),
  pageCount: z.number().int().min(1).max(4).optional(),
  readersUsed: z.array(z.enum(["local", "llamaparse", "paste"])),
  qualityFlags: z.array(z.enum([
    "low_density", "garbage_text", "column_ambiguity", "reader_disagreement",
    "missing_links", "llamaparse_unavailable"
  ]))
});

const factFieldsSchema = z.record(z.string(), z.union([
  value,
  z.array(value),
  z.boolean(),
  z.number()
]));

export const factSchema = z.object({
  id,
  type: z.enum([
    "contact", "education", "role", "project", "skill", "certification",
    "award", "volunteer", "link", "other"
  ]),
  parentId: id.optional(),
  fields: factFieldsSchema,
  originalText: value,
  sourceRefs: z.array(z.object({ segmentId: id, quote: value })).min(1),
  origin: z.enum(["extracted", "user_answer", "user_edit"]),
  status: z.enum(["extracted", "uncertain", "confirmed", "rejected", "missing"]),
  uncertaintyReasons: z.array(value),
  alternatives: z.array(factFieldsSchema),
  attributes: z.object({
    involvement: z.enum(["led", "contributed", "solo", "unknown"]).default("unknown"),
    quantities: z.array(z.object({
      value,
      unit: value,
      basis: z.enum(["source", "user_exact", "user_estimate"])
    })).default([]),
    outcome: z.enum(["stated", "unknown"]).default("unknown")
  }),
  parked: z.boolean(),
  history: z.array(z.object({
    at: z.string().datetime(),
    actor: z.enum(["user", "system"]),
    fields: factFieldsSchema
  }))
});

export const goalSchema = z.object({
  targetRole: value,
  stage: z.enum(["student", "early_career", "experienced"]),
  market: z.literal("india"),
  jobDescription: value,
  requirements: z.array(z.object({
    text: value,
    classification: z.enum(["evidenced", "adjacent", "not_evidenced"]),
    factIds: z.array(id)
  }))
});

export const gapSchema = z.object({
  id,
  factId: id.optional(),
  prompt: value,
  state: z.enum(["open", "answered", "skipped"]),
  answer: value,
  basis: z.enum(["exact", "approximate", "unknown"]).optional()
});

export const planSchema = z.object({
  sectionOrder: z.array(value),
  includedFactIds: z.array(id),
  bulletBudget: z.record(id, z.number().int().min(0).max(8)),
  pageTarget: z.union([z.literal(1), z.literal(2)])
});

export const bulletSchema = z.object({
  id,
  text: value,
  factIds: z.array(id).min(1),
  gates: z.record(z.string(), z.object({
    passed: z.boolean(),
    reason: value
  })),
  state: z.enum(["verified", "kept_as_written", "user_authored", "user_edited"]),
  alternatives: z.array(value)
});

export const resumeV2Schema = z.object({
  sections: z.array(z.object({
    id,
    heading: value,
    factIds: z.array(id),
    bulletIds: z.array(id)
  })),
  approved: z.boolean()
});

export const sessionV2Schema = z.object({
  schemaVersion: z.literal(2),
  id,
  updatedAt: z.string().datetime(),
  document: documentSchema.optional(),
  segments: z.array(sourceSegmentSchema),
  links: z.array(linkSchema),
  facts: z.array(factSchema),
  gaps: z.array(gapSchema),
  goal: goalSchema.optional(),
  plan: planSchema.optional(),
  bullets: z.array(bulletSchema),
  resume: resumeV2Schema.optional(),
  extractionWarnings: z.array(value)
});

export type SourceSegment = z.infer<typeof sourceSegmentSchema>;
export type Fact = z.infer<typeof factSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Gap = z.infer<typeof gapSchema>;
export type ResumePlan = z.infer<typeof planSchema>;
export type VerifiedBullet = z.infer<typeof bulletSchema>;
export type SessionV2 = z.infer<typeof sessionV2Schema>;

export function emptySessionV2(idValue = crypto.randomUUID()): SessionV2 {
  return {
    schemaVersion: 2,
    id: idValue,
    updatedAt: new Date().toISOString(),
    segments: [],
    links: [],
    facts: [],
    gaps: [],
    bullets: [],
    extractionWarnings: []
  };
}
