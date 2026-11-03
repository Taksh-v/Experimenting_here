import { expect, it } from "vitest";
import { compareReaders, textToSegments } from "./segments";

it("segments headings, bullets, and links", () => {
  const segments = textToSegments(
    "EXPERIENCE\n- Built service\nhttps://example.com",
    "local"
  );
  expect(segments.map((segment) => segment.kind)).toEqual([
    "heading", "bullet", "link"
  ]);
});

it("flags important reader disagreements", () => {
  const local = textToSegments("Improved latency by 20%", "local");
  const llama = textToSegments("Improved latency by 30%", "llamaparse");
  expect(compareReaders(local, llama).disagreement).toHaveLength(2);
});
