
"use client";

import { useEffect, useRef, useState } from "react";
import { formatIngredientAmountLabel } from "@/components/IngredientAmountTitle";
import { mountReview } from "@/lib/pms/medicineStandard/review";

export default function MedicineStandardTab({ items, selectedId, onSelectedIdChange }) {
  const container = useRef(null);
  const review = useRef(null);
  const [ready, setReady] = useState(false);
  const options = items.filter(item => item.category === "OTC" && item.ingredients?.some(ingredient => ingredient.name));
  const selected = options.find(item => String(item.id) === String(selectedId));

  useEffect(() => {
    const host = container.current;
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    const mounted = mountReview(shadow);
    review.current = mounted;
    setReady(true);
    return () => {
      mounted.destroy();
      review.current = null;
    };
  }, []);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 14 }}>
        <label htmlFor="medicine-supply" style={{ display: "block", color: "#0f172a", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
          DGM 공급조건에서 성분 가져오기
        </label>
        <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
          <select
            id="medicine-supply"
            value={selected ? String(selected.id) : ""}
            onChange={event => onSelectedIdChange(event.target.value)}
            style={{ flex: "1 1 280px", minWidth: 0, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, minHeight: 36, padding: "6px 9px" }}
          >
            <option value="">{options.length ? "OTC 공급조건 선택" : "등록된 OTC 공급조건 없음"}</option>
            {options.map(item => (
              <option key={item.id} value={String(item.id)}>
                {[item.productName, formatIngredientAmountLabel(item), item.manufacturer].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!ready || !selected}
            onClick={() => review.current?.importSupply(selected)}
            style={{ border: "1px solid #0f766e", background: "#fff", borderRadius: 6, padding: "7px 12px", color: "#115e59", fontWeight: 800, opacity: selected ? 1 : 0.55 }}
          >
            선택한 장에 추가
          </button>
        </div>
        <p style={{ margin: "7px 0 0", color: "#475569", fontSize: 12 }}>
          제형과 장을 선택한 뒤 추가하세요. 단위당 함량을 확인할 수 있는 값만 채웁니다.
        </p>
      </div>
      <div ref={container} />
    </section>
  );
}
