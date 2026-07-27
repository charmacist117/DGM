const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const loginAttempts = globalThis.__pmsLoginAttempts || new Map();

globalThis.__pmsLoginAttempts = loginAttempts;

export const REQUEST_LIMITS = Object.freeze({
  login: 4 * 1024,
  settings: 16 * 1024,
  projects: 25 * 1024 * 1024,
  backup: 25 * 1024 * 1024
});

export class RequestSecurityError extends Error {
  constructor(message, status = 400, code = "INVALID_REQUEST") {
    super(message);
    this.name = "RequestSecurityError";
    this.status = status;
    this.code = code;
  }
}

function firstHeaderValue(value) {
  return String(value || "").split(",")[0].trim();
}

function requestClientKey(request) {
  return firstHeaderValue(request.headers.get("x-forwarded-for"))
    || firstHeaderValue(request.headers.get("x-real-ip"))
    || "unknown";
}

function pruneLoginAttempts(now = Date.now()) {
  for (const [key, entry] of loginAttempts.entries()) {
    if (!entry || now - entry.firstFailureAt >= LOGIN_WINDOW_MS) loginAttempts.delete(key);
  }
}

export function getLoginRateLimit(request) {
  const now = Date.now();
  pruneLoginAttempts(now);
  const key = requestClientKey(request);
  const entry = loginAttempts.get(key);
  if (!entry || entry.failures < LOGIN_MAX_FAILURES) return { allowed: true, key, retryAfter: 0 };
  const retryAfter = Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - entry.firstFailureAt)) / 1000));
  return { allowed: false, key, retryAfter };
}

export function recordLoginFailure(key) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.firstFailureAt >= LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { failures: 1, firstFailureAt: now });
    return;
  }
  loginAttempts.set(key, { ...current, failures: current.failures + 1 });
}

export function clearLoginFailures(key) {
  loginAttempts.delete(key);
}

export function assertSameOrigin(request) {
  const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") {
    throw new RequestSecurityError("허용되지 않은 외부 요청입니다.", 403, "CROSS_SITE_REQUEST");
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set([requestUrl.origin]);
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || firstHeaderValue(request.headers.get("host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "");
  if (host) allowedOrigins.add(`${protocol}://${host}`);

  if (!allowedOrigins.has(origin)) {
    throw new RequestSecurityError("요청 출처를 확인할 수 없습니다.", 403, "INVALID_ORIGIN");
  }
}

export async function readJsonRequest(request, { maxBytes = REQUEST_LIMITS.settings } = {}) {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new RequestSecurityError("JSON 형식의 요청만 허용됩니다.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestSecurityError("요청 데이터가 허용 용량을 초과했습니다.", 413, "PAYLOAD_TOO_LARGE");
  }

  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new RequestSecurityError("요청 데이터가 허용 용량을 초과했습니다.", 413, "PAYLOAD_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new RequestSecurityError("JSON 요청 형식이 올바르지 않습니다.", 400, "INVALID_JSON");
  }
}

export function secureJson(data, { status = 200, headers = {} } = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

export function securityErrorResponse(error, fallbackMessage = "요청을 처리하지 못했습니다.", fallbackStatus = 500) {
  if (error instanceof RequestSecurityError) {
    return secureJson(
      { ok: false, message: error.message, code: error.code },
      { status: error.status }
    );
  }
  return secureJson({ ok: false, message: fallbackMessage }, { status: fallbackStatus });
}
