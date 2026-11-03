"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  deriveGapQuestions,
  resumeSchema,
  type Answers,
  type FidelityReport,
  type GapQuestion,
  type ParsedResume,
  type QualityReport,
  type Resume,
} from "@/domain/resume";

type Screen = "upload" | "loading" | "review" | "questions" | "result" | "error";

const initialAnswers: Answers = {
  targetRole: "",
  quantifiedResults: "",
  skills: "",
  carefulContext: "",
  gapAnswers: [],
};

function messageFromResponse(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  ) {
    return (value as { error: string }).error;
  }
  return "The resume could not be processed. Please try again.";
}

/* ------------------------------------------------------------------ */
/* Read-only preview (used on the result screen)                       */
/* ------------------------------------------------------------------ */

function ResumeView({ resume }: { resume: Resume }) {
  const contact = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.contact.website,
  ].filter(Boolean);

  return (
    <article className="resume">
      <section className="resume-contact">
        <h1>{resume.contact.name}</h1>
        {resume.contact.title && <p className="headline">{resume.contact.title}</p>}
        {contact.length > 0 && <p>{contact.join(" · ")}</p>}
      </section>

      {resume.summary && (
        <section>
          <h2>Professional Summary</h2>
          <p>{resume.summary}</p>
        </section>
      )}

      {resume.skills.length > 0 && (
        <section>
          <h2>Skills</h2>
          <p>{resume.skills.join(" · ")}</p>
        </section>
      )}

      {resume.experience.length > 0 && (
        <section>
          <h2>Professional Experience</h2>
          {resume.experience.map((entry, index) => (
            <div className="resume-entry" key={entry.id ?? `${entry.company}-${index}`}>
              <div className="entry-heading">
                <div>
                  <h3>{entry.title}</h3>
                  <p>{[entry.company, entry.location].filter(Boolean).join(", ")}</p>
                </div>
                <p>{[entry.start, entry.end].filter(Boolean).join(" – ")}</p>
              </div>
              {entry.bullets.length > 0 && (
                <ul>
                  {entry.bullets.map((bullet, bulletIndex) => (
                    <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {resume.education.length > 0 && (
        <section>
          <h2>Education</h2>
          {resume.education.map((entry, index) => (
            <div className="resume-entry" key={entry.id ?? `${entry.school}-${index}`}>
              <div className="entry-heading">
                <div>
                  <h3>{entry.degree}</h3>
                  <p>{[entry.school, entry.location].filter(Boolean).join(", ")}</p>
                </div>
                <p>{[entry.start, entry.end].filter(Boolean).join(" – ")}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {resume.certifications.length > 0 && (
        <section>
          <h2>Certifications</h2>
          <ul>
            {resume.certifications.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {resume.projects.length > 0 && (
        <section>
          <h2>Projects</h2>
          {resume.projects.map((project, index) => (
            <div className="resume-entry" key={project.id ?? `${project.name}-${index}`}>
              <h3>{project.name}</h3>
              {project.description && <p>{project.description}</p>}
              {project.technologies.length > 0 && (
                <p>{project.technologies.join(" · ")}</p>
              )}
              {project.url && <p>{project.url}</p>}
            </div>
          ))}
        </section>
      )}

      {resume.additionalSections.map((section, index) => (
        <section key={`${section.heading}-${index}`}>
          <h2>{section.heading}</h2>
          <ul>
            {section.items.map((item, itemIndex) => (
              <li key={`${item}-${itemIndex}`}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Editable review form (stage 3: user confirmation of parsed data)    */
/* ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ReviewForm({
  resume,
  onChange,
}: {
  resume: Resume;
  onChange: (next: Resume) => void;
}) {
  const setContact = (key: keyof Resume["contact"], value: string) =>
    onChange({ ...resume, contact: { ...resume.contact, [key]: value } });

  const updateExperience = (
    id: string | undefined,
    index: number,
    next: Partial<Resume["experience"][number]>
  ) =>
    onChange({
      ...resume,
      experience: resume.experience.map((entry, i) => (i === index ? { ...entry, ...next } : entry)),
    });

  const updateEducation = (index: number, next: Partial<Resume["education"][number]>) =>
    onChange({
      ...resume,
      education: resume.education.map((entry, i) => (i === index ? { ...entry, ...next } : entry)),
    });

  return (
    <div className="review">
      <section className="review-section">
        <h2>Contact</h2>
        <div className="field-grid">
          <Field label="Name" value={resume.contact.name} onChange={(v) => setContact("name", v)} />
          <Field label="Headline / Title" value={resume.contact.title} onChange={(v) => setContact("title", v)} />
          <Field label="Email" value={resume.contact.email} onChange={(v) => setContact("email", v)} />
          <Field label="Phone" value={resume.contact.phone} onChange={(v) => setContact("phone", v)} />
          <Field label="Location" value={resume.contact.location} onChange={(v) => setContact("location", v)} />
          <Field label="LinkedIn" value={resume.contact.linkedin} onChange={(v) => setContact("linkedin", v)} />
          <Field label="Website" value={resume.contact.website} onChange={(v) => setContact("website", v)} />
        </div>
      </section>

      <section className="review-section">
        <h2>Summary & Skills</h2>
        <label className="field">
          Professional summary
          <textarea
            rows={3}
            value={resume.summary}
            onChange={(event) => onChange({ ...resume, summary: event.target.value })}
          />
        </label>
        <label className="field">
          Skills (comma or line separated)
          <textarea
            rows={3}
            value={resume.skills.join(", ")}
            onChange={(event) =>
              onChange({
                ...resume,
                skills: event.target.value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
      </section>

      <section className="review-section">
        <h2>Experience</h2>
        {resume.experience.map((entry, index) => (
          <div className="review-card" key={entry.id ?? index}>
            <div className="review-card-head">
              <strong>{entry.title || entry.company || `Role ${index + 1}`}</strong>
              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  onChange({
                    ...resume,
                    experience: resume.experience.filter((_, i) => i !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
            <div className="field-grid">
              <Field label="Job title" value={entry.title} onChange={(v) => updateExperience(entry.id, index, { title: v })} />
              <Field label="Company" value={entry.company} onChange={(v) => updateExperience(entry.id, index, { company: v })} />
              <Field label="Location" value={entry.location} onChange={(v) => updateExperience(entry.id, index, { location: v })} />
              <Field label="Start" value={entry.start} onChange={(v) => updateExperience(entry.id, index, { start: v })} />
              <Field label="End" value={entry.end} onChange={(v) => updateExperience(entry.id, index, { end: v })} />
            </div>
            <label className="field">
              Bullet points (one per line)
              <textarea
                rows={Math.max(3, entry.bullets.length)}
                value={entry.bullets.join("\n")}
                onChange={(event) =>
                  updateExperience(entry.id, index, {
                    bullets: event.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                  })
                }
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            onChange({
              ...resume,
              experience: [
                ...resume.experience,
                { id: crypto.randomUUID(), title: "", company: "", location: "", start: "", end: "", bullets: [] },
              ],
            })
          }
        >
          Add role
        </button>
      </section>

      <section className="review-section">
        <h2>Education</h2>
        {resume.education.map((entry, index) => (
          <div className="review-card" key={entry.id ?? index}>
            <div className="review-card-head">
              <strong>{entry.degree || entry.school || `Entry ${index + 1}`}</strong>
              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  onChange({ ...resume, education: resume.education.filter((_, i) => i !== index) })
                }
              >
                Remove
              </button>
            </div>
            <div className="field-grid">
              <Field label="Degree" value={entry.degree} onChange={(v) => updateEducation(index, { degree: v })} />
              <Field label="School" value={entry.school} onChange={(v) => updateEducation(index, { school: v })} />
              <Field label="Location" value={entry.location} onChange={(v) => updateEducation(index, { location: v })} />
              <Field label="Start" value={entry.start} onChange={(v) => updateEducation(index, { start: v })} />
              <Field label="End" value={entry.end} onChange={(v) => updateEducation(index, { end: v })} />
            </div>
          </div>
        ))}
      </section>

      <section className="review-section">
        <h2>Certifications & Projects</h2>
        <label className="field">
          Certifications (one per line)
          <textarea
            rows={3}
            value={resume.certifications.join("\n")}
            onChange={(event) =>
              onChange({
                ...resume,
                certifications: event.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label className="field">
          Projects (one name per line)
          <textarea
            rows={3}
            value={resume.projects.map((p) => p.name).join("\n")}
            onChange={(event) =>
              onChange({
                ...resume,
                projects: event.target.value
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map(
                    (name) =>
                      resume.projects.find((p) => p.name === name) ?? {
                        id: crypto.randomUUID(),
                        name,
                        description: "",
                        technologies: [],
                        url: "",
                      }
                  ),
              })
            }
          />
        </label>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deterministic quality panel                                         */
/* ------------------------------------------------------------------ */

const DIMENSION_LABELS: Record<string, string> = {
  completeness: "Section completeness",
  evidenceDensity: "Quantified results",
  actionOrientation: "Action-verb phrasing",
  contactReadiness: "Recruiter can reach you",
  parseConfidence: "Extraction confidence",
};

function QualityPanel({ report }: { report: QualityReport }) {
  return (
    <section className="quality" aria-label="Resume quality score">
      <div className="quality-head">
        <span className={`quality-grade grade-${report.grade}`}>{report.grade}</span>
        <span className="quality-score">{report.score}/100</span>
        <p style={{ margin: 0 }}>{report.verdict}</p>
      </div>
      {(Object.entries(report.dimensions) as [keyof typeof report.dimensions, number][]).map(
        ([key, value]) => (
          <div className="dimension" key={key}>
            <span>
              {DIMENSION_LABELS[key] ?? key}: <strong>{value}</strong>
            </span>
            <div className="dimension-bar">
              <div className="dimension-fill" style={{ width: `${value}%` }} />
            </div>
            <ul>
              {report.reasons[key]?.map((reason, index) => (
                <li key={`${reason}-${index}`}>{reason}</li>
              ))}
            </ul>
          </div>
        )
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Actionable fidelity review                                          */
/* ------------------------------------------------------------------ */

function FidelityNotice({
  report,
  roles,
  onAssignLine,
  resolvedLines,
}: {
  report: FidelityReport;
  roles?: string[];
  onAssignLine?: (line: string, target: string) => void;
  resolvedLines?: Set<string>;
}) {
  return (
    <details className="fidelity">
      <summary>Extraction review</summary>
      <p>
        {report.coverage}% of source lines were confidently represented. Assign anything
        that belongs on the resume, or confirm it was dropped on purpose:
      </p>
      <ul>
        {report.needsReview.map((line, index) => (
          <li key={`${line}-${index}`}>
            {line}
            {resolvedLines?.has(line) ? (
              <span className="line-resolved"> ✓ handled</span>
            ) : onAssignLine ? (
              <span className="review-line-actions">
                <button type="button" onClick={() => onAssignLine(line, "summary")}>
                  → Summary
                </button>
                <button type="button" onClick={() => onAssignLine(line, "skills")}>
                  → Skill
                </button>
                <select
                  aria-label={`Assign "${line}" to a role`}
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) onAssignLine(line, event.target.value);
                  }}
                >
                  <option value="">→ Role…</option>
                  {(roles ?? []).map((role, roleIndex) => (
                    <option key={roleIndex} value={String(roleIndex)}>
                      {role}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => onAssignLine(line, "__discard__")}>
                  Discard
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Main wizard                                                         */
/* ------------------------------------------------------------------ */

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [screen, setScreen] = useState<Screen>("upload");
  const [status, setStatus] = useState("Uploading");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [gaps, setGaps] = useState<GapQuestion[]>([]);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [resolvedLines, setResolvedLines] = useState<Set<string>>(new Set());

  function reset() {
    setScreen("upload");
    setStatus("Uploading");
    setError("");
    setParsed(null);
    setResume(null);
    setAnswers(initialAnswers);
    setGaps([]);
    setQuality(null);
    setResolvedLines(new Set());
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload(file: File) {
    const extension = file.name.toLowerCase();
    if (!extension.endsWith(".pdf") && !extension.endsWith(".docx")) {
      setError("Upload a PDF or DOCX file.");
      setScreen("error");
      return;
    }
    if (!file.size) {
      setError("The file is empty.");
      setScreen("error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("The file is larger than 8 MB.");
      setScreen("error");
      return;
    }

    setScreen("loading");
    setStatus("Uploading");
    const readingTimer = window.setTimeout(() => setStatus("Reading"), 350);
    const structuringTimer = window.setTimeout(() => setStatus("Structuring"), 1400);

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/parse", { method: "POST", body: form });
      const body = (await response.json()) as unknown;
      if (!response.ok) throw new Error(messageFromResponse(body));
      const result = body as ParsedResume;
      setParsed(result);
      setResume(result.resume);
      setQuality(result.quality ?? null);
      setGaps(deriveGapQuestions(result.resume));
      setScreen("review");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The resume could not be processed."
      );
      setScreen("error");
    } finally {
      window.clearTimeout(readingTimer);
      window.clearTimeout(structuringTimer);
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void upload(file);
  }

  function dropFile(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  function assignFidelityLine(line: string, target: string) {
    if (!resume) return;
    let next = resume;
    if (target === "summary") {
      next = { ...resume, summary: resume.summary ? `${resume.summary} ${line}` : line };
    } else if (target === "skills") {
      next = { ...resume, skills: [...resume.skills, line] };
    } else if (target === "__discard__") {
      // User confirmed this line is intentionally excluded — no change needed.
    } else {
      const index = Number(target);
      if (!Number.isNaN(index) && resume.experience[index]) {
        next = {
          ...resume,
          experience: resume.experience.map((exp, i) =>
            i === index ? { ...exp, bullets: [...exp.bullets, line] } : exp
          ),
        };
      }
    }
    setResume(next);
    setResolvedLines((prev) => new Set(prev).add(line));
  }

  async function continueToResult(event: FormEvent) {
    event.preventDefault();
    if (!resume) return;
    setScreen("loading");
    setStatus("Polishing");
    try {
      const response = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, answers }),
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) throw new Error(messageFromResponse(body));
      const result = body as { resume: Resume; quality?: QualityReport };
      setResume(resumeSchema.parse(result.resume));
      setQuality(result.quality ?? null);
      setScreen("result");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The resume could not be updated."
      );
      setScreen("error");
    }
  }

  async function downloadDocx() {
    if (!resume) return;
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume }),
    });
    if (!response.ok) {
      setError("The export could not be generated.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(resume.contact.name || "resume").replace(/[^\w.-]+/g, "-")}-ats.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (screen === "upload") {
    return (
      <div className="center-stage">
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={chooseFile}
        />
        <button
          className="upload-box"
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={dropFile}
        >
          <span className="upload-icon" aria-hidden="true">↑</span>
          <span>Upload Resume</span>
        </button>
      </div>
    );
  }

  if (screen === "loading") {
    return (
      <div className="center-stage loading" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>{status}</p>
      </div>
    );
  }

  if (screen === "error") {
    return (
      <div className="center-stage message">
        <p>{error}</p>
        <button type="button" onClick={reset}>Try again</button>
      </div>
    );
  }

  if (screen === "review" && resume) {
    return (
      <div>
        <div className="review-bar">
          <p>
            We parsed your resume ({parsed?.engine}). Correct anything wrong below —
            nothing is sent to the AI until you confirm.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              if (resume) setGaps(deriveGapQuestions(resume));
              setScreen("questions");
            }}
          >
            Confirm & continue
          </button>
        </div>
        {parsed && parsed.fidelity.needsReview.length > 0 && (
          <div style={{ width: "min(900px, calc(100vw - 32px))", margin: "0 auto" }}>
            <FidelityNotice
              report={parsed.fidelity}
              roles={resume.experience.map(
                (entry, index) =>
                  [entry.title, entry.company].filter(Boolean).join(" — ") || `Role ${index + 1}`
              )}
              onAssignLine={assignFidelityLine}
              resolvedLines={resolvedLines}
            />
          </div>
        )}
        <ReviewForm resume={resume} onChange={setResume} />
      </div>
    );
  }

  if (screen === "questions" && resume) {
    const setGap = (id: string, value: string) =>
      setAnswers((prev) => {
        const others = (prev.gapAnswers ?? []).filter((item) => item.id !== id);
        return { ...prev, gapAnswers: [...others, { id, answer: value }] };
      });

    return (
      <form className="questions" onSubmit={continueToResult}>
        <label>
          Target role
          <input
            required
            value={answers.targetRole}
            onChange={(event) =>
              setAnswers({ ...answers, targetRole: event.target.value })
            }
          />
        </label>

        {gaps.length > 0 && (
          <fieldset className="gap-list">
            <legend>Fill the gaps we found in your resume</legend>
            {gaps.map((gap) => (
              <div className="gap-item" key={gap.id}>
                <span className="prompt">{gap.prompt}</span>
                {gap.hint && <span className="hint">{gap.hint}</span>}
                <textarea
                  rows={2}
                  placeholder="Leave blank to skip — we never invent facts."
                  onChange={(event) => setGap(gap.id, event.target.value)}
                />
              </div>
            ))}
          </fieldset>
        )}

        <label>
          Quantified results you can stand behind
          <textarea
            rows={4}
            placeholder="One per line"
            value={answers.quantifiedResults}
            onChange={(event) =>
              setAnswers({ ...answers, quantifiedResults: event.target.value })
            }
          />
        </label>
        <label>
          Skills to emphasize
          <textarea
            rows={3}
            value={answers.skills}
            onChange={(event) =>
              setAnswers({ ...answers, skills: event.target.value })
            }
          />
        </label>
        <label>
          Context to handle carefully
          <textarea
            rows={3}
            value={answers.carefulContext}
            onChange={(event) =>
              setAnswers({ ...answers, carefulContext: event.target.value })
            }
          />
        </label>
        <button className="primary-button" type="submit">Generate polished resume</button>
        <button className="text-button" type="button" onClick={() => setScreen("review")}>
          Back to editing
        </button>
      </form>
    );
  }

  return (
    <div className="result">
      {quality && <QualityPanel report={quality} />}
      {resume && <ResumeView resume={resume} />}
      <div className="action-bar">
        <button className="primary-button" type="button" onClick={() => void downloadDocx()}>
          Download DOCX
        </button>
        <button className="secondary-button" type="button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <button className="text-button" type="button" onClick={reset}>
          Upload another
        </button>
      </div>
    </div>
  );
}
