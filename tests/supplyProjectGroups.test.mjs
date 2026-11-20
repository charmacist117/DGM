import test from "node:test";
import assert from "node:assert/strict";
import { groupSupplyProjects } from "../lib/pms/supplyProjectGroups.js";

test("supply groups use both recorded project links and count only the selected category", () => {
  const projects = [{ id: 10, name: "개발 프로젝트", sourceSupplyItemId: "b" }];
  const items = [
    { id: "a", category: "OTC", productName: "견적 A", projectPromotion: { linkedProjectId: "10" } },
    { id: "b", category: "OTC", productName: "견적 B" },
    { id: "c", category: "기타", projectPromotion: { linkedProjectId: 10 } }
  ];
  const { byItemId, byCategory } = groupSupplyProjects(items, projects);
  assert.deepEqual(byItemId.get("a"), byItemId.get("b"));
  assert.equal(byItemId.get("a").label, "개발 프로젝트");
  assert.equal(byCategory.get("all").get("project:10").count, 3);
  assert.equal(byCategory.get("OTC").get("project:10").count, 2);
});

test("unlinked quotes group by product and composition, independent of ingredient order", () => {
  const ingredients = [{ name: "성분 A", content: "5mg" }, { name: "성분 B", content: "10mg" }];
  const items = [
    { id: "a", category: "OTC", productName: "같은 제품", ingredients, manufacturer: "제조사 A" },
    { id: "b", category: "OTC", productName: " 같은 제품 ", ingredients: [...ingredients].reverse(), manufacturer: "제조사 B" },
    { id: "c", category: "OTC", productName: "같은 제품", ingredients: [{ name: "성분 A", content: "20mg" }] },
    { id: "d", category: "OTC" }
  ];
  const { byItemId } = groupSupplyProjects(items, []);
  assert.equal(byItemId.get("a").key, byItemId.get("b").key);
  assert.equal(byItemId.get("a").color, byItemId.get("b").color);
  assert.notEqual(byItemId.get("a").key, byItemId.get("c").key);
  assert.equal(byItemId.get("d").key, "unassigned");
  assert.equal(groupSupplyProjects([...items].reverse(), []).byItemId.get("a").color, byItemId.get("a").color);
});
