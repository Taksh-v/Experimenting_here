"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { emptySessionV2, type Fact, type Goal, type SessionV2, type SourceSegment } from "@/domain/v2";
import { buildResumePlan, deriveV2Gaps, assembleResume } from "@/domain/v2-planner";
import { sessionToLegacyResume } from "@/domain/v2-adapter";
import { compareReaders } from "@/server/segments";
import { deleteSession, loadOriginalFile, loadSession, saveOriginalFile, saveSession } from "@/client/session-store";

type Screen = "upload" | "reading" | "review" | "target" | "questions" | "plan" | "editor" | "download" | "error";
type TurnstileApi = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: TurnstileApi } }

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

function errorMessage(value: unknown) {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") return value.error;
  return "The request could not be completed.";
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as unknown;
  if (!response.ok) throw new Error(errorMessage(body));
  return body as T;
}

function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widget = "";
    const render = () => {
      if (!ref.current || !window.turnstile) return;
      widget = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: onToken,
        "expired-callback": () => onToken("")
      });
    };
    if (window.turnstile) render();
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => { if (widget && window.turnstile) window.turnstile.remove(widget); };
  }, [onToken]);
  return siteKey ? <div ref={ref} className="turnstile" /> : null;
}

function SourceText({ fact, segments }: { fact: Fact; segments: SourceSegment[] }) {
  const source = new Map(segments.map((segment) => [segment.id, segment]));
  return (
    <details className="source-detail">
      <summary>View source</summary>
      {fact.sourceRefs.map((ref) => (
        <blockquote key={ref.segmentId}>{source.get(ref.segmentId)?.text ?? ref.quote}</blockquote>
      ))}
    </details>
  );
}

