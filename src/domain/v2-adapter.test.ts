import { expect, it } from "vitest";
import { emptySessionV2, type Fact } from "./v2";
import { sessionToLegacyResume } from "./v2-adapter";

function contact(fields: Fact["fields"]): Fact {
  return {
    id: crypto.randomUUID(),
    type: "contact",
    fields,
    originalText: String(Object.values(fields)[0]),
    sourceRefs: [{ segmentId: "s", quote: String(Object.values(fields)[0]) }],
    origin: "extracted",
    status: "confirmed",
    uncertaintyReasons: [],
    alternatives: [],
    attributes: { involvement: "unknown", quantities: [], outcome: "unknown" },
    parked: false,
    history: []
  };
}

it("merges contact facts instead of losing fields", () => {
  const session = {
    ...emptySessionV2(),
    facts: [
      contact({ name: "Taksh Vadaliya" }),
      contact({ email: "taksh@example.com" }),
      contact({ phone: "+91 12345 67890" })
    ]
  };
  const resume = sessionToLegacyResume(session);
  expect(resume.contact).toMatchObject({
    name: "Taksh Vadaliya",
    email: "taksh@example.com",
    phone: "+91 12345 67890"
  });
});
