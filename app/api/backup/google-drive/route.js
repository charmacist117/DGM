import { readSession } from "@/lib/server/auth";
import {
  assertSameOrigin,
  readJsonRequest,
  REQUEST_LIMITS,
  secureJson,
  securityErrorResponse
} from "@/lib/server/security";
import {
  downloadGoogleDriveBackup,
  getGoogleDriveBackupStatus,
  listGoogleDriveBackups,
  uploadGoogleDriveBackup
} from "@/lib/server/googleDriveBackup";

export const runtime = "nodejs";

function requireAdmin(session) {
  if (!session) return secureJson({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  if (session.role !== "admin") return secureJson({ ok: false, message: "관리자 권한이 필요합니다." }, { status: 403 });
  return null;
}

function normalizeBackupPayload(payload) {
  if (Array.isArray(payload)) {
    return { projects: payload, adminLogs: [] };
  }
  if (payload && typeof payload === "object") {
    return {
      projects: Array.isArray(payload.projects) ? payload.projects : [],
      adminLogs: Array.isArray(payload.adminLogs) ? payload.adminLogs : []
    };
  }
  return { projects: [], adminLogs: [] };
}

export async function GET(request) {
  const session = await readSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";

    if (action === "status") {
      return secureJson({ ok: true, ...getGoogleDriveBackupStatus() });
    }

    if (action === "list") {
      const status = getGoogleDriveBackupStatus();
      if (!status.configured) {
        return secureJson({ ok: true, files: [], ...status });
      }
      const files = await listGoogleDriveBackups(Number(searchParams.get("limit") || 30));
      return secureJson({ ok: true, files, ...status });
    }

    if (action === "download") {
      const fileId = searchParams.get("fileId") || "";
      const payload = await downloadGoogleDriveBackup(fileId);
      return secureJson({
        ok: true,
        ...normalizeBackupPayload(payload),
        raw: payload
      });
    }

    return secureJson({ ok: false, message: "지원하지 않는 백업 요청입니다." }, { status: 400 });
  } catch (error) {
    console.error("[GET /api/backup/google-drive] failed:", error);
    return secureJson({ ok: false, message: "Google Drive 백업을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const session = await readSession();
    const denied = requireAdmin(session);
    if (denied) return denied;
    const body = await readJsonRequest(request, { maxBytes: REQUEST_LIMITS.backup });
    const action = body?.action || "upload";

    if (action !== "upload") {
      return secureJson({ ok: false, message: "지원하지 않는 백업 요청입니다." }, { status: 400 });
    }

    const projects = Array.isArray(body?.projects) ? body.projects : null;
    const adminLogs = Array.isArray(body?.adminLogs) ? body.adminLogs : [];
    if (!projects) {
      return secureJson({ ok: false, message: "projects 배열이 필요합니다." }, { status: 400 });
    }

    const file = await uploadGoogleDriveBackup(projects, adminLogs, session.role || "user");
    return secureJson({ ok: true, file });
  } catch (error) {
    console.error("[POST /api/backup/google-drive] failed:", error);
    return securityErrorResponse(error, "Google Drive 백업을 저장하지 못했습니다.");
  }
}
