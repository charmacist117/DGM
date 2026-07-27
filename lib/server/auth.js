import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pms_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const MIN_SECRET_BYTES = 32;
const ALLOWED_ROLES = new Set(["admin", "user"]);

function getSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function hasValidSecret() {
  return Buffer.byteLength(getSecret(), "utf8") >= MIN_SECRET_BYTES;
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function encode(payload) {
  if (!hasValidSecret()) throw new Error("AUTH_SECRET must be at least 32 bytes.");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

function decode(token) {
  if (!hasValidSecret() || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !/^[a-f0-9]{64}$/i.test(signature || "")) return null;
  const expected = sign(body);
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const now = Date.now();
    if (!ALLOWED_ROLES.has(parsed?.role)) return null;
    if (!Number.isFinite(parsed?.iat) || !Number.isFinite(parsed?.exp)) return null;
    if (parsed.iat > now + 60_000 || parsed.exp <= now || parsed.exp - parsed.iat > SESSION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeCodeEqual(submitted, configured) {
  const left = crypto.createHash("sha256").update(String(submitted || ""), "utf8").digest();
  const right = crypto.createHash("sha256").update(String(configured || ""), "utf8").digest();
  return crypto.timingSafeEqual(left, right);
}

export function validateLoginCode(code) {
  const adminCode = process.env.APP_ADMIN_PASSWORD || "";
  const userCode = process.env.APP_USER_PASSWORD || "";
  if (!hasValidSecret()) return { ok: false, configured: false, error: "서버 인증 설정을 확인해주세요." };
  if (!adminCode && !userCode) return { ok: false, error: "APP_ADMIN_PASSWORD 또는 APP_USER_PASSWORD를 설정해주세요." };
  if (adminCode && safeCodeEqual(code, adminCode)) return { ok: true, role: "admin" };
  if (userCode && safeCodeEqual(code, userCode)) return { ok: true, role: "user" };
  return { ok: false, error: "인증코드가 올바르지 않습니다." };
}

export async function createSession(role = "user") {
  if (!ALLOWED_ROLES.has(role)) throw new Error("Invalid session role.");
  const now = Date.now();
  const token = encode({
    role,
    iat: now,
    exp: now + SESSION_TTL_MS,
    nonce: crypto.randomBytes(16).toString("base64url")
  });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    priority: "high"
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high"
  });
}

export async function readSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return decode(token);
}
