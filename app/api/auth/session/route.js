import { readSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await readSession();
  if (!session) return Response.json({ ok: false, authenticated: false }, { status: 401 });
  return Response.json({ ok: true, authenticated: true, role: session.role || "user" });
}
