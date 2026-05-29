import { clearSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  return Response.json({ ok: true });
}
