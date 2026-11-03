"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent
} from "react";
import type {
  Answers,
  FidelityReport,
  ParsedResume,
  Resume
} from "@/domain/resume";

type Screen = "upload" | "loading" | "questions" | "result" | "error";

const initialAnswers: Answers = {
  targetRole: "",
  quantifiedResults: "",
  skills: "",
  carefulContext: ""
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

function ResumeView({ resume }: { resume: Resume }) {
  const contact = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.contact.website
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
            <div className="resume-entry" key={`${entry.company}-${entry.title}-${index}`}>
              <div className="entry-heading">
                <div>
                  <h3>{entry.title}</h3>
                  <p>
                    {[entry.company, entry.location].filter(Boolean).join(", ")}
                  </p>
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
            <div className="resume-entry" key={`${entry.school}-${index}`}>
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
            <div className="resume-entry" key={`${project.name}-${index}`}>
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

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [screen, setScreen] = useState<Screen>("upload");
  const [status, setStatus] = useState("Uploading");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);

  function reset() {
    setScreen("upload");
    setStatus("Uploading");
    setError("");
    setParsed(null);
    setResume(null);
    setAnswers(initialAnswers);
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
      setScreen("questions");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The resume could not be processed."
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

  async function continueToResult(event: FormEvent) {
    event.preventDefault();
    if (!resume) return;
    setScreen("loading");
    setStatus("Structuring");
    try {
      const response = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, answers })
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) throw new Error(messageFromResponse(body));
      setResume((body as { resume: Resume }).resume);
      setScreen("result");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The resume could not be updated."
      );
      setScreen("error");
    }
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

  if (screen === "questions") {
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
        <button className="primary-button" type="submit">Continue</button>
      </form>
    );
  }

  return (
    <div className="result">
      {resume && <ResumeView resume={resume} />}
      {parsed && parsed.fidelity.needsReview.length > 0 && (
        <FidelityNotice report={parsed.fidelity} />
      )}
      <button className="text-button" type="button" onClick={reset}>
        Upload another
      </button>
    </div>
  );
}

function FidelityNotice({ report }: { report: FidelityReport }) {
  return (
    <details className="fidelity">
      <summary>Extraction review</summary>
      <p>
        {report.coverage}% of source lines were confidently represented.
        Check these lines against the original:
      </p>
      <ul>
        {report.needsReview.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
