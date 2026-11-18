import { readSession } from "@/lib/server/auth";
import { loadProjects } from "@/lib/server/projectStore";
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
        ...payload
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

    const file = await uploadGoogleDriveBackup(await loadProjects(), session.role);
    return secureJson({ ok: true, file });
  } catch (error) {
    console.error("[POST /api/backup/google-drive] failed:", error);
    return securityErrorResponse(error, "Google Drive 백업을 저장하지 못했습니다.");
  }
}
