import type { Resume } from "@/domain/resume";
import { AppError } from "./errors";
function tokens(value: string) { return value.toLowerCase().match(/[a-z0-9][a-z0-9+#.@/%-]*/g) ?? []; }
function supported(value: string, source: string) {
  const valueTokens = [...new Set(tokens(value))];
  if (!valueTokens.length) return true;
  const sourceText = source.toLowerCase();
  const matched = valueTokens.filter((token) => sourceText.includes(token));
  return matched.length / valueTokens.length >= (valueTokens.length === 1 ? 1 : 0.5);
}
function values(resume: Resume) {
  const result: string[] = [resume.contact.name, resume.contact.title, resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.linkedin, resume.contact.website, ...resume.skills, ...resume.certifications];
  for (const entry of resume.experience) result.push(entry.title, entry.company, entry.location, entry.start, entry.end, ...entry.bullets);
  for (const entry of resume.education) result.push(entry.degree, entry.school, entry.location, entry.start, entry.end);
  for (const project of resume.projects) result.push(project.name, project.description, ...project.technologies, project.url);
  for (const section of resume.additionalSections) result.push(section.heading, ...section.items);
  return result.filter(Boolean);
}
export function assertResumeGrounded(resume: Resume, source: string) {
  const unsupported = values(resume).find((value) => !supported(value, source));
  if (unsupported) throw new AppError("PROVIDER_ERROR", "The extractor returned unsupported resume content (" + unsupported.slice(0, 80) + "). Please retry the upload.", 502);
}
