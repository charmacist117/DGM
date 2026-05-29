import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pms_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function getSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function encode(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

function decode(token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = sign(body);
  if (signature !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed?.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function validateLoginCode(code) {
  const adminCode = process.env.APP_ADMIN_PASSWORD || "";
  const userCode = process.env.APP_USER_PASSWORD || "";
  if (!getSecret()) return { ok: false, error: "AUTH_SECRET 환경변수가 필요합니다." };
  if (!adminCode && !userCode) return { ok: false, error: "APP_ADMIN_PASSWORD 또는 APP_USER_PASSWORD를 설정해주세요." };
  if (adminCode && code === adminCode) return { ok: true, role: "admin" };
  if (userCode && code === userCode) return { ok: true, role: "user" };
  return { ok: false, error: "인증코드가 올바르지 않습니다." };
}

export async function createSession(role = "user") {
  const token = encode({ role, exp: Date.now() + SESSION_TTL_MS });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function readSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return decode(token);
}
