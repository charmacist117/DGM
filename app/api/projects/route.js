import { loadProjects, saveProjects } from "@/lib/server/projectStore";
import { readSession } from "@/lib/server/auth";
import { validateFullBackupData } from "@/lib/pms/fullBackup";
import {
  assertSameOrigin,
  readJsonRequest,
  REQUEST_LIMITS,
  secureJson,
  securityErrorResponse
} from "@/lib/server/security";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await readSession();
    if (!session) {
      return secureJson({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }
    const result = await loadProjects();
    return secureJson({
      ok: true,
      projects: result.projects,
      adminLogs: result.adminLogs,
      supplyPriceItems: result.supplyPriceItems,
      marketAnalysisDefaults: result.marketAnalysisDefaults,
      updatedAt: result.updatedAt,
      source: result.source
    });
  } catch (error) {
    console.error("[GET /api/projects] failed:", error);
    return secureJson({ ok: false, message: "프로젝트 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    assertSameOrigin(request);
    const session = await readSession();
    if (!session) {
      return secureJson({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }
    const body = await readJsonRequest(request, { maxBytes: REQUEST_LIMITS.projects });
    if (!body || !Array.isArray(body.projects)) {
      return secureJson({ ok: false, message: "projects 배열이 필요합니다." }, { status: 400 });
    }

    let adminLogs = Array.isArray(body.adminLogs) ? body.adminLogs : null;
    let supplyPriceItems = Array.isArray(body.supplyPriceItems) ? body.supplyPriceItems : null;
    let marketAnalysisDefaults = body.marketAnalysisDefaults && typeof body.marketAnalysisDefaults === "object"
      ? body.marketAnalysisDefaults
      : null;
    let current = null;
    if (adminLogs === null || supplyPriceItems === null || marketAnalysisDefaults === null || session.role !== "admin") {
      current = await loadProjects();
      if (adminLogs === null) {
        adminLogs = Array.isArray(current.adminLogs) ? current.adminLogs : [];
      }
      if (supplyPriceItems === null) {
        supplyPriceItems = Array.isArray(current.supplyPriceItems) ? current.supplyPriceItems : [];
      }
      if (marketAnalysisDefaults === null) {
        marketAnalysisDefaults = current.marketAnalysisDefaults;
      }
    }

    if (session.role !== "admin") {
      const protectedNotices = (current.adminLogs || []).filter((log) => log?.type === "dashboard_change_notice");
      adminLogs = [
        ...(adminLogs || []).filter((log) => log?.type !== "dashboard_change_notice"),
        ...protectedNotices
      ];

      const submittedSupplyIds = new Set((supplyPriceItems || []).map((item) => String(item?.id ?? "")));
      const protectedDeletedItems = (current.supplyPriceItems || []).filter((item) => (
        !submittedSupplyIds.has(String(item?.id ?? ""))
      ));
      supplyPriceItems = [...(supplyPriceItems || []), ...protectedDeletedItems];
    }

    const validated = validateFullBackupData({
      projects: body.projects,
      adminLogs,
      supplyPriceItems,
      marketAnalysisDefaults
    });
    const result = await saveProjects(
      validated.projects,
      validated.adminLogs,
      validated.supplyPriceItems,
      validated.marketAnalysisDefaults
    );
    return secureJson({ ok: true, updatedAt: result.updatedAt });
  } catch (error) {
    console.error("[PUT /api/projects] failed:", error);
    return securityErrorResponse(error, "프로젝트 데이터를 저장하지 못했습니다.");
  }
}
