import { readSession } from "@/lib/server/auth";
import {
  downloadGoogleDriveBackup,
  getGoogleDriveBackupStatus,
  listGoogleDriveBackups,
  uploadGoogleDriveBackup
} from "@/lib/server/googleDriveBackup";

export const runtime = "nodejs";

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
  if (!session) {
    return Response.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";

    if (action === "status") {
      return Response.json({ ok: true, ...getGoogleDriveBackupStatus() });
    }

    if (action === "list") {
      const status = getGoogleDriveBackupStatus();
      if (!status.configured) {
        return Response.json({ ok: true, files: [], ...status });
      }
      const files = await listGoogleDriveBackups(Number(searchParams.get("limit") || 30));
      return Response.json({ ok: true, files, ...status });
    }

    if (action === "download") {
      const fileId = searchParams.get("fileId") || "";
      const payload = await downloadGoogleDriveBackup(fileId);
      return Response.json({
        ok: true,
        ...normalizeBackupPayload(payload),
        raw: payload
      });
    }

    return Response.json({ ok: false, message: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { ok: false, message: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await readSession();
  if (!session) {
    return Response.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action || "upload";

    if (action !== "upload") {
      return Response.json({ ok: false, message: "Unsupported action." }, { status: 400 });
    }

    const projects = Array.isArray(body?.projects) ? body.projects : null;
    const adminLogs = Array.isArray(body?.adminLogs) ? body.adminLogs : [];
    if (!projects) {
      return Response.json({ ok: false, message: "projects array is required." }, { status: 400 });
    }

    const file = await uploadGoogleDriveBackup(projects, adminLogs, session.role || "user");
    return Response.json({ ok: true, file });
  } catch (error) {
    return Response.json(
      { ok: false, message: String(error?.message || error) },
      { status: 500 }
    );
  }
}
