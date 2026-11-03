import type { SourceSegment } from "@/domain/v2";

const HEADING = /^(?:professional |work |technical )?(?:summary|experience|education|skills|projects|certifications|awards|volunteering|languages)$/i;

export function textToSegments(
  text: string,
  reader: SourceSegment["reader"]
): SourceSegment[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: crypto.randomUUID(),
      block: index,
      reader,
      text: line,
      order: index,
      kind: HEADING.test(line)
        ? "heading"
        : /^[-*•▪◦]\s*/.test(line)
          ? "bullet"
          : /https?:\/\/|www\.|linkedin\.com/i.test(line)
            ? "link"
            : "line"
    }));
}

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@%+./-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compareReaders(
  local: SourceSegment[],
  llama: SourceSegment[]
) {
  const localText = new Set(local.map((segment) => normalized(segment.text)));
  const llamaText = new Set(llama.map((segment) => normalized(segment.text)));
  const localOnly = local.filter((segment) => !llamaText.has(normalized(segment.text)));
  const llamaOnly = llama.filter((segment) => !localText.has(normalized(segment.text)));
  const disagreement = [...localOnly, ...llamaOnly].filter((segment) =>
    /(?:\b\d[\d,./%-]*\b|@|https?:\/\/|linkedin\.com)/i.test(segment.text)
  );
  return {
    localOnly: localOnly.map((segment) => segment.id),
    llamaOnly: llamaOnly.map((segment) => segment.id),
    disagreement: disagreement.map((segment) => segment.id)
  };
}
