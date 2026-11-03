import type { FidelityReport, Resume } from "@/domain/resume";

const ignoredWords = new Set([
  "and", "the", "for", "with", "from", "that", "this", "into", "your",
  "our", "was", "were", "are", "but", "not", "all", "resume", "page"
]);

function tokens(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .replace(/https?:\/\//g, "")
        .match(/[a-z0-9+#.@-]{3,}/g)
        ?.filter((token) => !ignoredWords.has(token)) ?? []
    )
  ];
}

export function fidelityReport(source: string, resume: Resume): FidelityReport {
  const corpus = JSON.stringify(resume).toLowerCase();
  const lines = source
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter((line) => line.length >= 4);

  const uncovered: string[] = [];
  let represented = 0;
  for (const line of lines) {
    const lineTokens = tokens(line);
    if (lineTokens.length === 0) {
      represented += 1;
      continue;
    }
    const matches = lineTokens.filter((token) => corpus.includes(token)).length;
    if (matches / lineTokens.length >= 0.55) represented += 1;
    else uncovered.push(line);
  }

  return {
    sourceLines: lines.length,
    representedLines: represented,
    coverage: lines.length ? Math.round((represented / lines.length) * 100) : 0,
    needsReview: uncovered.slice(0, 20)
  };
}
