import { loadProjects, saveProjects } from "@/lib/server/projectStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await loadProjects();
    return Response.json({
      ok: true,
      projects: result.projects,
      adminLogs: result.adminLogs,
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
    const body = await request.json();
    if (!body || !Array.isArray(body.projects)) {
      return Response.json({ ok: false, message: "projects 배열이 필요합니다." }, { status: 400 });
    }

    let adminLogs = Array.isArray(body.adminLogs) ? body.adminLogs : null;
    if (adminLogs === null) {
      const current = await loadProjects();
      adminLogs = Array.isArray(current.adminLogs) ? current.adminLogs : [];
    }

    const result = await saveProjects(body.projects, adminLogs);
    return Response.json({ ok: true, updatedAt: result.updatedAt });
  } catch (error) {
    console.error("[PUT /api/projects] failed:", error);
    return Response.json(
      { ok: false, message: "프로젝트 데이터를 저장하지 못했습니다.", error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
