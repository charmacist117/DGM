import test from "node:test";
import assert from "node:assert/strict";
import { readPmsView, writePmsView } from "../lib/pms/navigation.js";
import { compareSupplyQuotes } from "../lib/pms/supplyQuoteOrder.js";

test("navigation round trips a supply group, an item and a schedule detail tab", () => {
  const base = readPmsView();
  const views = [
    { ...base, moduleTab: "supply", category: "화장품", group: "project:앰플 & 크림" },
    { ...base, moduleTab: "distribution", category: "OTC", item: "q_25", scenario: "가격대 3" },
    { ...base, moduleTab: "schedule", project: "123", tab: "tasks" },
    { ...base, moduleTab: "contract", parent: "parent_1", item: "child_1" }
  ];
  for (const view of views) assert.deepEqual(readPmsView(writePmsView(view)), view);
  assert.equal(readPmsView("?project=123").moduleTab, "schedule");
  assert.equal(readPmsView("?view=home&project=123").project, "");
  assert.equal(readPmsView("?view=schedule&project=123&tab=unknown").tab, "overview");
});

test("quote order follows dates and keeps an undated draft ahead of saved quotes", () => {
  const older = { empty: false, quoteDate: "2026-09-20", createdAt: "" };
  const newer = { empty: false, quoteDate: "2026-10-01", createdAt: "" };
  const draft = { empty: true, quoteDate: "", createdAt: "2026-10-01" };
  assert.deepEqual([older, draft, newer].sort(compareSupplyQuotes), [draft, newer, older]);
});
