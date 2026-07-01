import { NextResponse } from "next/server";
import { heartbeat } from "@/lib/social/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let sessionId = "";
  try {
    const body = (await request.json()) as { session_id?: unknown };
    sessionId = typeof body.session_id === "string" ? body.session_id : "";
  } catch {
    sessionId = "";
  }

  if (!sessionId) {
    return NextResponse.json({ message: "session_id required." }, { status: 400 });
  }

  const viewers = heartbeat(sessionId);
  return NextResponse.json({ viewers }, { status: 200 });
}
