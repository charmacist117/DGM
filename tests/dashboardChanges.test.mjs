import test from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_CHANGE_NOTICE_TYPE, DASHBOARD_CHANGE_SEEDS, appendDashboardChangeSeeds } from "../lib/pms/dashboardChanges.js";

const date = { changeDate: "2026-09-03", createdAt: "2026-09-03T01:00:00Z" };
const append = (logs, seeds = DASHBOARD_CHANGE_SEEDS) => appendDashboardChangeSeeds(logs, seeds, date);

test("all existing release keys and notices are retained", () => {
  assert.equal(DASHBOARD_CHANGE_SEEDS.length, 45);
  assert.equal(new Set(DASHBOARD_CHANGE_SEEDS.map((seed) => seed.key)).size, 45);
  assert.equal(new Set(DASHBOARD_CHANGE_SEEDS.map((seed) => seed.id)).size, 45);
  assert.equal(DASHBOARD_CHANGE_SEEDS.reduce((sum, seed) => sum + seed.changes.length, 0), 123);
  const logs = append([]);
  assert.equal(logs.length, 45);
  assert.deepEqual(logs.map((log) => log.revision), Array.from({ length: 45 }, (_, index) => String(index + 1)));
  assert.equal(append(logs), logs);
});

test("a fresh browser does not reseed notices already merged into daily sourceIds", () => {
  const logs = [{ id: "dashboard_change_day_2026-08-01", type: DASHBOARD_CHANGE_NOTICE_TYPE,
    revision: "45", sourceIds: DASHBOARD_CHANGE_SEEDS.map((seed) => seed.id), changeDate: "2026-08-01" }];
  assert.equal(append(logs), logs);
});

test("only missing releases are appended without changing existing records", () => {
  const completed = DASHBOARD_CHANGE_SEEDS.slice(0, -1);
  const logs = [{ id: "existing", type: DASHBOARD_CHANGE_NOTICE_TYPE, revision: "v54.2", sourceIds: completed.map((seed) => seed.id) }];
  const before = structuredClone(logs);
  const next = append(logs);
  assert.deepEqual(logs, before);
  assert.equal(next.length, 2);
  assert.equal(next[0], logs[0]);
  assert.equal(next[1].id, DASHBOARD_CHANGE_SEEDS.at(-1).id);
  assert.equal(next[1].revision, "55");
  assert.equal(append(next), next);
});

test("legacy registration flags can suppress deleted notices and the initial notice stays initial-only", () => {
  const logs = [{ id: "custom", type: DASHBOARD_CHANGE_NOTICE_TYPE, revision: "3" }];
  assert.equal(append(logs, [DASHBOARD_CHANGE_SEEDS[0]]), logs);
  assert.equal(append(logs, []), logs);
  const events = [{ id: "event", type: "project_event" }];
  assert.equal(append(events)[0], events[0]);
  assert.equal(append(events).length, 46);
});
