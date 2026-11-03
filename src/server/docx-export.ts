import {
  Document,
  AlignmentType,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TextRun,
  type ParagraphChild
} from "docx";
import type { Resume } from "@/domain/resume";

/**
 * Deterministic DOCX renderer. Consumes the confirmed structured resume and
 * produces a real-text, single-column, ATS-safe .docx — no images, no tables,
 * standard section headings.
 */

const HEADING_MAP: Record<string, string> = {
  summary: "PROFESSIONAL SUMMARY",
  skills: "SKILLS",
  experience: "EXPERIENCE",
  education: "EDUCATION",
  certifications: "CERTIFICATIONS",
  projects: "PROJECTS"
};

function text(value: string, options: { bold?: boolean; size?: number } = {}) {
  return new TextRun({
    text: value,
    bold: options.bold,
    size: options.size ?? 22 // 11pt in half-points
  });
}

function paragraph(children: ParagraphChild[], options: { spacingBefore?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; bullet?: boolean } = {}) {
  return new Paragraph({
    children,
    heading: undefined,
    alignment: options.alignment,
    bullet: options.bullet ? { level: 0 } : undefined,
    spacing: { before: options.spacingBefore ?? 0, after: 40 }
  });
}

function link(label: string, target: string): ExternalHyperlink {
  return new ExternalHyperlink({
    link: target,
    children: [new TextRun({ text: label, style: "Hyperlink", size: 22 })]
  });
}

function sectionHeading(heading: string) {
  return paragraph([text(heading, { bold: true, size: 26 })], { spacingBefore: 240 });
}

export function buildResumeDocument(resume: Resume): Document {
  const children: Paragraph[] = [];

  // ---- Contact block ------------------------------------------------------
  const name = resume.contact.name || "Your Name";
  children.push(
    paragraph([text(name, { bold: true, size: 40 })], { alignment: AlignmentType.CENTER })
  );
  if (resume.contact.title) {
    children.push(
      paragraph([text(resume.contact.title, { size: 24 })], { alignment: AlignmentType.CENTER })
    );
  }
  const contacts: ParagraphChild[] = [];
  const addContact = (child: ParagraphChild) => {
    if (contacts.length) contacts.push(text(" | "));
    contacts.push(child);
  };
  if (resume.contact.email) addContact(link(resume.contact.email, "mailto:" + resume.contact.email));
  if (resume.contact.phone) addContact(link(resume.contact.phone, "tel:" + resume.contact.phone.replace(/\s/g, "")));
  if (resume.contact.location) addContact(text(resume.contact.location));
  if (resume.contact.linkedin) addContact(link(
    resume.contact.linkedin,
    /^https?:\/\//i.test(resume.contact.linkedin)
      ? resume.contact.linkedin
      : "https://" + resume.contact.linkedin
  ));
  if (resume.contact.website) addContact(link(
    resume.contact.website,
    /^https?:\/\//i.test(resume.contact.website)
      ? resume.contact.website
      : "https://" + resume.contact.website
  ));
  if (contacts.length) {
    children.push(paragraph(contacts, { alignment: AlignmentType.CENTER }));
  }

  // ---- Summary ------------------------------------------------------------
  if (resume.summary) {
    children.push(sectionHeading(HEADING_MAP.summary));
    children.push(paragraph([text(resume.summary)]));
  }

  // ---- Skills -------------------------------------------------------------
  if (resume.skills.length) {
    children.push(sectionHeading(HEADING_MAP.skills));
    children.push(paragraph([text(resume.skills.join(", "))]));
  }

  // ---- Experience ---------------------------------------------------------
  if (resume.experience.length) {
    children.push(sectionHeading(HEADING_MAP.experience));
    for (const entry of resume.experience) {
      const header = [entry.title, entry.company].filter(Boolean).join(" — ");
      const dates = [entry.start, entry.end].filter(Boolean).join(" – ");
      const meta = [entry.location, dates].filter(Boolean).join(" · ");
      if (header) children.push(paragraph([text(header, { bold: true })], { spacingBefore: 120 }));
      if (meta) children.push(paragraph([text(meta)]));
      for (const bullet of entry.bullets) {
        children.push(paragraph([text(bullet)], { bullet: true }));
      }
    }
  }

  // ---- Education ----------------------------------------------------------
  if (resume.education.length) {
    children.push(sectionHeading(HEADING_MAP.education));
    for (const entry of resume.education) {
      const header = [entry.degree, entry.school].filter(Boolean).join(" — ");
      const meta = [entry.location, [entry.start, entry.end].filter(Boolean).join(" –")]
        .filter(Boolean)
        .join(" · ");
      if (header) children.push(paragraph([text(header, { bold: true })], { spacingBefore: 120 }));
      if (meta) children.push(paragraph([text(meta)]));
    }
  }

  // ---- Certifications -----------------------------------------------------
  if (resume.certifications.length) {
    children.push(sectionHeading(HEADING_MAP.certifications));
    for (const item of resume.certifications) {
      children.push(paragraph([text(item)], { bullet: true }));
    }
  }

  // ---- Projects -----------------------------------------------------------
  if (resume.projects.length) {
    children.push(sectionHeading(HEADING_MAP.projects));
    for (const project of resume.projects) {
      if (project.name) children.push(paragraph([text(project.name, { bold: true })], { spacingBefore: 120 }));
      if (project.description) children.push(paragraph([text(project.description)]));
      const extras = [
        project.technologies.length ? `Technologies: ${project.technologies.join(", ")}` : "",
        ""
      ].filter(Boolean);
      for (const extra of extras) children.push(paragraph([text(extra)], { bullet: true }));
      if (project.url) {
        children.push(paragraph([
          link(
            project.url,
            /^https?:\/\//i.test(project.url) ? project.url : "https://" + project.url
          )
        ]));
      }
    }
  }

  // ---- Additional sections ------------------------------------------------
  for (const section of resume.additionalSections) {
    if (!section.items.length) continue;
    children.push(sectionHeading((section.heading || "ADDITIONAL").toUpperCase()));
    for (const item of section.items) {
      children.push(paragraph([text(item)], { bullet: true }));
    }
  }

  return new Document({
    title: `${name} — Resume`,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 }
        }
      }
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } }
        },
        children
      }
    ]
  });
}

export async function resumeToDocxBytes(resume: Resume): Promise<Uint8Array> {
  return Packer.toBuffer(buildResumeDocument(resume));
}

