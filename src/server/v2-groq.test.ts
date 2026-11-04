import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Fact } from "@/domain/v2";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: mocks.create } };
  }
}));

import { draftVerifiedBullets, structureFacts } from "./v2-groq";

beforeEach(() => vi.stubEnv("GROQ_MODEL", "test-model"));

function fact(fields: Fact["fields"], originalText: string): Fact {
  return {
    id: "fact-1",
    type: "project",
    fields,
    originalText,
    sourceRefs: [{ segmentId: "s1", quote: originalText }],
    origin: "extracted",
    status: "confirmed",
    uncertaintyReasons: [],
    alternatives: [],
    attributes: { involvement: "contributed", quantities: [], outcome: "unknown" },
    parked: false,
    history: []
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("verified bullet writing", () => {
  it("accepts a bullet grounded in confirmed facts", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    mocks.create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        bullets: [{ text: "Built a Python service", factIds: ["fact-1"], alternatives: [] }]
      }) } }]
    });
    const result = await draftVerifiedBullets([
      fact({ name: "Service", technologies: ["Python"] }, "Built a Python service")
    ]);
    expect(result[0].state).toBe("verified");
  });

  it("rejects invented metrics after one retry and keeps source wording", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    mocks.create
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({
          bullets: [{ text: "Improved latency by 50%", factIds: ["fact-1"], alternatives: [] }]
        }) } }]
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({
          bullets: [{ text: "Reduced latency by 40%", factIds: ["fact-1"], alternatives: [] }]
        }) } }]
      });
    const result = await draftVerifiedBullets([
      fact({ name: "Service" }, "Built a service")
    ]);
    expect(result[0]).toMatchObject({
      text: "Built a service",
      state: "kept_as_written"
    });
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
});

describe("source-grounded fact construction", () => {
  it("keeps valid facts and exposes unsupported source as unplaced", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    mocks.create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        facts: [{
          type: "contact",
          fields: { name: "Taksh Vadaliya" },
          originalText: "Taksh Vadaliya",
          sourceRefs: [{ segmentId: "s1", quote: "Taksh Vadaliya" }],
          uncertaintyReasons: [],
          involvement: "unknown",
          outcome: "unknown"
        }, {
          type: "role",
          fields: { company: "Invented Corp", start: "2025" },
          originalText: "Invented Corp",
          sourceRefs: [{ segmentId: "s2", quote: "Worked at Real Corp in 2024" }],
          uncertaintyReasons: [],
          involvement: "unknown",
          outcome: "unknown"
        }]
      }) } }]
    });
    const result = await structureFacts([
      { id: "s1", block: 0, reader: "llamaparse", text: "Taksh Vadaliya", order: 0, kind: "line" },
      { id: "s2", block: 1, reader: "llamaparse", text: "Worked at Real Corp in 2024", order: 1, kind: "line" }
    ]);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "contact", fields: { name: "Taksh Vadaliya" } }),
      expect.objectContaining({
        type: "other",
        status: "uncertain",
        uncertaintyReasons: ["Unplaced source text"]
      })
    ]));
    expect(result.some((item) => item.fields.company === "Invented Corp")).toBe(false);
  });
});
