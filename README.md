# Evolving Resume

A focused resume ingestion pipeline: upload a PDF or DOCX, extract every
visible detail, structure it with Groq, ask four factual questions, and render
an ATS-safe resume.

## Architecture

1. The browser validates the file type and 8 MB limit.
2. The server verifies the file signature.
3. LlamaParse performs OCR and layout-aware extraction when
   `LLAMA_CLOUD_API_KEY` is configured.
4. If LlamaParse is unavailable or returns too little text, the serverless
   PDF.js build from `unpdf` or the local
   DOCX extractor reads the text. DOCX headers and footers are included because
   resumes often place contact details there.
5. Groq structures the extracted content into a Zod-validated schema. Unknown
   headings are kept in `additionalSections` rather than discarded.
6. A deterministic heading parser is used when Groq is not configured.
7. A fidelity pass compares source lines with the structured result and flags
   lines that need review.
8. The browser presents an editable review workspace with project editing,
   missing-information questions, quality scoring, and a polished resume view.
9. Refinement can change the headline, skills, summary, and bullets. Employer,
   job, date, education, certification, and project identity fields are restored
   from the parsed source after the model call. New unsupported numbers cause
   the result to be rejected.
10. The reviewed resume can be exported as DOCX or printed to PDF from the
    browser.

Resume data stays in browser memory for the current flow. There is no database,
account, portfolio, job tracker, or pricing code.

The implementation adopts MIT-licensed architectural ideas from
[Reactive Resume](https://github.com/reactive-resume/reactive-resume) and
[RenderCV](https://github.com/rendercv/rendercv): strict schema validation,
provider-output sanitization, faithful header/footer extraction, and preserving
source identity fields. No AGPL OpenResume source is copied.

## Run locally

Node.js 24 is required for the worker-free PDF parser used by Vercel.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Add `LLAMA_CLOUD_API_KEY` and `GROQ_API_KEY` to the server environment.
They must never use a `NEXT_PUBLIC_` prefix.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
