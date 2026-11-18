import { createSession, validateLoginCode } from "@/lib/server/auth";
import { clearLoginAttempts, reserveLoginAttempt } from "@/lib/server/loginRateLimit";
import {
  assertSameOrigin,
  readJsonRequest,
  REQUEST_LIMITS,
  secureJson,
  securityErrorResponse
} from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readJsonRequest(request, { maxBytes: REQUEST_LIMITS.login });
    const rateLimit = await reserveLoginAttempt(request);
    if (!rateLimit.expiresAt) {
      return secureJson(
        { ok: false, message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    const code = String(body?.code || "");
    const result = validateLoginCode(code);
    if (!result.ok) {
      return secureJson(
        { ok: false, message: result.error },
        { status: result.configured === false ? 503 : 401 }
      );
    }
    await clearLoginAttempts(rateLimit);
    await createSession(result.role);
    return secureJson({ ok: true, role: result.role });
  } catch (error) {
    console.error("[POST /api/auth/login] failed:", error);
    return securityErrorResponse(error, "로그인을 처리하지 못했습니다.");
  }
}
