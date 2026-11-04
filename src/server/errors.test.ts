import { expect, it } from "vitest";
import { z } from "zod";
import { publicError } from "./errors";

it("reports request validation paths without including submitted values", () => {
  const schema = z.object({ segments: z.array(z.object({ text: z.string() })) });
  const parsed = schema.safeParse({ segments: [{ text: 42 }] });
  if (parsed.success) throw new Error("Expected validation to fail");

  expect(publicError(parsed.error)).toEqual({
    status: 400,
    body: {
      error: "The submitted resume data is invalid at segments.0.text.",
      code: "INVALID_REQUEST"
    }
  });
});

it("classifies malformed JSON as an invalid request", () => {
  expect(publicError(new SyntaxError("private input"))).toEqual({
    status: 400,
    body: {
      error: "The request body is not valid JSON.",
      code: "INVALID_REQUEST"
    }
  });
});
