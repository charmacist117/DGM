import { createSession, validateLoginCode } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const code = String(body?.code || "");
    const result = validateLoginCode(code);
    if (!result.ok) {
      return Response.json({ ok: false, message: result.error }, { status: 401 });
    }
    await createSession(result.role);
    return Response.json({ ok: true, role: result.role });
  } catch (error) {
    return Response.json({ ok: false, message: String(error?.message || error) }, { status: 500 });
  }
}
