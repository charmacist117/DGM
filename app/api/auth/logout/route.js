import { clearSession } from "@/lib/server/auth";
import { assertSameOrigin, secureJson, securityErrorResponse } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    assertSameOrigin(request);
    await clearSession();
    return secureJson({ ok: true });
  } catch (error) {
    return securityErrorResponse(error, "로그아웃을 처리하지 못했습니다.");
  }
}
