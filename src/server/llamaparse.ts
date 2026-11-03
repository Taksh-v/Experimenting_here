import { LlamaParseReader } from "llama-cloud-services/reader";

const EXTRACTION_INSTRUCTION = `
This document may be a resume, CV, portfolio, or project profile. Extract every
visible factual detail faithfully.
Preserve headings, names, contact details, job titles, employers, locations,
dates, bullets, projects, certifications, links, skills, and all numbers.
Keep the original reading order. Preserve tables as readable rows. Include
headers and footers when they contain resume information. Do not summarize,
rewrite, infer, correct, or invent anything. Ignore only decorative elements,
repeated page furniture, and obvious OCR noise.
`.trim();

export async function extractWithLlamaParse(
  bytes: Uint8Array,
  filename: string
): Promise<string | null> {
  const apiKey =
    process.env.LLAMA_CLOUD_API_KEY?.trim() ||
    process.env.LLAMAPARSE_API_KEY?.trim();
  if (!apiKey) return null;

  const reader = new LlamaParseReader({
    apiKey,
    resultType: "markdown",
    parsingInstruction: EXTRACTION_INSTRUCTION,
    doNotCache: true,
    skipDiagonalText: false,
    preserve_very_small_text: true,
    checkInterval: 1,
    maxCheckInterval: 5,
    maxTimeout: 120,
    maxErrorCount: 3,
    verbose: false,
    high_res_ocr: true,
    layout_aware: true,
    auto_mode_trigger_on_image_in_page: true
  });

  const documents = await reader.loadDataAsContent(bytes.slice(), filename);
  const text = documents
    .map((document) => document.text)
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return text.length >= 40 ? text : null;
}
