import { loadProjects, saveProjects } from "@/lib/server/projectStore";
import { readSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await readSession();
    if (!session) {
      return Response.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }
    const result = await loadProjects();
    return Response.json({
      ok: true,
      projects: result.projects,
      adminLogs: result.adminLogs,
      supplyPriceItems: result.supplyPriceItems,
      updatedAt: result.updatedAt,
      source: result.source
    });
  } catch (error) {
    console.error("[GET /api/projects] failed:", error);
    return Response.json(
      { ok: false, message: "프로젝트 데이터를 불러오지 못했습니다.", error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const session = await readSession();
    if (!session) {
      return Response.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }
    const body = await request.json();
    if (!body || !Array.isArray(body.projects)) {
      return Response.json({ ok: false, message: "projects 배열이 필요합니다." }, { status: 400 });
    }

    let adminLogs = Array.isArray(body.adminLogs) ? body.adminLogs : null;
    let supplyPriceItems = Array.isArray(body.supplyPriceItems) ? body.supplyPriceItems : null;
    let current = null;
    if (adminLogs === null || supplyPriceItems === null || session.role !== "admin") {
      current = await loadProjects();
      if (adminLogs === null) {
        adminLogs = Array.isArray(current.adminLogs) ? current.adminLogs : [];
      }
      if (supplyPriceItems === null) {
        supplyPriceItems = Array.isArray(current.supplyPriceItems) ? current.supplyPriceItems : [];
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

    const result = await saveProjects(body.projects, adminLogs, supplyPriceItems);
    return Response.json({ ok: true, updatedAt: result.updatedAt });
  } catch (error) {
    console.error("[PUT /api/projects] failed:", error);
    return Response.json(
      { ok: false, message: "프로젝트 데이터를 저장하지 못했습니다.", error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
