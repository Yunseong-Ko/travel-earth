import { NextResponse } from "next/server";
import { runRecommendationEngine } from "@/lib/recommendation/engine";
import { validateRecommendationRequest } from "@/lib/recommendation/types";
import {
  activeViewers,
  intentFingerprint,
  recordSearch,
} from "@/lib/social/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        message: "Invalid JSON payload.",
      },
      { status: 400 },
    );
  }

  const validated = validateRecommendationRequest(payload);
  if (!validated.ok) {
    return NextResponse.json(
      {
        message: "Validation failed.",
        errors: validated.errors,
      },
      { status: 400 },
    );
  }

  try {
    const response = await runRecommendationEngine(validated.value);
    const searchCount = recordSearch(intentFingerprint(validated.value));
    return NextResponse.json(
      {
        ...response,
        social: { search_count: searchCount, viewers: activeViewers() },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Recommendation engine is unavailable.";
    return NextResponse.json(
      {
        message,
      },
      { status: 503 },
    );
  }
}

