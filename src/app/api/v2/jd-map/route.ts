import { NextResponse } from "next/server";
import { z } from "zod";
import { factSchema, goalSchema } from "@/domain/v2";
import { publicError } from "@/server/errors";
import { guardProviderRequest } from "@/server/beta-guard";
import { mapJobDescription } from "@/server/v2-groq";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  goal: goalSchema,
  facts: z.array(factSchema)
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    await guardProviderRequest(request, { sessionId: body.sessionId, action: "groq" });
    return NextResponse.json({
      requirements: await mapJobDescription(body.goal, body.facts)
    });
  } catch (error) {
    const response = publicError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
