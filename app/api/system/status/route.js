import { loadProjects } from "@/lib/server/projectStore";
import { query } from "@/lib/server/db";
import { readSession } from "@/lib/server/auth";
import { secureJson } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configuredLimit() {
  const value = Number(process.env.PMS_DATABASE_STORAGE_LIMIT_BYTES || 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function isNeonDatabase() {
  const source = String(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL || process.env.PGHOST || "");
  return /neon\.tech/i.test(source);
}

async function readNeonProject() {
  const apiKey = String(process.env.NEON_API_KEY || "").trim();
  const projectId = String(process.env.NEON_PROJECT_ID || "").trim();
  if (!apiKey || !projectId) return { configured: false };
  try {
    const response = await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(projectId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return { configured: true, ok: false, message: `Neon API 응답 ${response.status}` };
    const payload = await response.json();
    const project = payload?.project || {};
    return {
      configured: true,
      ok: true,
      name: project.name || "Neon project",
      region: project.region_id || "-",
      pgVersion: project.pg_version || "-",
      dataTransferBytes: Number(project.data_transfer_bytes || 0) || null,
      storageBytes: Number(project.data_storage_bytes || project.synthetic_storage_size || 0) || null
    };
  } catch (error) {
    return { configured: true, ok: false, message: String(error?.message || error) };
  }
}

export async function GET() {
  const startedAt = Date.now();
  try {
    const session = await readSession();
    if (!session) return secureJson({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    if (session.role !== "admin") return secureJson({ ok: false, message: "관리자 권한이 필요합니다." }, { status: 403 });

    const [databaseResult, tableResult, stored, neon] = await Promise.all([
      query("SELECT current_database() AS name, pg_database_size(current_database())::bigint AS size, version() AS version"),
      query(`
        SELECT COALESCE(SUM(pg_total_relation_size((quote_ident(schemaname) || '.' || quote_ident(relname))::regclass)), 0)::bigint AS size
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
      `),
      loadProjects(),
      isNeonDatabase() ? readNeonProject() : Promise.resolve({ configured: false })
    ]);
    const databaseBytes = Number(databaseResult.rows[0]?.size || 0);
    const tableBytes = Number(tableResult.rows[0]?.size || 0);
    const providerStorageBytes = Number(neon.storageBytes || 0) || null;
    const usedBytes = providerStorageBytes || databaseBytes;
    const limitBytes = configuredLimit();
    const remainingBytes = limitBytes == null ? null : Math.max(0, limitBytes - usedBytes);
    const usagePercent = limitBytes == null ? null : Math.min(100, usedBytes / limitBytes * 100);
    const source = stored.source || "online-database";
    const counts = {
      "제품개발": stored.projects?.length || 0,
      "공급단가": stored.supplyPriceItems?.length || 0,
      "계약 관리": stored.contractRecords?.length || 0,
      "변경 기록": stored.adminLogs?.length || 0
    };
    const neonDetected = isNeonDatabase();

    return secureJson({
      ok: true,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      application: {
        status: "online",
        platform: process.env.VERCEL ? "Vercel" : "Node.js",
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
        region: process.env.VERCEL_REGION || "-"
      },
      storage: {
        status: "online",
        provider: neonDetected ? "Neon PostgreSQL" : "PostgreSQL",
        source,
        usedBytes,
        usedLabel: providerStorageBytes ? "Neon 프로젝트 저장량" : "현재 데이터베이스 논리 크기",
        databaseBytes,
        tableBytes,
        limitBytes,
        remainingBytes,
        usagePercent,
        limitMessage: limitBytes == null
          ? "현재 DB 사용량은 실시간 조회됩니다. 총 제공량과 잔여량을 계산하려면 배포 환경에 PMS_DATABASE_STORAGE_LIMIT_BYTES를 설정하세요. Neon 세부 상태는 NEON_API_KEY와 NEON_PROJECT_ID가 있을 때 함께 조회됩니다."
          : "관리자가 설정한 저장공간 총 한도를 기준으로 잔여량을 계산했습니다. 요금제 변경 시 한도값도 갱신하세요."
      },
      services: [
        { id: "app", name: "웹 애플리케이션", status: "online", label: "정상", detail: `${process.env.VERCEL ? "Vercel 배포" : "Node.js 실행"} · 응답 ${Date.now() - startedAt}ms` },
        { id: "database", name: neonDetected ? "Neon PostgreSQL" : "PostgreSQL", status: "online", label: "연결됨", detail: `DB ${databaseBytes.toLocaleString()} bytes · 테이블 ${tableBytes.toLocaleString()} bytes` },
        { id: "neon-api", name: "Neon 관리 API", status: neon.configured ? (neon.ok ? "online" : "warning") : "unused", label: neon.configured ? (neon.ok ? "연결됨" : "확인 필요") : "미설정", detail: neon.configured ? (neon.ok ? `${neon.name} · ${neon.region}` : neon.message) : "API 키 없이도 DB 실사용량은 조회됩니다." },
        { id: "backup", name: "데이터 백업", status: "online", label: "사용 가능", detail: "환경설정 > 데이터 이전에서 JSON·CSV 백업 가능" }
      ],
      counts
    });
  } catch (error) {
    console.error("[GET /api/system/status] failed:", error);
    return secureJson({ ok: false, message: "서버 또는 데이터 저장소 상태를 조회하지 못했습니다." }, { status: 500 });
  }
}
