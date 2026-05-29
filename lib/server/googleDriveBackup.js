import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const BACKUP_SOURCE = "pharmadev-pms";
const DEFAULT_FILE_PREFIX = "PharmaDev_PMS_Backup";

let tokenCache = { accessToken: "", expiresAt: 0 };

function base64url(input) {
  return Buffer
    .from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeBase64Json(value) {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function normalizePrivateKey(privateKey) {
  return String(privateKey || "").replace(/\\n/g, "\n");
}

function readServiceAccount() {
  const fromJsonEnv = parseJson(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (fromJsonEnv?.client_email && fromJsonEnv?.private_key) {
    return {
      clientEmail: String(fromJsonEnv.client_email),
      privateKey: normalizePrivateKey(fromJsonEnv.private_key)
    };
  }

  const fromBase64Env = decodeBase64Json(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64);
  if (fromBase64Env?.client_email && fromBase64Env?.private_key) {
    return {
      clientEmail: String(fromBase64Env.client_email),
      privateKey: normalizePrivateKey(fromBase64Env.private_key)
    };
  }

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const privateKey = normalizePrivateKey(process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "");
  if (!clientEmail || !privateKey) return null;

  return { clientEmail, privateKey };
}

function getBackupFolderId() {
  return process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || "";
}

function getSharedDriveId() {
  return process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || "";
}

function getBackupPrefix() {
  return (process.env.GOOGLE_DRIVE_BACKUP_FILE_PREFIX || DEFAULT_FILE_PREFIX).trim() || DEFAULT_FILE_PREFIX;
}

function createJwtAssertion(serviceAccount) {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.clientEmail,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.privateKey).toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${signingInput}.${signature}`;
}

async function fetchAccessToken() {
  if (tokenCache.accessToken && tokenCache.expiresAt - 30_000 > Date.now()) {
    return tokenCache.accessToken;
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    throw new Error("Google Drive environment variables are missing. Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_CLIENT_EMAIL/GOOGLE_DRIVE_PRIVATE_KEY.");
  }

  const assertion = createJwtAssertion(serviceAccount);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google auth failed: ${payload.error_description || payload.error || response.status}`);
  }

  const expiresInSec = Number(payload.expires_in || 3600);
  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresInSec * 1000
  };

  return tokenCache.accessToken;
}

async function driveRequest(url, options = {}) {
  const token = await fetchAccessToken();
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    },
    body: options.body
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Google Drive API error (${response.status}): ${text || response.statusText}`);
  }

  if (options.rawText) {
    return response.text();
  }
  return response.json().catch(() => ({}));
}

function buildDriveListQuery() {
  const folderId = getBackupFolderId();
  const prefix = getBackupPrefix().replace(/'/g, "\\'");
  const conditions = [
    "trashed = false",
    "mimeType = 'application/json'",
    `name contains '${prefix}'`
  ];
  if (folderId) conditions.push(`'${folderId.replace(/'/g, "\\'")}' in parents`);
  return conditions.join(" and ");
}

function buildDriveListParams(limit = 30) {
  const params = new URLSearchParams({
    q: buildDriveListQuery(),
    pageSize: String(Math.max(1, Math.min(Number(limit) || 30, 100))),
    orderBy: "createdTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "files(id,name,size,createdTime,modifiedTime,webViewLink,description)"
  });
  const sharedDriveId = getSharedDriveId();
  if (sharedDriveId) {
    params.set("corpora", "drive");
    params.set("driveId", sharedDriveId);
  }
  return params;
}

function buildBackupPayload(projects, adminLogs) {
  return {
    source: BACKUP_SOURCE,
    exportedAt: new Date().toISOString(),
    projects: Array.isArray(projects) ? projects : [],
    adminLogs: Array.isArray(adminLogs) ? adminLogs : []
  };
}

function buildBackupFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${getBackupPrefix()}_${stamp}.json`;
}

export function getGoogleDriveBackupStatus() {
  const hasCredentials = Boolean(readServiceAccount());
  return {
    configured: hasCredentials,
    folderId: getBackupFolderId() || null,
    sharedDriveId: getSharedDriveId() || null,
    filePrefix: getBackupPrefix()
  };
}

export async function listGoogleDriveBackups(limit = 30) {
  const status = getGoogleDriveBackupStatus();
  if (!status.configured) {
    throw new Error("Google Drive backup env is not configured.");
  }

  const params = buildDriveListParams(limit);
  const payload = await driveRequest(`${DRIVE_API_BASE}/files?${params.toString()}`);
  return Array.isArray(payload.files) ? payload.files : [];
}

export async function uploadGoogleDriveBackup(projects, adminLogs, actor = "unknown") {
  const status = getGoogleDriveBackupStatus();
  if (!status.configured) {
    throw new Error("Google Drive backup env is not configured.");
  }

  const backup = buildBackupPayload(projects, adminLogs);
  const fileName = buildBackupFileName();

  const metadata = {
    name: fileName,
    mimeType: "application/json",
    description: `${BACKUP_SOURCE} backup by ${actor} at ${backup.exportedAt}`
  };
  if (status.folderId) metadata.parents = [status.folderId];

  const createParams = new URLSearchParams({
    fields: "id,name,size,createdTime,modifiedTime,webViewLink",
    supportsAllDrives: "true"
  });

  const created = await driveRequest(`${DRIVE_API_BASE}/files?${createParams.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(metadata)
  });

  if (!created?.id) {
    throw new Error("Google Drive file create failed.");
  }

  const uploadParams = new URLSearchParams({
    uploadType: "media",
    supportsAllDrives: "true"
  });

  await driveRequest(`${DRIVE_UPLOAD_BASE}/files/${created.id}?${uploadParams.toString()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(backup)
  });

  return {
    id: created.id,
    name: created.name || fileName,
    size: created.size || null,
    createdTime: created.createdTime || backup.exportedAt,
    modifiedTime: created.modifiedTime || backup.exportedAt,
    webViewLink: created.webViewLink || null
  };
}

export async function downloadGoogleDriveBackup(fileId) {
  const status = getGoogleDriveBackupStatus();
  if (!status.configured) {
    throw new Error("Google Drive backup env is not configured.");
  }
  if (!fileId) {
    throw new Error("fileId is required.");
  }

  const params = new URLSearchParams({ alt: "media", supportsAllDrives: "true" });
  const text = await driveRequest(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?${params.toString()}`, { rawText: true });
  const parsed = parseJson(text);
  if (!parsed || (!Array.isArray(parsed.projects) && !Array.isArray(parsed))) {
    throw new Error("Backup file format is invalid.");
  }
  return parsed;
}
