
import { converted, fieldOptions, isOral, normal } from "./rules.mjs";

const denominatorByForm = {
  "정제": "정",
  "추어블정": "정",
  "발포정": "정",
  "구강용 정제": "정",
  "구강붕해정": "정",
  "트로키제": "정",
  "캡슐제": "캡슐",
  "경구용 액제": "ml",
  "시럽제": "ml",
  "과립제": "g",
  "발포과립": "g",
  "산제": "g",
  "구강용해필름": "매",
  "환제": "환",
  "경구용젤리제": "개",
};

function readPerUnit(content, form, targetUnit) {
  const expected = denominatorByForm[form];
  if (!expected) return null;
  const text = String(content).normalize("NFKC").toLowerCase().trim();
  const match = text.match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*(mg|g|µg|μg|ug|mcg|iu)\s*\/\s*(\d+(?:\.\d+)?)?\s*(정|캡슐|ml|g|매|환|개)$/u);
  if (!match || match[4] !== expected) return null;
  const unit = /^(µg|μg|ug|mcg)$/.test(match[2]) ? "µg" : match[2] === "iu" ? "IU" : match[2];
  const denominator = match[3] ? Number(match[3]) : 1;
  const value = converted(Number(match[1].replaceAll(",", "")) / denominator, unit, targetUnit);
  return Number.isFinite(value) && value > 0 ? Number(value.toPrecision(12)) : null;
}

export function matchSupplyIngredients(chapter, form, variant, catalog, ingredients, currentRows) {
  const added = [];
  const pending = [];
  const used = new Set(currentRows.map(row => row.id));

  for (const ingredient of ingredients ?? []) {
    const name = String(ingredient?.name ?? "").trim();
    const content = String(ingredient?.content ?? "").trim();
    if (!name && !content) continue;
    const sourceText = [name, content].filter(Boolean).join(" · ");
    const matches = catalog.filter(row => normal(row.name) === normal(name));
    if (matches.length !== 1) {
      pending.push(sourceText + (matches.length ? " · 동일 성분명의 항목이 여러 개입니다." : " · 선택한 장에서 성분명을 확인하세요."));
      continue;
    }
    const record = matches[0];
    if (used.has(record.id)) {
      pending.push(sourceText + " · 이미 추가된 성분의 함량을 대조하세요.");
      continue;
    }

    const [field] = fieldOptions(chapter, record, form, variant);
    const { values } = record;
    const transferable = isOral(chapter) && field.key === "day" && !values.day?.manual;
    const value = transferable ? readPerUnit(content, form, field.unit) : null;
    added.push({
      ...record,
      entries: value == null ? {} : { [field.key]: value },
      sourceText,
      primary: currentRows.length + added.length === 0,
    });
    used.add(record.id);
  }

  return { added, pending };
}
