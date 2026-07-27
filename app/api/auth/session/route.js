import { readSession } from "@/lib/server/auth";
import { secureJson } from "@/lib/server/security";

export const runtime = "nodejs";

export async function GET() {
  const session = await readSession();
  if (!session) return secureJson({ ok: false, authenticated: false }, { status: 401 });
  return secureJson({ ok: true, authenticated: true, role: session.role || "user" });
}