function Preview({ session }: { session: SessionV2 }) {
  const resume = sessionToLegacyResume(session);
  const contacts = [
    resume.contact.email && { label: resume.contact.email, href: "mailto:" + resume.contact.email },
    resume.contact.phone && { label: resume.contact.phone, href: "tel:" + resume.contact.phone.replace(/\s/g, "") },
    resume.contact.location && { label: resume.contact.location, href: "" },
    resume.contact.linkedin && { label: resume.contact.linkedin, href: /^https?:\/\//i.test(resume.contact.linkedin) ? resume.contact.linkedin : "https://" + resume.contact.linkedin },
    resume.contact.website && { label: resume.contact.website, href: /^https?:\/\//i.test(resume.contact.website) ? resume.contact.website : "https://" + resume.contact.website }
  ].filter(Boolean) as Array<{ label: string; href: string }>;
  return (
    <article className="resume">
      <section className="resume-contact">
        <h1>{resume.contact.name || "Your Name"}</h1>
        {resume.contact.title && <p className="headline">{resume.contact.title}</p>}
        <p>{contacts.map((contact, index) => <span key={contact.label}>{index > 0 && " · "}{contact.href ? <a href={contact.href}>{contact.label}</a> : contact.label}</span>)}</p>
      </section>
      {resume.skills.length > 0 && <section><h2>Skills</h2><p>{resume.skills.join(" · ")}</p></section>}
      {resume.experience.length > 0 && <section><h2>Experience</h2>{resume.experience.map((entry) => (
        <div className="resume-entry" key={entry.id}><h3>{entry.title} — {entry.company}</h3><p>{entry.start} {entry.end && "– " + entry.end}</p><ul>{entry.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul></div>
      ))}</section>}
      {resume.projects.length > 0 && <section><h2>Projects</h2>{resume.projects.map((project) => (
        <div className="resume-entry" key={project.id}><h3>{project.name}</h3><p>{project.description}</p><p>{project.technologies.join(" · ")}</p>{project.url && <p><a href={/^https?:\/\//i.test(project.url) ? project.url : "https://" + project.url}>{project.url}</a></p>}</div>
      ))}</section>}
      {resume.education.length > 0 && <section><h2>Education</h2>{resume.education.map((entry) => (
        <div className="resume-entry" key={entry.id}><h3>{entry.degree} — {entry.school}</h3><p>{entry.start} {entry.end && "– " + entry.end}</p></div>
      ))}</section>}
      {resume.certifications.length > 0 && <section><h2>Certifications</h2><ul>{resume.certifications.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    </article>
  );
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<SessionV2>(() => emptySessionV2());
  const [screen, setScreen] = useState<Screen>("upload");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [pendingEdit, setPendingEdit] = useState<{ bulletId: string; text: string } | null>(null);

  useEffect(() => {
    void loadSession().then((stored) => {
      if (stored) {
        setSession(stored);
        if (stored.resume) setScreen(stored.resume.approved ? "download" : "editor");
        else if (stored.plan) setScreen("plan");
        else if (stored.goal) setScreen(stored.gaps.length ? "questions" : "target");
        else if (stored.facts.length) setScreen("review");
      }
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (loaded) void saveSession(session);
  }, [loaded, session]);
  useEffect(() => {
    if (screen !== "review" || session.document?.fileType !== "pdf") {
      setSourceUrl("");
      return;
    }
    let url = "";
    void loadOriginalFile().then((file) => {
      if (!file) return;
      url = URL.createObjectURL(file);
      setSourceUrl(url);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [screen, session.document?.fileType]);

  const update = (recipe: (current: SessionV2) => SessionV2) => setSession((current) => recipe(current));

  async function structure(
    next: SessionV2,
    primary: SourceSegment[],
    uncertainSegmentIds: string[] = []
  ) {
    setStatus("Building your fact ledger");
    const result = await jsonRequest<{ facts: Fact[] }>("/api/v2/structure", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: next.id, segments: primary })
    });
    const uncertain = new Set(uncertainSegmentIds);
    const completed = {
      ...next,
      facts: result.facts.map((fact) =>
        fact.sourceRefs.some((reference) => uncertain.has(reference.segmentId))
          ? {
              ...fact,
              status: "uncertain" as const,
              uncertaintyReasons: [
                ...new Set([...fact.uncertaintyReasons, "Readers disagree on this source"])
              ]
            }
          : fact
      ),
      updatedAt: new Date().toISOString()
    };
    setSession(completed);
    setScreen("review");
  }

  async function upload(file: File) {
    const fresh = emptySessionV2();
    setSession(fresh);
    setScreen("reading");
    setError("");
    setStatus("Reading your resume");
    await saveOriginalFile(file);
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error("The first release accepts files up to 4 MB.");
      const form = new FormData();
      form.append("file", file);
      form.append("sessionId", fresh.id);
      if (turnstileToken) form.append("turnstileToken", turnstileToken);
      if (file.name.toLowerCase().endsWith(".docx")) {
        const result = await jsonRequest<{ segments: SourceSegment[] }>("/api/v2/docx", { method: "POST", body: form });
        const next: SessionV2 = {
          ...fresh,
          document: { id: crypto.randomUUID(), filename: file.name, fileType: "docx", readersUsed: ["local"], qualityFlags: [] },
          segments: result.segments
        };
        await structure(next, result.segments);
        return;
      }
      const start = await jsonRequest<{
        token: string; fallback: boolean; warning: string; documentHash: string; pageCount: number;
        localSegments: SourceSegment[]; localQuality: { characters: number; usable: boolean };
      }>("/api/v2/llamaparse/start", { method: "POST", body: form });
      if (start.fallback) {
        const next: SessionV2 = {
          ...fresh,
          document: {
            id: crypto.randomUUID(), filename: file.name, fileType: "pdf", pageCount: start.pageCount,
            readersUsed: ["local"], qualityFlags: ["llamaparse_unavailable"]
          },
          segments: start.localSegments,
          extractionWarnings: [start.warning]
        };
        await structure(next, start.localSegments, start.localSegments.map((segment) => segment.id));
        return;
      }
      setStatus("LlamaParse is reading the PDF");
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const result = await jsonRequest<
          { status: "pending" } |
          { status: "complete"; segments: SourceSegment[]; documentHash: string }
        >("/api/v2/llamaparse/status", {
          headers: { Authorization: "Bearer " + start.token }
        });
        if (result.status === "pending") {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        const comparison = compareReaders(start.localSegments, result.segments);
        const flags = comparison.disagreement.length ? ["reader_disagreement" as const] : [];
        const next: SessionV2 = {
          ...fresh,
          document: {
            id: crypto.randomUUID(), filename: file.name, fileType: "pdf", pageCount: start.pageCount,
            readersUsed: ["local", "llamaparse"], qualityFlags: flags
          },
          segments: [...result.segments, ...start.localSegments],
          extractionWarnings: comparison.disagreement.length
            ? ["The readers disagreed on important values. Review highlighted sources carefully."]
            : []
        };
        await structure(next, result.segments, comparison.disagreement);
        return;
      }
      throw new Error("LlamaParse did not finish in time. Your local session was preserved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The resume could not be processed.");
      setScreen("error");
    }
  }

  async function processPastedText() {
    const text = pastedText.trim();
    if (text.length < 40) {
      setError("Paste at least a few complete resume lines.");
      return;
    }
    const fresh = emptySessionV2();
    const segments: SourceSegment[] = text.split(/\n+/).map((line) => line.trim())
      .filter(Boolean).map((line, index) => ({
        id: crypto.randomUUID(),
        block: index,
        reader: "paste" as const,
        text: line,
        order: index,
        kind: "line" as const
      }));
    const next: SessionV2 = {
      ...fresh,
      document: {
        id: crypto.randomUUID(),
        filename: "Pasted resume",
        fileType: "paste",
        readersUsed: ["paste"],
        qualityFlags: []
      },
      segments
    };
    setSession(next);
    setScreen("reading");
    try {
      await structure(next, segments);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The pasted resume could not be processed.");
      setScreen("error");
    }
  }

  function updateFact(id: string, changes: Partial<Fact>) {
    update((current) => ({ ...current, facts: current.facts.map((fact) => {
      if (fact.id !== id) return fact;
      const changed = Boolean(changes.fields || changes.status || changes.parked !== undefined);
      return {
        ...fact,
        ...changes,
        history: changed
          ? [...fact.history, {
              at: new Date().toISOString(),
              actor: "user" as const,
              fields: fact.fields
            }]
          : fact.history
      };
    }) }));
  }

  async function saveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const goal: Goal = {
      targetRole: String(data.get("targetRole") ?? "").trim(),
      stage: String(data.get("stage")) as Goal["stage"],
      market: "india",
      jobDescription: String(data.get("jobDescription") ?? "").trim(),
      requirements: []
    };
    if (!goal.targetRole) return;
    let next = { ...session, goal, gaps: deriveV2Gaps(session.facts, goal) };
    if (goal.jobDescription) {
      try {
        const mapped = await jsonRequest<{ requirements: Goal["requirements"] }>("/api/v2/jd-map", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id, goal, facts: session.facts })
        });
        next = { ...next, goal: { ...goal, requirements: mapped.requirements } };
      } catch {
        next = { ...next, extractionWarnings: [...next.extractionWarnings, "Job-description mapping was unavailable; continuing without it."] };
      }
    }
    setSession(next);
    setQuestionIndex(0);
    setScreen(next.gaps.length ? "questions" : "plan");
  }

  function submitAnswer(value = answer) {
    const gap = session.gaps[questionIndex];
    if (!gap) return;
    let next = session;
    const state = value.trim() ? "answered" as const : "skipped" as const;
    const updatedGap = { ...gap, state, answer: value.trim(), basis: value.trim() ? "exact" as const : undefined };
    next = { ...next, gaps: next.gaps.map((item) => item.id === gap.id ? updatedGap : item) };
    if (value.trim()) {
      const segment: SourceSegment = {
        id: crypto.randomUUID(), block: next.segments.length, reader: "paste",
        text: gap.prompt + "\n" + value.trim(), order: next.segments.length, kind: "line"
      };
      const fact: Fact = {
        id: crypto.randomUUID(), type: "other", parentId: gap.factId,
        fields: { answer: value.trim() }, originalText: value.trim(),
        sourceRefs: [{ segmentId: segment.id, quote: value.trim() }],
        origin: "user_answer", status: "confirmed", uncertaintyReasons: [],
        alternatives: [], attributes: {
          involvement: "unknown",
          quantities: [],
          outcome: /what changed|outcome|result/i.test(gap.prompt) ? "stated" : "unknown"
        },
        parked: false, history: []
      };
      next = { ...next, segments: [...next.segments, segment], facts: [...next.facts, fact] };
    }
    setSession(next);
    setAnswer("");
    if (questionIndex + 1 < next.gaps.length) setQuestionIndex(questionIndex + 1);
    else setScreen("plan");
  }

  function createPlan() {
    if (!session.goal) return;
    const plan = buildResumePlan(session.facts, session.goal);
    setSession({ ...session, plan });
  }

  async function generate() {
    if (!session.plan) return;
    setScreen("reading");
    setStatus("Writing and verifying your resume");
    try {
      const result = await jsonRequest<{ bullets: SessionV2["bullets"] }>("/api/v2/write", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          facts: session.facts.filter((fact) =>
            session.plan?.includedFactIds.includes(fact.id) ||
            (fact.parentId && session.plan?.includedFactIds.includes(fact.parentId))
          )
        })
      });
      const next = { ...session, bullets: result.bullets };
      const completed = { ...next, resume: assembleResume(next) };
      setSession(completed);
      setScreen("editor");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Writing failed.");
      setScreen("error");
    }
  }

  function editBullet(id: string, text: string) {
    const bullet = session.bullets.find((item) => item.id === id);
    if (!bullet) return;
    const cited = session.facts.filter((fact) => bullet.factIds.includes(fact.id));
    const evidence = JSON.stringify(cited).toLowerCase();
    const claims = text.match(/(?:https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+|\b\d[\d,./:%+-]*\b)/gi) ?? [];
    const safeWords = new Set(["Built", "Created", "Developed", "Designed", "Implemented", "Delivered", "Integrated", "Optimized", "Automated", "Analyzed", "Researched", "Improved", "Reduced", "Increased", "Led", "Managed", "Owned"]);
    const entities = text.match(/\b[A-Z][A-Za-z0-9.+#-]{1,}\b/g)
      ?.filter((item) => !safeWords.has(item)) ?? [];
    const strong = /\b(led|managed|owned|architected|founded|spearheaded)\b/i.test(text);
    const outcome = /\b(increased|reduced|improved|grew|saved|accelerated)\b/i.test(text);
    const unsupported =
      claims.some((claim) => !evidence.includes(claim.toLowerCase())) ||
      entities.some((entity) => !evidence.includes(entity.toLowerCase())) ||
      (strong && !cited.some((fact) => ["led", "solo"].includes(fact.attributes.involvement))) ||
      (outcome && !cited.some((fact) => fact.attributes.outcome === "stated"));
    if (unsupported) {
      setError("This edit adds a claim that is not supported by the confirmed facts. Add it as a fact first.");
      setPendingEdit({ bulletId: id, text });
      return;
    }
    setError("");
    setPendingEdit(null);
    update((current) => ({
      ...current,
      bullets: current.bullets.map((item) => item.id === id
        ? { ...item, text, state: "user_edited" as const }
        : item)
    }));
  }

  function confirmPendingEdit() {
    if (!pendingEdit) return;
    const segment: SourceSegment = {
      id: crypto.randomUUID(),
      block: session.segments.length,
      reader: "paste",
      text: pendingEdit.text,
      order: session.segments.length,
      kind: "line"
    };
    const fact: Fact = {
      id: crypto.randomUUID(),
      type: "other",
      fields: { claim: pendingEdit.text },
      originalText: pendingEdit.text,
      sourceRefs: [{ segmentId: segment.id, quote: pendingEdit.text }],
      origin: "user_edit",
      status: "confirmed",
      uncertaintyReasons: [],
      alternatives: [],
      attributes: { involvement: "unknown", quantities: [], outcome: "unknown" },
      parked: false,
      history: []
    };
    setSession((current) => ({
      ...current,
      segments: [...current.segments, segment],
      facts: [...current.facts, fact],
      bullets: current.bullets.map((bullet) =>
        bullet.id === pendingEdit.bulletId
          ? {
              ...bullet,
              text: pendingEdit.text,
              factIds: [...bullet.factIds, fact.id],
              state: "user_edited"
            }
          : bullet
      )
    }));
    setPendingEdit(null);
    setError("");
  }

  async function downloadDocx() {
    const response = await fetch("/api/v2/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session)
    });
    if (!response.ok) throw new Error(errorMessage(await response.json()));
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "evolving-resume.docx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function clearAll() {
    await deleteSession();
    setSession(emptySessionV2());
    setScreen("upload");
    setError("");
  }

  const openGaps = session.gaps;
  const currentGap = openGaps[questionIndex];
  const confirmedCount = session.facts.filter((fact) => fact.status === "confirmed" && !fact.parked).length;
  const resume = useMemo(() => sessionToLegacyResume(session), [session]);

  if (!loaded) return <main className="center-stage"><p>Loading your private session…</p></main>;

  return (
    <main>
      {screen !== "upload" && (
        <div className="privacy-bar">
          <span>Stored on this device</span>
          <button type="button" className="text-button" onClick={() => void clearAll()}>Delete Session</button>
        </div>
      )}

      {screen === "upload" && (
        <div className="center-stage">
          <h1 className="brand">Evolving Resume</h1>
          <input ref={inputRef} className="visually-hidden" type="file" accept=".pdf,.docx" onChange={(event) => {
            const file = event.target.files?.[0]; if (file) void upload(file);
          }} />
          <button className="upload-box" type="button" onClick={() => inputRef.current?.click()}>
            <span>Upload Resume</span>
          </button>
          <p className="consent">PDFs are processed by LlamaParse and resume text by Groq. Your working session stays in this browser until you delete it.</p>
          <Turnstile onToken={setTurnstileToken} />
          <button className="text-button" type="button" onClick={() => setPasteOpen((value) => !value)}>
            Paste resume text instead
          </button>
          {pasteOpen && (
            <div className="paste-fallback">
              <textarea rows={10} value={pastedText} onChange={(event) => setPastedText(event.target.value)} />
              <button className="secondary-button" type="button" onClick={() => void processPastedText()}>
                Use pasted text
              </button>
            </div>
          )}
        </div>
      )}

      {screen === "reading" && <div className="center-stage loading"><span className="spinner" /><p>{status}</p></div>}

      {screen === "error" && <div className="center-stage message"><p>{error}</p><button type="button" onClick={() => setScreen(session.facts.length ? "review" : "upload")}>Continue</button></div>}

      {screen === "review" && (
        <div className="v2-shell">
          <header className="stage-head"><div><h1>Check the extracted facts</h1><p>Confirm what is correct. Uncertain items require an individual decision.</p></div>
          <button className="primary-button" type="button" disabled={confirmedCount === 0} onClick={() => setScreen("target")}>Continue</button></header>
          {session.extractionWarnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}
          <button type="button" className="secondary-button" onClick={() => update((current) => ({
            ...current, facts: current.facts.map((fact) => fact.status === "extracted" ? { ...fact, status: "confirmed" as const } : fact)
          }))}>Confirm all reviewed extracted facts</button>
          <div className={sourceUrl ? "source-review-grid" : ""}>
          {sourceUrl && <iframe className="source-pdf" src={sourceUrl} title="Uploaded resume" />}
          <div className="fact-list">
            {[...session.facts].sort((a, b) => Number(b.status === "uncertain") - Number(a.status === "uncertain")).map((fact) => (
              <article className={"fact-card " + fact.status} key={fact.id}>
                <div className="fact-head"><strong>{fact.type}</strong><span>{fact.status}</span></div>
                {Object.entries(fact.fields).map(([key, value]) => (
                  <label className="field" key={key}>{key}<input value={Array.isArray(value) ? value.join(", ") : String(value)} onChange={(event) => updateFact(fact.id, {
                    fields: { ...fact.fields, [key]: Array.isArray(value) ? event.target.value.split(",").map((item) => item.trim()).filter(Boolean) : event.target.value },
                    status: "confirmed",
                    origin: "user_edit"
                  })} /></label>
                ))}
                <p className="original">{fact.originalText}</p>
                <SourceText fact={fact} segments={session.segments} />
                <div className="row-actions">
                  <button type="button" onClick={() => updateFact(fact.id, { status: "confirmed" })}>Confirm</button>
                  <button type="button" onClick={() => updateFact(fact.id, { parked: !fact.parked })}>{fact.parked ? "Restore" : "Park"}</button>
                  <button type="button" onClick={() => updateFact(fact.id, { status: "rejected" })}>Reject</button>
                </div>
              </article>
            ))}
          </div></div>
        </div>
      )}

      {screen === "target" && (
        <form className="questions" onSubmit={(event) => void saveTarget(event)}>
          <h1>Your target</h1>
          <label>Target role<input name="targetRole" required /></label>
          <label>Career stage<select name="stage" defaultValue="early_career"><option value="student">Student</option><option value="early_career">Early career</option><option value="experienced">Experienced</option></select></label>
          <label>Job description (optional)<textarea name="jobDescription" rows={8} /></label>
          <p>Market: India</p>
          <button className="primary-button">Continue</button>
        </form>
      )}

      {screen === "questions" && currentGap && (
        <div className="questions">
          <p>{questionIndex + 1} of {openGaps.length}</p><h2>{currentGap.prompt}</h2>
          <textarea rows={5} value={answer} onChange={(event) => setAnswer(event.target.value)} />
          <button className="primary-button" type="button" onClick={() => submitAnswer()}>Save answer</button>
          <button className="text-button" type="button" onClick={() => submitAnswer("")}>Skip / I don’t know</button>
        </div>
      )}

      {screen === "plan" && (
        <div className="v2-shell">
          <h1>Resume plan</h1>
          {!session.plan ? <button className="primary-button" type="button" onClick={createPlan}>Create plan</button> : (
            <>
              <p>{session.plan.pageTarget}-page target · {session.plan.includedFactIds.length} confirmed facts</p>
              <ol>{session.plan.sectionOrder.map((section) => <li key={section}>{section}</li>)}</ol>
              <button className="primary-button" type="button" onClick={() => void generate()}>Write verified resume</button>
            </>
          )}
        </div>
      )}

      {screen === "editor" && (
        <div className="editor-grid">
          <section className="editor-panel"><h1>Edit verified bullets</h1>
            {error && <p className="warning">{error}</p>}
            {pendingEdit && (
              <button className="secondary-button" type="button" onClick={confirmPendingEdit}>
                Confirm this new claim as information you provided
              </button>
            )}
            {session.bullets.map((bullet) => (
              <article className="review-card" key={bullet.id}>
                <textarea rows={4} value={bullet.text} onChange={(event) => editBullet(bullet.id, event.target.value)} />
                <p>{bullet.state === "verified" ? "Verified against confirmed facts" : "Kept close to source wording"}</p>
                <details><summary>Sources and checks</summary>
                  <ul>{Object.entries(bullet.gates).map(([name, gate]) => <li key={name}>{name}: {gate.passed ? "passed" : gate.reason}</li>)}</ul>
                  {session.facts.filter((fact) => bullet.factIds.includes(fact.id)).map((fact) => <p key={fact.id}>{fact.originalText}</p>)}
                </details>
              </article>
            ))}
            <button className="primary-button" type="button" onClick={() => {
              if (!session.resume) return;
              setSession({ ...session, resume: { ...session.resume, approved: true } });
              setScreen("download");
            }}>Approve resume</button>
          </section>
          <Preview session={session} />
        </div>
      )}

      {screen === "download" && (
        <div className="result">
          <Preview session={session} />
          <div className="action-bar">
            <button className="primary-button" type="button" onClick={() => void downloadDocx()}>Download DOCX</button>
            <button className="secondary-button" type="button" onClick={() => window.print()}>Print / Save PDF</button>
            <button className="text-button" type="button" onClick={() => void navigator.clipboard.writeText(JSON.stringify(resume, null, 2))}>Copy structured text</button>
            <button className="text-button" type="button" onClick={() => void clearAll()}>Delete everything</button>
          </div>
        </div>
      )}
    </main>
  );
}
