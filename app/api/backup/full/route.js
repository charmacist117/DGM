import { createFullBackup, parseFullBackup } from "@/lib/pms/fullBackup";
import { readSession } from "@/lib/server/auth";
import { loadProjects, saveProjects } from "@/lib/server/projectStore";
import {
  assertSameOrigin,
  readJsonRequest,
  RequestSecurityError,
  REQUEST_LIMITS,
  secureJson,
  securityErrorResponse
} from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAdmin(session) {
  if (!session) return secureJson({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  if (session.role !== "admin") return secureJson({ ok: false, message: "관리자 권한이 필요합니다." }, { status: 403 });
  return null;
}

function backupFileName() {
  return `PB_full_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function GET() {
  try {
    const denied = requireAdmin(await readSession());
    if (denied) return denied;

    const stored = await loadProjects();
    const backup = createFullBackup({
      projects: stored.projects,
      adminLogs: stored.adminLogs,
      supplyPriceItems: stored.supplyPriceItems,
      contractRecords: stored.contractRecords,
      marketAnalysisDefaults: stored.marketAnalysisDefaults
    }, { source: stored.source || "online-database" });

    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backupFileName()}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("[GET /api/backup/full] failed:", error);
    return secureJson({ ok: false, message: "전체 백업 파일을 만들지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const denied = requireAdmin(await readSession());
    if (denied) return denied;

    const body = await readJsonRequest(request, { maxBytes: REQUEST_LIMITS.backup });
    if (typeof body?.revision !== "string" || !body.revision) {
      throw new RequestSecurityError("최신 서버 데이터를 불러온 뒤 복원해 주세요.", 409, "STALE_PROJECTS");
    }
    const parsed = parseFullBackup(body?.backup || body, { allowLegacy: true });
    const saved = await saveProjects(
      parsed.data.projects,
      parsed.data.adminLogs,
      parsed.data.supplyPriceItems,
      parsed.data.marketAnalysisDefaults,
      parsed.data.contractRecords,
      body.revision
    );

    return secureJson({ ok: true, updatedAt: saved.updatedAt, revision: saved.revision, summary: parsed.summary, legacy: parsed.legacy });
  } catch (error) {
    console.error("[POST /api/backup/full] failed:", error);
    return securityErrorResponse(error, "전체 백업 파일을 복원하지 못했습니다.", 400);
  }
}
