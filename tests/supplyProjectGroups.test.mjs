import test from "node:test";
import assert from "node:assert/strict";
import { groupSupplyProjects } from "../lib/pms/supplyProjectGroups.js";

test("supply groups use manually assigned names regardless of product and count by category", () => {
  const items = [
    { id: "a", category: "OTC", productName: "견적 A", supplyProjectName: "개발 프로젝트" },
    { id: "b", category: "OTC", productName: "견적 B", supplyProjectName: " 개발 프로젝트 " },
    { id: "c", category: "기타", supplyProjectName: "개발 프로젝트" }
  ];
  const { byItemId, byCategory } = groupSupplyProjects(items);
  assert.deepEqual(byItemId.get("a"), byItemId.get("b"));
  assert.equal(byItemId.get("a").label, "개발 프로젝트");
  assert.equal(byCategory.get("all").get("project:개발 프로젝트").count, 3);
  assert.equal(byCategory.get("OTC").get("project:개발 프로젝트").count, 2);
});

test("the same product can be assigned to different projects and old quotes stay unassigned", () => {
  const ingredients = [{ name: "성분 A", content: "5mg" }, { name: "성분 B", content: "10mg" }];
  const items = [
    { id: "a", category: "OTC", productName: "같은 제품", ingredients, supplyProjectName: "A 프로젝트" },
    { id: "b", category: "OTC", productName: "같은 제품", ingredients, supplyProjectName: "B 프로젝트" },
    { id: "c", category: "OTC", productName: "같은 제품", ingredients, projectPromotion: { linkedProjectId: 10 } },
    { id: "d", category: "OTC" }
  ];
  const { byItemId } = groupSupplyProjects(items);
  assert.notEqual(byItemId.get("a").key, byItemId.get("b").key);
  assert.equal(byItemId.get("c").key, "unassigned");
  assert.equal(byItemId.get("d").key, "unassigned");
  assert.equal(groupSupplyProjects([...items].reverse()).byItemId.get("a").color, byItemId.get("a").color);
});
