import { createHash } from "node:crypto";
import { AppError } from "./errors";

type GuardOptions = {
  sessionId: string;
  action: "resume_start" | "groq";
  turnstileToken?: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value && process.env.NODE_ENV === "production") {
    throw new AppError("PROVIDER_ERROR", name + " is not configured.", 503);
  }
  return value ?? "";
}

function requiredOne(names: string[], label: string) {
  const value = names
    .map((name) => process.env[name]?.trim())
    .find((candidate): candidate is string => Boolean(candidate));
  if (!value && process.env.NODE_ENV === "production") {
    throw new AppError("PROVIDER_ERROR", label + " is not configured.", 503);
  }
  return value ?? "";
}

function limit(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : fallback;
}

async function verifyTurnstile(request: Request, token: string | undefined) {
  const secret = required("TURNSTILE_SECRET_KEY");
  if (!secret && process.env.NODE_ENV !== "production") return;
  if (!token) throw new AppError("INVALID_REQUEST", "Complete the security check.", 403);
  const body = new URLSearchParams({ secret, response: token });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) body.set("remoteip", ip);
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body, signal: AbortSignal.timeout(8_000) }
  );
  const result = (await response.json()) as { success?: boolean };
  if (!result.success) {
    throw new AppError("INVALID_REQUEST", "The security check failed.", 403);
  }
}

function dailyIpKey(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const salt = required("RATE_LIMIT_SALT");
  return createHash("sha256").update(day + ":" + salt + ":" + ip).digest("hex");
}

async function increment(keys: string[]) {
  const url = requiredOne(
    ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"],
    "Upstash Redis REST URL"
  );
  const token = requiredOne(
    ["UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"],
    "Upstash Redis REST token"
  );
  if ((!url || !token) && process.env.NODE_ENV !== "production") {
    return keys.map(() => 1);
  }
  const commands = keys.flatMap((key) => [
    ["INCR", key],
    ["EXPIRE", key, 86_400]
  ]);
  const response = await fetch(url + "/pipeline", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) {
    throw new AppError("PROVIDER_ERROR", "Rate-limit service is unavailable.", 503);
  }
  const values = (await response.json()) as Array<{ result?: number }>;
  return values.filter((_, index) => index % 2 === 0).map((item) => Number(item.result ?? 0));
}

export async function guardProviderRequest(request: Request, options: GuardOptions) {
  if (options.action === "resume_start") {
    await verifyTurnstile(request, options.turnstileToken);
  }
  if (process.env.RATE_LIMIT_ENABLED?.trim().toLowerCase() !== "true") {
    return;
  }
  const prefix = "evolving-resume:" + new Date().toISOString().slice(0, 10);
  const keys =
    options.action === "resume_start"
      ? [
          prefix + ":global-resumes",
          prefix + ":ip:" + dailyIpKey(request),
          prefix + ":session:" + options.sessionId + ":resume_start"
        ]
      : [
          prefix + ":global-groq",
          prefix + ":ip-groq:" + dailyIpKey(request),
          prefix + ":session:" + options.sessionId + ":groq"
        ];
  const counts = await increment(keys);
  const [globalCount = 0, ipCount = 0, sessionCount = 0] = counts;
  const globalLimit = limit("BETA_DAILY_RESUME_LIMIT", 25);
  if (options.action === "resume_start" && globalCount > globalLimit) {
    throw new AppError("PROVIDER_ERROR", "The free beta has reached today’s capacity.", 429);
  }
  if (
    options.action === "resume_start" &&
    ipCount > limit("BETA_DAILY_IP_RESUME_LIMIT", 10)
  ) {
    throw new AppError("INVALID_REQUEST", "This device has reached today’s resume limit.", 429);
  }
  if (options.action === "groq" && sessionCount > limit("BETA_SESSION_GROQ_LIMIT", 8)) {
    throw new AppError("INVALID_REQUEST", "This session has reached its writing limit.", 429);
  }
  if (options.action === "groq" && ipCount > limit("BETA_DAILY_IP_GROQ_LIMIT", 24)) {
    throw new AppError("INVALID_REQUEST", "This device has reached today’s AI limit.", 429);
  }
  if (
    options.action === "groq" &&
    globalCount > limit("BETA_DAILY_GROQ_LIMIT", 200)
  ) {
    throw new AppError("PROVIDER_ERROR", "The free beta has reached today’s AI capacity.", 429);
  }
}
