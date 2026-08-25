import { getConfiguredLoginAccounts, readSession } from "@/lib/server/auth";
import { secureJson } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await readSession();
  if (!session) return secureJson({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  if (session.role !== "admin") return secureJson({ ok: false, message: "관리자 권한이 필요합니다." }, { status: 403 });

  const reveal = new URL(request.url).searchParams.get("reveal") === "1";
  return secureJson({ ok: true, ...getConfiguredLoginAccounts({ includePasswords: reveal }) });
}
