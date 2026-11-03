import {
  type ParsedResume,
  type ParseEngine,
  type Resume,
  resumeSchema
} from "@/domain/resume";
import { AppError } from "./errors";
import {
  extractLocalText,
  validateUpload
} from "./file-extraction";
import { fidelityReport } from "./fidelity";
import { structureWithGroq } from "./groq";
import { extractWithLlamaParse } from "./llamaparse";
import { parseWithRules, withIds } from "./rules-parser";
import { assertResumeGrounded } from "./grounding";

function assignIds(structured: Resume): Resume {
  return {
    ...structured,
    experience: withIds(structured.experience),
    education: withIds(structured.education),
    projects: withIds(structured.projects)
  };
}

function isResumeLike(source: string) {
  const normalized = source.toLowerCase();
  const signals = [
    /\bexperience\b/,
    /\beducation\b/,
    /\bskills?\b/,
    /\bsummary\b/,
    /\bprojects?\b/,
    /\bcertifications?\b/,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b(?:19|20)\d{2}\b/
  ];
  return signals.filter((signal) => signal.test(normalized)).length >= 2;
}

export async function parseResume(file: File): Promise<ParsedResume> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = validateUpload(file, bytes);
  const warnings: string[] = [];

  let source: string | null = null;
  let usedLlamaParse = false;
  try {
    source = await extractWithLlamaParse(bytes, file.name);
    usedLlamaParse = Boolean(source);
    if (!source && process.env.LLAMA_CLOUD_API_KEY) {
      warnings.push("LlamaParse returned too little text; local extraction was used.");
    }
  } catch (error) {
    console.warn("LlamaParse failed; attempting local extraction", {
      message: error instanceof Error ? error.message : "Unknown provider error"
    });
    warnings.push("LlamaParse was unavailable; local extraction was used.");
  }

  if (!source) source = await extractLocalText(kind, bytes);
  if (source.length > 300_000) {
    throw new AppError(
      "INVALID_FILE",
      "The document contains too much text to process safely."
    );
  }
  if (!isResumeLike(source)) {
    if (kind === "pdf" && source.length < 800) {
      throw new AppError(
        "UNREADABLE_FILE",
        "This PDF appears to be image-based and its text layer is incomplete. Enable LlamaParse OCR or upload a text-based PDF."
      );
    }
    throw new AppError("NOT_A_RESUME", "The file does not appear to be a resume.");
  }

  let engine: ParseEngine;
  let structured = await structureWithGroq(source);
  if (structured) {
    engine = usedLlamaParse ? "llamaparse+groq" : "local+groq";
  } else {
    structured = parseWithRules(source);
    engine = "rules";
    warnings.push("Groq is not configured; deterministic heading rules were used.");
  }

  const resume = resumeSchema.parse(assignIds(structured));
  assertResumeGrounded(resume, source);
  const meaningful =
    resume.contact.name ||
    resume.experience.length ||
    resume.education.length ||
    resume.skills.length;
  if (!meaningful) {
    throw new AppError(
      "UNREADABLE_FILE",
      "The document text was found, but its resume details could not be structured."
    );
  }

  const fidelity = fidelityReport(source, resume);
  if (fidelity.needsReview.length) {
    warnings.push(
      "Some source lines could not be confidently mapped and are flagged for review."
    );
  }
  return { resume, engine, fidelity, warnings };
}
