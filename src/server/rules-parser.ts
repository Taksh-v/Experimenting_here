import { emptyResume, resumeSchema, type Resume } from "@/domain/resume";

type SectionKey =
  | "summary"
  | "skills"
  | "experience"
  | "education"
  | "certifications"
  | "projects"
  | "additional";

const headingAliases: Record<string, SectionKey> = {
  summary: "summary",
  "professional summary": "summary",
  profile: "summary",
  objective: "summary",
  skills: "skills",
  "technical skills": "skills",
  "core competencies": "skills",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  employment: "experience",
  education: "education",
  certifications: "certifications",
  certification: "certifications",
  licenses: "certifications",
  projects: "projects",
  "selected projects": "projects",
  awards: "additional",
  honors: "additional",
  "selected honors": "additional",
  publications: "additional",
  patents: "additional",
  "invited talks": "additional",
  languages: "additional",
  volunteering: "additional",
  "volunteer experience": "additional",
  references: "additional",
  affiliations: "additional"
};

function cleanLine(line: string) {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•▪◦]\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function headingOf(line: string): SectionKey | null {
  const normalized = cleanLine(line).replace(/:$/, "").toLowerCase();
  return headingAliases[normalized] ?? null;
}

function looksLikeHeading(line: string) {
  const value = cleanLine(line).replace(/:$/, "");
  return (
    value.length >= 2 &&
    value.length <= 50 &&
    !/[.!?]$/.test(value) &&
    (line.startsWith("#") ||
      line.endsWith(":") ||
      value === value.toUpperCase())
  );
}

function splitSkills(lines: string[]) {
  return lines
    .flatMap((line) => cleanLine(line).split(/[,|;•]/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function periodParts(value: string) {
  const match = value.match(
    /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4})[^–—-]{0,20})\s*[–—-]\s*(Present|Current|Now|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4})[^|,;]{0,20})/i
  );
  return match ? { start: match[1].trim(), end: match[2].trim() } : null;
}

function parseExperience(lines: string[]) {
  if (!lines.length) return [];
  const entries: Resume["experience"] = [];
  let current: Resume["experience"][number] | null = null;

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    const period = periodParts(line);
    const bullet = /^[-*•▪◦]/.test(raw.trim());

    if (!current || (period && current.bullets.length > 0)) {
      current = {
        title: "",
        company: "",
        location: "",
        start: period?.start ?? "",
        end: period?.end ?? "",
        bullets: []
      };
      entries.push(current);
    }

    if (period && !current.start) {
      current.start = period.start;
      current.end = period.end;
    } else if (!current.title && !bullet) {
      current.title = line;
    } else if (!current.company && !bullet) {
      current.company = line;
    } else {
      current.bullets.push(line);
    }
  }

  return entries.filter(
    (entry) => entry.title || entry.company || entry.bullets.length
  );
}

function parseEducation(lines: string[]) {
  if (!lines.length) return [];
  const entries: Resume["education"] = [];
  let current: Resume["education"][number] | null = null;
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    const period = periodParts(line);
    if (!current || (period && (current.degree || current.school))) {
      current = {
        degree: "",
        school: "",
        location: "",
        start: period?.start ?? "",
        end: period?.end ?? ""
      };
      entries.push(current);
    }
    if (!current.degree && !period) current.degree = line;
    else if (!current.school && !period) current.school = line;
    else if (period) {
      current.start = period.start;
      current.end = period.end;
    } else if (!current.location) current.location = line;
  }
  return entries.filter((entry) => entry.degree || entry.school);
}

export function parseWithRules(source: string): Resume {
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);
  const resume: Resume = structuredClone(emptyResume);
  const sections = new Map<string, { key: SectionKey; lines: string[] }>();
  let currentHeading = "identity";
  let currentKey: SectionKey = "additional";
  sections.set(currentHeading, { key: currentKey, lines: [] });

  for (const line of lines) {
    const known = headingOf(line);
    if (known || looksLikeHeading(line)) {
      currentHeading = cleanLine(line).replace(/:$/, "");
      currentKey = known ?? "additional";
      sections.set(currentHeading, { key: currentKey, lines: [] });
      continue;
    }
    sections.get(currentHeading)?.lines.push(line);
  }

  const identity = sections.get("identity")?.lines.map(cleanLine) ?? [];
  const email = identity.find((line) => /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(line));
  const phone = identity.find((line) => /(?:\+?\d[\d\s().-]{7,}\d)/.test(line));
  const linkedin = identity.find((line) => /linkedin\.com\//i.test(line));
  const website = identity.find(
    (line) => /https?:\/\//i.test(line) && line !== linkedin
  );
  resume.contact.email = email?.match(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/)?.[0] ?? "";
  resume.contact.phone = phone?.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] ?? "";
  resume.contact.linkedin = linkedin ?? "";
  resume.contact.website = website ?? "";
  resume.contact.name =
    identity.find(
      (line) =>
        line !== email &&
        line !== phone &&
        line !== linkedin &&
        line !== website &&
        !/https?:\/\//i.test(line)
        && !/^(?:last updated|updated|page\s+\d+|curriculum vitae|resume)$/i.test(line)
    ) ?? "";

  for (const [heading, section] of sections) {
    if (heading === "identity") continue;
    const content = section.lines.map(cleanLine).filter(Boolean);
    if (!content.length) continue;
    switch (section.key) {
      case "summary":
        resume.summary = content.join(" ");
        break;
      case "skills":
        resume.skills.push(...splitSkills(content));
        break;
      case "experience":
        resume.experience.push(...parseExperience(section.lines));
        break;
      case "education":
        resume.education.push(...parseEducation(section.lines));
        break;
      case "certifications":
        resume.certifications.push(...content);
        break;
      case "projects":
        resume.projects.push(
          ...content.map((item) => ({
            name: item,
            description: "",
            technologies: [],
            url: ""
          }))
        );
        break;
      default:
        resume.additionalSections.push({ heading, items: content });
    }
  }

  return resumeSchema.parse(resume);
}
