import { createFullBackup, parseFullBackup } from "@/lib/pms/fullBackup";
import { readSession } from "@/lib/server/auth";
import { loadProjects, saveProjects } from "@/lib/server/projectStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAdmin(session) {
  if (!session) return Response.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  if (session.role !== "admin") return Response.json({ ok: false, message: "관리자 권한이 필요합니다." }, { status: 403 });
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
      supplyPriceItems: stored.supplyPriceItems
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
    return Response.json({ ok: false, message: "전체 백업 파일을 만들지 못했습니다.", error: String(error?.message || error) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const denied = requireAdmin(await readSession());
    if (denied) return denied;

    const body = await request.json();
    const parsed = parseFullBackup(body?.backup || body, { allowLegacy: true });
    const saved = await saveProjects(parsed.data.projects, parsed.data.adminLogs, parsed.data.supplyPriceItems);

    return Response.json({ ok: true, updatedAt: saved.updatedAt, summary: parsed.summary, legacy: parsed.legacy });
  } catch (error) {
    console.error("[POST /api/backup/full] failed:", error);
    return Response.json({ ok: false, message: "전체 백업 파일을 복원하지 못했습니다.", error: String(error?.message || error) }, { status: 400 });
  }
}
