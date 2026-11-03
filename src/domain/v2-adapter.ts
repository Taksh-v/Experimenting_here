import { emptyResume, resumeSchema, type Resume } from "./resume";
import type { SessionV2 } from "./v2";

function stringField(fields: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function listField(fields: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = fields[key];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      return value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

export function sessionToLegacyResume(session: SessionV2): Resume {
  const resume: Resume = structuredClone(emptyResume);
  const bullets = new Map<string, string[]>();
  for (const bullet of session.bullets) {
    for (const factId of bullet.factIds) {
      bullets.set(factId, [...(bullets.get(factId) ?? []), bullet.text]);
    }
  }
  for (const fact of session.facts.filter(
    (item) => item.status === "confirmed" && !item.parked
  )) {
    const fields = fact.fields as Record<string, unknown>;
    switch (fact.type) {
      case "contact":
        resume.contact = {
          name: stringField(fields, "name", "fullName") || resume.contact.name,
          title: stringField(fields, "headline", "title") || resume.contact.title,
          email: stringField(fields, "email") || resume.contact.email,
          phone: stringField(fields, "phone") || resume.contact.phone,
          location: stringField(fields, "location") || resume.contact.location,
          linkedin: stringField(fields, "linkedin") || resume.contact.linkedin,
          website: stringField(fields, "website", "url") || resume.contact.website
        };
        break;
      case "skill":
        resume.skills.push(...listField(fields, "skills", "name", "value"));
        break;
      case "role":
        resume.experience.push({
          id: fact.id,
          title: stringField(fields, "title", "role"),
          company: stringField(fields, "company", "employer"),
          location: stringField(fields, "location"),
          start: stringField(fields, "start", "startDate"),
          end: stringField(fields, "end", "endDate"),
          bullets: bullets.get(fact.id) ?? [fact.originalText]
        });
        break;
      case "education":
        resume.education.push({
          id: fact.id,
          degree: stringField(fields, "degree", "qualification"),
          school: stringField(fields, "school", "institution"),
          location: stringField(fields, "location"),
          start: stringField(fields, "start", "startDate"),
          end: stringField(fields, "end", "endDate")
        });
        break;
      case "project":
        resume.projects.push({
          id: fact.id,
          name: stringField(fields, "name", "title"),
          description: (bullets.get(fact.id) ?? [stringField(fields, "description")])
            .filter(Boolean).join(" "),
          technologies: listField(fields, "technologies", "tools"),
          url: stringField(fields, "url", "link")
        });
        break;
      case "certification":
        resume.certifications.push(stringField(fields, "name", "title") || fact.originalText);
        break;
      default:
        resume.additionalSections.push({
          heading: fact.type === "award" ? "Awards" : "Additional",
          items: [fact.originalText]
        });
    }
  }
  resume.skills = [...new Set(resume.skills)];
  return resumeSchema.parse(resume);
}
