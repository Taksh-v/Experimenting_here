import { unzipSync } from "fflate";
import { AppError } from "./errors";

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 60;
const MIN_TEXT_LENGTH = 40;

export type ResumeFileKind = "pdf" | "docx";

export function validateUpload(file: File, bytes: Uint8Array): ResumeFileKind {
  if (file.size === 0 || bytes.length === 0) {
    throw new AppError("EMPTY_FILE", "The file is empty.");
  }
  if (file.size > MAX_FILE_BYTES || bytes.length > MAX_FILE_BYTES) {
    throw new AppError("FILE_TOO_LARGE", "The file is larger than 8 MB.");
  }

  const lowerName = file.name.toLowerCase();
  const isPdf =
    lowerName.endsWith(".pdf") &&
    bytes.length >= 5 &&
    new TextDecoder("ascii").decode(bytes.slice(0, 5)) === "%PDF-";
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08));

  if (isPdf) return "pdf";
  if (lowerName.endsWith(".docx") && isZip) return "docx";
  throw new AppError(
    "UNSUPPORTED_FILE",
    "Upload a valid PDF or DOCX file."
  );
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type PdfTextItem = {
  str: string;
  transform?: number[];
  x?: number;
  y?: number;
  width: number;
  height: number;
  hasEOL?: boolean;
};

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "str" in value &&
    typeof (value as PdfTextItem).str === "string" &&
    (Array.isArray((value as PdfTextItem).transform) ||
      (typeof (value as PdfTextItem).x === "number" &&
        typeof (value as PdfTextItem).y === "number"))
  );
}

function pageText(values: unknown[]) {
  const rows: Array<{ y: number; items: Array<PdfTextItem & { x: number }> }> = [];

  for (const item of values) {
    if (!isPdfTextItem(item)) continue;
    const x = item.x ?? item.transform?.[4] ?? 0;
    const y = item.y ?? item.transform?.[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ ...item, x });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      let line = "";
      let right = 0;
      for (const item of sorted) {
        const gap = item.x - right;
        const height = Math.max(item.height || 10, 1);
        if (line && gap > height * 0.25 && !/\s$/.test(line)) {
          line += gap > height * 1.5 ? "  " : " ";
        }
        line += item.str;
        right = Math.max(right, item.x + (item.width || 0));
      }
      return line.trim();
    })
    .filter(Boolean)
    .join("\n");
}

async function extractPdf(bytes: Uint8Array) {
  try {
    const { extractTextItems, getDocumentProxy } = await import("unpdf");
    const document = await getDocumentProxy(bytes.slice(), {
      maxImageSize: 16_777_216
    });
    try {
      if (document.numPages > MAX_PAGES) {
        throw new AppError(
          "INVALID_FILE",
          `The PDF has more than ${MAX_PAGES} pages.`
        );
      }

      const extraction = extractTextItems(document);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new AppError("UNREADABLE_FILE", "PDF reading timed out.")),
          30_000
        );
      });
      const { items } = await Promise.race([extraction, timeout]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      const pages = items.map((page) => pageText(page));
      return normalizeExtractedText(pages.join("\n\n"));
    } finally {
      await document.cleanup();
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.warn("Local PDF extraction failed", {
      message: error instanceof Error ? error.message : "Unknown PDF error"
    });
    throw new AppError(
      "UNREADABLE_FILE",
      "The PDF is damaged, password-protected, or unreadable."
    );
  }
}

const DOCX_PART = /^word\/(document|header\d*|footer\d*)\.xml$/;
const MAX_DOCX_PART_BYTES = 20 * 1024 * 1024;
const MAX_DOCX_TOTAL_BYTES = 40 * 1024 * 1024;

function decodeXmlText(xml: string) {
  return xml
    .replace(/<w:del\b[\s\S]*?<\/w:del>/g, "")
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, value: string) =>
      String.fromCodePoint(Number.parseInt(value, 10))
    );
}

function extractDocx(bytes: Uint8Array) {
  let inflated = 0;
  try {
    const files = unzipSync(bytes, {
      filter(info) {
        if (!DOCX_PART.test(info.name)) return false;
        if (info.originalSize > MAX_DOCX_PART_BYTES) {
          throw new AppError("INVALID_FILE", "The DOCX content is too large.");
        }
        inflated += info.originalSize;
        if (inflated > MAX_DOCX_TOTAL_BYTES) {
          throw new AppError("INVALID_FILE", "The DOCX content is too large.");
        }
        return true;
      }
    });

    if (!files["word/document.xml"]) {
      throw new AppError("INVALID_FILE", "The DOCX document content is missing.");
    }

    const decoder = new TextDecoder();
    const names = Object.keys(files).sort((a, b) => {
      const rank = (name: string) =>
        name.includes("header") ? 0 : name.includes("document") ? 1 : 2;
      return rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true });
    });
    return normalizeExtractedText(
      names
        .map((name) => decodeXmlText(decoder.decode(files[name])))
        .filter(Boolean)
        .join("\n\n")
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("UNREADABLE_FILE", "The DOCX file is damaged or unreadable.");
  }
}

export async function extractLocalText(
  kind: ResumeFileKind,
  bytes: Uint8Array
) {
  const text = kind === "pdf" ? await extractPdf(bytes) : extractDocx(bytes);
  if (text.length < MIN_TEXT_LENGTH) {
    throw new AppError(
      "UNREADABLE_FILE",
      "Very little text was found. Upload a text-based PDF or a readable DOCX file."
    );
  }
  return text;
}
