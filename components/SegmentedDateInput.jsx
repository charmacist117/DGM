"use client";

import { useEffect, useRef, useState } from "react";

function dateParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match
    ? { year: match[1], month: match[2], day: match[3] }
    : { year: "", month: "", day: "" };
}

function validDateValue({ year, month, day }) {
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return "";
  const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  if (
    parsed.getFullYear() !== Number(year)
    || parsed.getMonth() + 1 !== Number(month)
    || parsed.getDate() !== Number(day)
  ) return "";
  return `${year}-${month}-${day}`;
}

export default function SegmentedDateInput({
  value = "",
  onChange,
  disabled = false,
  style = {},
  "aria-label": ariaLabel = "날짜"
}) {
  const [parts, setParts] = useState(() => dateParts(value));
  const monthRef = useRef(null);
  const dayRef = useRef(null);
  const yearRef = useRef(null);

  useEffect(() => {
    setParts(dateParts(value));
  }, [value]);

  const update = (field, rawValue) => {
    const rawDigits = String(rawValue || "").replace(/\D/g, "");
    if (field === "year" && rawDigits.length >= 8) {
      const next = {
        year: rawDigits.slice(0, 4),
        month: rawDigits.slice(4, 6),
        day: rawDigits.slice(6, 8)
      };
      setParts(next);
      const nextValue = validDateValue(next);
      if (nextValue) onChange?.(nextValue);
      dayRef.current?.focus();
      dayRef.current?.select();
      return;
    }

    const maxLength = field === "year" ? 4 : 2;
    const digits = rawDigits.slice(0, maxLength);
    const next = { ...parts, [field]: digits };
    setParts(next);

    if (!next.year && !next.month && !next.day) {
      onChange?.("");
      return;
    }

    const nextValue = validDateValue(next);
    if (nextValue) onChange?.(nextValue);

    if (field === "year" && digits.length === 4) {
      monthRef.current?.focus();
      monthRef.current?.select();
    } else if (field === "month" && digits.length === 2 && Number(digits) >= 1 && Number(digits) <= 12) {
      dayRef.current?.focus();
      dayRef.current?.select();
    }
  };

  const handleBackspace = (event, field) => {
    if (event.key !== "Backspace" || parts[field]) return;
    if (field === "day") {
      monthRef.current?.focus();
      monthRef.current?.select();
    } else if (field === "month") {
      yearRef.current?.focus();
      yearRef.current?.select();
    }
  };

  const segmentStyle = {
    minWidth: 0,
    padding: 0,
    border: 0,
    outline: 0,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "center",
    boxSizing: "border-box"
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: 36,
        padding: "7px 9px",
        border: "1px solid #cbd5e1",
        borderRadius: 6,
        background: disabled ? "#f8fafc" : "#fff",
        color: disabled ? "#64748b" : "#0f172a",
        display: "grid",
        gridTemplateColumns: "minmax(48px, 1.45fr) auto minmax(30px, .8fr) auto minmax(30px, .8fr)",
        alignItems: "center",
        gap: 3,
        boxSizing: "border-box",
        fontSize: 14,
        ...style
      }}
      aria-label={ariaLabel}
    >
      <input
        ref={yearRef}
        value={parts.year}
        onChange={(event) => update("year", event.target.value)}
        inputMode="numeric"
        maxLength={8}
        placeholder="연도"
        aria-label={`${ariaLabel} 연도`}
        disabled={disabled}
        style={{ ...segmentStyle, textAlign: "left" }}
      />
      <span aria-hidden="true">-</span>
      <input
        ref={monthRef}
        value={parts.month}
        onChange={(event) => update("month", event.target.value)}
        onKeyDown={(event) => handleBackspace(event, "month")}
        inputMode="numeric"
        maxLength={2}
        placeholder="월"
        aria-label={`${ariaLabel} 월`}
        disabled={disabled}
        style={segmentStyle}
      />
      <span aria-hidden="true">-</span>
      <input
        ref={dayRef}
        value={parts.day}
        onChange={(event) => update("day", event.target.value)}
        onKeyDown={(event) => handleBackspace(event, "day")}
        inputMode="numeric"
        maxLength={2}
        placeholder="일"
        aria-label={`${ariaLabel} 일`}
        disabled={disabled}
        style={segmentStyle}
      />
    </div>
  );
}
