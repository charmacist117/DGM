# DB persistence notes

The app keeps the public API shape as `{ projects, adminLogs }`, but server-side data is stored in normalized PostgreSQL tables.

## Tables

- `pms_projects`: project-level fields.
- `pms_tasks`: task rows per project.
- `pms_project_items`: project child records such as contracts, communication logs, decisions, advisor notes, stage checks, and change logs.
- `pms_admin_logs`: global project create, delete, update, hide, and restore logs.

## Migration

Legacy `pms_state` JSON data is still created/read for compatibility. When the normalized project tables are empty, the server reads `pms_state` once and writes the data into the normalized tables automatically.

## Current compatibility layer

`GET /api/projects` still returns the full `{ projects, adminLogs }` payload and `PUT /api/projects` still accepts the full payload. This keeps the existing frontend stable while making the database layout easier to maintain and extend later with partial-save APIs.
