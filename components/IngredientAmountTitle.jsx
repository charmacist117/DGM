"use client";

export function formatIngredientAmountLabel(item = {}, fallback = "성분·함량 미입력") {
  return (Array.isArray(item.ingredients) ? item.ingredients : [])
    .map((ingredient) => {
      const name = String(ingredient?.name || "").trim();
      const content = String(ingredient?.content || "").trim();
      return [name, content].filter(Boolean).join(" / ");
    })
    .filter(Boolean)
    .join(" · ") || fallback;
}

function fittedFontSize(label, maximum, minimum) {
  const length = Array.from(String(label || "")).length;
  if (length <= 38) return maximum;
  if (length <= 62) return Math.max(minimum, maximum - 2);
  if (length <= 92) return Math.max(minimum, maximum - 4);
  return minimum;
}

export default function IngredientAmountTitle({
  item,
  label,
  fallback,
  maxFontSize = 18,
  minFontSize = 12,
  style
}) {
  const text = label || formatIngredientAmountLabel(item, fallback);
  return (
    <div
      title={text}
      aria-label={text}
      style={{
        display: "block",
        boxSizing: "border-box",
        flex: "1 1 0",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: "#0f172a",
        fontSize: fittedFontSize(text, maxFontSize, minFontSize),
        fontWeight: 900,
        letterSpacing: 0,
        lineHeight: 1.35,
        ...style
      }}
    >
      {text}
    </div>
  );
}
