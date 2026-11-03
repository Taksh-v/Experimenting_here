# Evolving Resume

A source-grounded resume builder for the Indian hiring market. The v2 workflow
keeps extraction provenance, requires the user to confirm facts, drafts from
confirmed evidence only, and renders one ATS-safe resume to PDF or DOCX.

## Architecture

1. The browser keeps a versioned session in IndexedDB until the user deletes it.
2. The server validates the 4 MB / 4-page first-release limits and signatures.
3. Every PDF runs through LlamaParse as a signed, browser-polled job. Local PDF
   extraction supplies exact text for comparison and a guarded digital-PDF
   fallback. DOCX uses the local extractor.
4. Groq proposes typed facts with verbatim source references. Deterministic
   checks reject unsupported values; unmapped source text remains visible.
5. The user confirms, edits, parks, or rejects facts before they can be used.
6. The product captures an India-market target, asks up to eight evidence
   questions, and builds a deterministic one- or two-page plan.
7. Groq drafts cited bullets. Deterministic gates check facts, numbers, dates,
   strong verbs, outcomes, scope, and form; failed bullets keep source wording.
8. A structured editor shows sources and checks. One approved Resume object
   drives DOCX and browser PDF output.

There is no account or resume database. Redis contains rate-limit counters only;
it never contains resume content.

The implementation adopts MIT-licensed architectural ideas from
[Reactive Resume](https://github.com/reactive-resume/reactive-resume) and
[RenderCV](https://github.com/rendercv/rendercv): strict schema validation,
provider-output sanitization, faithful header/footer extraction, and preserving
source identity fields. No AGPL OpenResume source is copied.

## Run locally

Node.js 24 is required.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Add `LLAMA_CLOUD_API_KEY` and `GROQ_API_KEY` to the server environment.
Also configure the signed-job, Turnstile, and Upstash variables listed in
`.env.example`. Provider credentials must never use a `NEXT_PUBLIC_` prefix.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
