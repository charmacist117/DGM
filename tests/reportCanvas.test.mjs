import test from "node:test";
import assert from "node:assert/strict";
import { drawCanvasTable, getCanvasTextLines } from "../lib/pms/exporters.js";

function canvasContext(width = 1000) {
  return {
    canvas: { width }, font: "16px sans-serif", texts: [], rectangles: [],
    measureText(text) { return { width: Array.from(text).length * Number(this.font.match(/(\d+)px/)[1]) }; },
    fillText(text, x, y, maxWidth) { this.texts.push({ text, x, y, maxWidth, font: this.font }); },
    fillRect(x, y, width, height) { this.rectangles.push({ x, y, width, height }); },
    strokeRect() {}
  };
}

test("long table headers retain every character on one line inside their cells", () => {
  const context = canvasContext();
  const headers = ["최소 주문단위 기준 공급사 판매가 (허가사 수수료 및 VAT 포함)", "마진율"];
  const widths = [100, 100];
  const bottom = drawCanvasTable(context, { headers, rows: [], widths, x: 20, y: 10 });
  assert.deepEqual(context.texts.map((entry) => entry.text), headers);
  assert.equal(bottom, 56);
  assert.deepEqual(widths, [100, 100]);
  assert.equal(context.rectangles.at(-1).x + context.rectangles.at(-1).width, 980);
  assert.ok(Number(context.texts[0].font.match(/(\d+)px/)[1]) < 17);
  for (const entry of context.texts) assert.ok(entry.x + entry.maxWidth <= 980);
});

test("wrapped rows increase table height without losing newlines or Unicode characters", () => {
  const context = canvasContext(240);
  const input = "가나다라마바사아자차\n\nABC";
  const lines = getCanvasTextLines(context, input, 64);
  assert.equal(lines.join(""), input.replaceAll("\n", ""));
  assert.ok(lines.includes(""));
  assert.deepEqual(getCanvasTextLines(context, "", 64), [""]);
  assert.deepEqual(getCanvasTextLines(context, null, 64), ["-"]);
  const bottom = drawCanvasTable(context, { headers: ["내용"], rows: [[input], ["다음 행"]], widths: [200], x: 20, y: 0 });
  const rows = context.rectangles.slice(1);
  assert.equal(rows[1].y, rows[0].y + rows[0].height);
  assert.equal(bottom, rows[1].y + rows[1].height);
  assert.equal(context.texts.slice(1).map((entry) => entry.text).join(""), input.replaceAll("\n", "") + "다음 행");
});
