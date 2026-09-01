"use client";

import { useEffect, useMemo, useState } from "react";
import SegmentedDateInput from "@/components/SegmentedDateInput";
import IngredientAmountTitle, { formatIngredientAmountLabel } from "@/components/IngredientAmountTitle";
import { calculateSellingPriceFromMarginRate } from "@/lib/pms/marketAnalysis";
import {
  marketDecisionBadgeStyle,
  marketDecisionLabel
} from "@/lib/pms/marketDecision";
import {
  MISSING_PERMIT_COMPANY_FILTER,
  matchesPermitCompanyFilter,
  permitCompanyFilterOptions
} from "@/lib/pms/permitCompanyFilter";

const panelStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff"
};

const inputStyle = {
  width: "100%",
  minHeight: 38,
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "#fff",
  color: "#0f172a",
  fontSize: 14,
  boxSizing: "border-box"
};

const labelStyle = {
  display: "block",
  marginBottom: 5,
  color: "#475569",
  fontSize: 12,
  fontWeight: 800
};

const secondaryButtonStyle = {
  minHeight: 36,
  padding: "7px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800
};

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatWon(value) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(value))}원`;
}

function formatEnteredPrice(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  if (/^[\d,\s]+$/.test(raw)) return formatWon(parseNumber(raw));
  return raw;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)}%`;
}

function escapeReportMarkup(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reportFileName(value) {
  return String(value || "유통구조").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function downloadReportBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getCanvasTextLines(context, value, maxWidth) {
  const sourceLines = String(value ?? "-").split(/\r?\n/);
  const lines = [];
  sourceLines.forEach((sourceLine) => {
    if (!sourceLine) {
      lines.push("");
      return;
    }
    let line = "";
    Array.from(sourceLine).forEach((character) => {
      const candidate = `${line}${character}`;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    lines.push(line);
  });
  return lines.length > 0 ? lines : ["-"];
}

function drawCanvasTable(context, { headers, rows, widths, x, y }) {
  const headerHeight = 46;
  const lineHeight = 24;
  const padding = 10;
  let currentX = x;

  context.textBaseline = "top";
  context.font = "700 17px 'Malgun Gothic', Arial, sans-serif";
  headers.forEach((header, index) => {
    context.fillStyle = "#dbeafe";
    context.fillRect(currentX, y, widths[index], headerHeight);
    context.strokeStyle = "#94a3b8";
    context.strokeRect(currentX, y, widths[index], headerHeight);
    context.fillStyle = "#0f172a";
    getCanvasTextLines(context, header, widths[index] - (padding * 2)).slice(0, 2).forEach((line, lineIndex) => {
      context.fillText(line, currentX + padding, y + padding + (lineIndex * lineHeight));
    });
    currentX += widths[index];
  });

  let currentY = y + headerHeight;
  rows.forEach((row, rowIndex) => {
    context.font = "16px 'Malgun Gothic', Arial, sans-serif";
    const lineSets = row.map((value, index) => getCanvasTextLines(context, value, widths[index] - (padding * 2)));
    const rowHeight = Math.max(50, Math.max(...lineSets.map((lines) => lines.length)) * lineHeight + (padding * 2));
    currentX = x;
    row.forEach((value, index) => {
      context.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
      context.fillRect(currentX, currentY, widths[index], rowHeight);
      context.strokeStyle = "#cbd5e1";
      context.strokeRect(currentX, currentY, widths[index], rowHeight);
      context.fillStyle = "#0f172a";
      lineSets[index].forEach((line, lineIndex) => {
        context.fillText(line, currentX + padding, currentY + padding + (lineIndex * lineHeight));
      });
      currentX += widths[index];
    });
    currentY += rowHeight;
  });
  return currentY;
}

function getItemLabel(item) {
  const ingredients = formatIngredientAmountLabel(item, item.manufacturer || "성분 미입력");
  return item?.productName ? `${item.productName} · ${ingredients}` : ingredients;
}

function normalizePricingScenario(value = {}, fallbackId = "pricing_default", fallbackLabel = "기본") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const bundleOrder = parseNumber(source.bundleOrder);
  return {
    id: source.id ?? fallbackId,
    label: String(source.label ?? fallbackLabel),
    scenarioType: source.scenarioType === "bundle" ? "bundle" : "single",
    minimumQuantity: String(source.minimumQuantity ?? source.minQuantity ?? ""),
    chamyaksaMarginRate: String(source.chamyaksaMarginRate ?? ""),
    pharmacySellingPrice: String(source.pharmacySellingPrice ?? ""),
    bundleItemIds: (Array.isArray(source.bundleItemIds) ? source.bundleItemIds : []).map(String),
    bundleSellingPrice: String(source.bundleSellingPrice ?? ""),
    bundleOrder
  };
}

function createPricingScenario(index = 0, scenarioType = "single", selectedItemId = null) {
  return normalizePricingScenario({
    id: `pricing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: scenarioType === "bundle" ? `묶음 프로모션 ${index + 1}` : (index === 0 ? "기본" : `가격대 ${index + 1}`),
    scenarioType,
    bundleItemIds: selectedItemId === null ? [] : [String(selectedItemId)],
    minimumQuantity: scenarioType === "bundle" || index === 0 ? "" : String(index * 100)
  });
}

function getDistribution(item) {
  const source = item?.distributionStructure && typeof item.distributionStructure === "object"
    ? item.distributionStructure
    : {};
  const pricingScenarios = (Array.isArray(source.pricingScenarios) ? source.pricingScenarios : [])
    .filter((scenario) => scenario && typeof scenario === "object")
    .map((scenario, index) => normalizePricingScenario(
      scenario,
      `pricing_${index + 1}`,
      index === 0 ? "기본" : `가격대 ${index + 1}`
    ));
  if (pricingScenarios.length === 0) {
    pricingScenarios.push(normalizePricingScenario({
      id: "pricing_default",
      label: "기본",
      chamyaksaMarginRate: source.chamyaksaMarginRate,
      pharmacySellingPrice: source.pharmacySellingPrice
    }));
  }
  return {
    pricingScenarios,
    pharmacySellingPrice: String(source.pharmacySellingPrice ?? pricingScenarios.find((scenario) => scenario.scenarioType !== "bundle")?.pharmacySellingPrice ?? ""),
    competitors: Array.isArray(source.competitors) ? source.competitors : [],
    comparisonCategory: String(source.comparisonCategory || "").trim(),
    isConfigured: typeof source.isConfigured === "boolean"
      ? source.isConfigured
      : Boolean(source.updatedAt),
    configuredAt: String(source.configuredAt || ""),
    updatedAt: String(source.updatedAt || "")
  };
}

function getPricingScenariosForItem(targetItem, allItems = []) {
  if (!targetItem) return [];
  const targetId = String(targetItem.id);
  const ownScenarios = getDistribution(targetItem).pricingScenarios.map((scenario) => ({
    ...scenario,
    _ownerItemId: targetId,
    _linked: false
  }));
  const ownIds = new Set(ownScenarios.map((scenario) => String(scenario.id)));
  const linkedScenarios = allItems.flatMap((item) => {
    if (String(item.id) === targetId) return [];
    return getDistribution(item).pricingScenarios
      .filter((scenario) => scenario.scenarioType === "bundle"
        && (scenario.bundleItemIds || []).map(String).includes(targetId)
        && !ownIds.has(String(scenario.id)))
      .map((scenario) => ({
        ...scenario,
        _ownerItemId: String(item.id),
        _linked: true
      }));
  });
  const singleScenarios = ownScenarios.filter((scenario) => scenario.scenarioType !== "bundle");
  const bundleScenarios = [...ownScenarios.filter((scenario) => scenario.scenarioType === "bundle"), ...linkedScenarios]
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left.bundleOrder) ? left.bundleOrder : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(right.bundleOrder) ? right.bundleOrder : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
  return [...singleScenarios, ...bundleScenarios];
}

function pricingScenarioKey(scenario, fallbackOwnerId = "") {
  return `${String(scenario?._ownerItemId || fallbackOwnerId)}::${String(scenario?.id || "")}`;
}

function normalizeComparisonCategory(value) {
  return String(value || "").trim();
}

function competitorIdentity(competitor = {}) {
  const signature = [competitor.productName, competitor.salesChannel, competitor.packagingUnit]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
  return signature === "||" ? String(competitor.id || "") : signature;
}

function mergeCompetitors(items = []) {
  const merged = new Map();
  items.forEach((item) => {
    getDistribution(item).competitors.forEach((competitor) => {
      const key = competitorIdentity(competitor);
      if (key && !merged.has(key)) merged.set(key, competitor);
    });
  });
  return Array.from(merged.values());
}

function getBaseAmounts(item) {
  const unitPrice = parseNumber(item?.supplyUnitPrice);
  const quantity = parseNumber(item?.quantity);
  const minimumOrderBatches = Math.max(1, Math.ceil(parseNumber(item?.minimumOrderBatchQuantity) ?? 1));
  const permitFeeRate = parseNumber(item?.permitCompanyFeeRate);
  const hasPermitFee = item?.category === "OTC" && item?.permitCompanyFee;
  const permitFeeRateUnknown = item?.category === "OTC" && item?.permitCompanyFee && item?.permitCompanyFeeRateUnknown;
  const hasKnownPermitFee = item?.category === "OTC" && item?.permitCompanyFee && !permitFeeRateUnknown && permitFeeRate !== null;
  const permitFeeMultiplier = hasKnownPermitFee ? 1 + (permitFeeRate / 100) : 1;
  const finalUnitCost = unitPrice === null
    ? null
    : unitPrice * 1.1 * permitFeeMultiplier;
  const permitFeeUnitPrice = !hasPermitFee || unitPrice === null ? null : unitPrice * permitFeeMultiplier;
  const permitFeeSupplyTotal = permitFeeUnitPrice === null || quantity === null ? null : permitFeeUnitPrice * quantity;
  const finalTotal = finalUnitCost === null || quantity === null ? null : finalUnitCost * quantity;

  return {
    unitPrice,
    quantity,
    minimumOrderBatches,
    minimumOrderQuantity: quantity === null ? null : quantity * minimumOrderBatches,
    vatUnitPrice: unitPrice === null ? null : unitPrice * 1.1,
    supplyTotal: unitPrice === null || quantity === null ? null : unitPrice * quantity,
    vatTotal: unitPrice === null || quantity === null ? null : unitPrice * quantity * 1.1,
    permitFeeUnitPrice,
    permitFeeSupplyTotal,
    permitFeeVatUnitPrice: hasPermitFee ? finalUnitCost : null,
    permitFeeVatTotal: hasPermitFee && finalUnitCost !== null && quantity !== null ? finalUnitCost * quantity : null,
    finalUnitCost,
    finalTotal,
    minimumOrderFinalTotal: finalTotal === null ? null : finalTotal * minimumOrderBatches
  };
}

function createPriceTier(index = 0) {
  return {
    id: `price_tier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: index === 0 ? "기본" : `${index * 100}개 이상`,
    price: ""
  };
}

function getCompetitorPriceTiers(competitor = {}) {
  if (Array.isArray(competitor.priceTiers) && competitor.priceTiers.length > 0) return competitor.priceTiers;
  return [{
    id: `${competitor.id || "competitor"}_legacy_price`,
    label: "기본",
    price: String(competitor.salePrice ?? "")
  }];
}

function createCompetitor() {
  return {
    id: `competitor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: "",
    productName: "",
    salesChannel: "",
    packagingUnit: "",
    salePrice: "",
    priceTiers: [createPriceTier()],
    memo: ""
  };
}

export default function DistributionStructureTab({
  items = [],
  categories = [],
  selectedCategory = "all",
  selectedItemId,
  onSelectedItemChange,
  onUpdateItem,
  onOpenSupply,
  onOpenMarket,
  syncState
}) {
  const [search, setSearch] = useState("");
  const [permitCompanyFilter, setPermitCompanyFilter] = useState("all");
  const [adoptionStatusFilter, setAdoptionStatusFilter] = useState("all");
  const [structureStatusFilter, setStructureStatusFilter] = useState("all");
  const [editingItemId, setEditingItemId] = useState(null);
  const [activePricingScenarioId, setActivePricingScenarioId] = useState(null);
  const [draggedPricingScenarioKey, setDraggedPricingScenarioKey] = useState(null);
  const [comparisonCategoryDraft, setComparisonCategoryDraft] = useState("");
  const [comparisonScenarioByItemId, setComparisonScenarioByItemId] = useState({});
  const query = search.trim().toLowerCase();
  const categoryItems = useMemo(() => (
    selectedCategory === "all" ? items : items.filter((item) => item.category === selectedCategory)
  ), [items, selectedCategory]);
  const permitCompanyOptions = useMemo(
    () => permitCompanyFilterOptions(categoryItems),
    [categoryItems]
  );
  useEffect(() => {
    if (permitCompanyFilter === "all" || permitCompanyFilter === MISSING_PERMIT_COMPANY_FILTER) return;
    if (!permitCompanyOptions.includes(permitCompanyFilter)) setPermitCompanyFilter("all");
  }, [permitCompanyFilter, permitCompanyOptions]);
  const visibleItems = useMemo(() => {
    const permitCompanyItems = categoryItems.filter((item) => matchesPermitCompanyFilter(item, permitCompanyFilter));
    const adoptionItems = adoptionStatusFilter === "all"
      ? permitCompanyItems
      : permitCompanyItems.filter((item) => (
          adoptionStatusFilter === "expected"
            ? Boolean(item.quoteAdoptionExpected)
            : !item.quoteAdoptionExpected
        ));
    const structureItems = structureStatusFilter === "all"
      ? adoptionItems
      : adoptionItems.filter((item) => {
          const isConfigured = getDistribution(item).isConfigured;
          return structureStatusFilter === "configured" ? isConfigured : !isConfigured;
        });
    if (!query) return structureItems;
    return structureItems.filter((item) => {
      const haystack = [
        item.productName,
        item.manufacturer,
        item.packagingUnit,
        ...(item.ingredients || []).flatMap((ingredient) => [ingredient.name, ingredient.content])
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [adoptionStatusFilter, categoryItems, permitCompanyFilter, query, structureStatusFilter]);

  useEffect(() => {
    if (visibleItems.length === 0) return;
    const selectedItemIsVisible = visibleItems.some((item) => String(item.id) === String(selectedItemId));
    if (!selectedItemIsVisible) onSelectedItemChange?.(visibleItems[0].id);
  }, [onSelectedItemChange, selectedItemId, visibleItems]);

  const selectedItem = visibleItems.find((item) => String(item.id) === String(selectedItemId)) || visibleItems[0] || null;
  const isEditing = selectedItem && String(editingItemId) === String(selectedItem.id);
  const distribution = getDistribution(selectedItem);
  const visiblePricingScenarios = useMemo(
    () => getPricingScenariosForItem(selectedItem, items),
    [items, selectedItem]
  );
  const comparisonCategoryOptions = useMemo(() => Array.from(new Set(
    items.map((item) => getDistribution(item).comparisonCategory).filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, "ko")), [items]);
  const comparisonGroupItems = useMemo(() => {
    if (!selectedItem) return [];
    if (!distribution.comparisonCategory) return [selectedItem];
    return items.filter((item) => (
      getDistribution(item).comparisonCategory === distribution.comparisonCategory
    ));
  }, [distribution.comparisonCategory, items, selectedItem]);
  const sharedCompetitors = useMemo(() => mergeCompetitors([
    selectedItem,
    ...comparisonGroupItems.filter((item) => String(item.id) !== String(selectedItem?.id))
  ].filter(Boolean)), [comparisonGroupItems, selectedItem]);
  const activePricingScenario = visiblePricingScenarios.find((scenario) => (
    String(scenario.id) === String(activePricingScenarioId)
  )) || visiblePricingScenarios[0];
  const baseAmounts = getBaseAmounts(selectedItem);
  const hasPermitCompanyFee = selectedItem?.category === "OTC" && selectedItem?.permitCompanyFee;
  const permitFeeRate = parseNumber(selectedItem?.permitCompanyFeeRate);
  const permitFeeRateUnknown = hasPermitCompanyFee && selectedItem?.permitCompanyFeeRateUnknown;
  const permitFeeStatus = !hasPermitCompanyFee
    ? "불포함"
    : (permitFeeRateUnknown || permitFeeRate === null ? "알 수 없음" : formatPercent(permitFeeRate));
  const permitFeeApplied = hasPermitCompanyFee && (permitFeeRateUnknown || permitFeeRate !== null);
  const chamyaksaMarginRate = parseNumber(activePricingScenario?.chamyaksaMarginRate);
  const marginRateIsValid = chamyaksaMarginRate !== null
    && chamyaksaMarginRate >= 0
    && chamyaksaMarginRate < 100;
  const chamyaksaSellingPrice = calculateSellingPriceFromMarginRate(
    baseAmounts.finalUnitCost,
    chamyaksaMarginRate
  );
  const chamyaksaMarginAmount = chamyaksaSellingPrice === null || baseAmounts.finalUnitCost === null
    ? null
    : chamyaksaSellingPrice - baseAmounts.finalUnitCost;
  const appliedQuantity = parseNumber(activePricingScenario?.minimumQuantity);
  const chamyaksaMarginAmountExcludingVat = chamyaksaMarginAmount === null ? null : chamyaksaMarginAmount / 1.1;
  const totalChamyaksaMarginAmount = chamyaksaMarginAmount === null || !appliedQuantity
    ? null
    : chamyaksaMarginAmount * appliedQuantity;
  const totalChamyaksaMarginAmountExcludingVat = chamyaksaMarginAmountExcludingVat === null || !appliedQuantity
    ? null
    : chamyaksaMarginAmountExcludingVat * appliedQuantity;
  const pharmacyPurchaseTotal = chamyaksaSellingPrice === null || !appliedQuantity
    ? null
    : chamyaksaSellingPrice * appliedQuantity;
  const pharmacySellingPrice = parseNumber(distribution.pharmacySellingPrice);
  const pharmacyMarginAmount = pharmacySellingPrice === null || chamyaksaSellingPrice === null
    ? null
    : pharmacySellingPrice - chamyaksaSellingPrice;
  const pharmacyMarginRate = pharmacySellingPrice && pharmacyMarginAmount !== null
    ? (pharmacyMarginAmount / pharmacySellingPrice) * 100
    : null;
  const bundleCandidateItems = items.filter((item) => item.category === selectedItem?.category);
  const bundleItemIdSet = new Set((activePricingScenario?.bundleItemIds || []).map(String));
  const bundleItems = bundleCandidateItems.filter((item) => bundleItemIdSet.has(String(item.id)));
  const bundleSellingPrice = parseNumber(activePricingScenario?.bundleSellingPrice);
  const bundleQuantity = appliedQuantity && appliedQuantity > 0 ? appliedQuantity : null;
  const bundleCostTotal = bundleQuantity && bundleItems.length > 0
    ? bundleItems.reduce((sum, item) => sum + (getBaseAmounts(item).finalUnitCost || 0), 0) * bundleQuantity
    : null;
  const bundleTotalUnits = bundleQuantity && bundleItems.length > 0
    ? bundleQuantity * bundleItems.length
    : null;
  const bundleCostPerUnit = bundleCostTotal !== null && bundleTotalUnits
    ? bundleCostTotal / bundleTotalUnits
    : null;
  const bundleMarginAmount = bundleSellingPrice === null || bundleCostTotal === null
    ? null
    : bundleSellingPrice - bundleCostTotal;
  const bundleMarginAmountExcludingVat = bundleMarginAmount === null ? null : bundleMarginAmount / 1.1;
  const bundleSellingPricePerUnit = bundleSellingPrice !== null && bundleTotalUnits
    ? bundleSellingPrice / bundleTotalUnits
    : null;
  const bundleMarginRate = bundleSellingPrice && bundleMarginAmount !== null
    ? (bundleMarginAmount / bundleSellingPrice) * 100
    : null;
  const categoryLabelById = Object.fromEntries(categories.map((category) => [category.id, category.label]));

  const createDistributionReport = () => {
    const rows = visiblePricingScenarios.map((scenario) => {
      const quantity = parseNumber(scenario.minimumQuantity);
      if (scenario.scenarioType === "bundle") {
        const selectedIds = new Set((scenario.bundleItemIds || []).map(String));
        const selectedProducts = items.filter((item) => selectedIds.has(String(item.id)));
        const cost = quantity
          ? selectedProducts.reduce((sum, item) => sum + (getBaseAmounts(item).finalUnitCost || 0), 0) * quantity
          : null;
        const sellingPrice = parseNumber(scenario.bundleSellingPrice);
        const margin = sellingPrice !== null && cost !== null ? sellingPrice - cost : null;
        return {
          type: "묶음 프로모션",
          label: scenario.label,
          products: selectedProducts.map(getItemLabel).join(" + "),
          quantity: quantity ? `각 ${quantity.toLocaleString("ko-KR")}개` : "-",
          cost,
          sellingPrice,
          margin,
          marginExVat: margin === null ? null : margin / 1.1,
          marginRate: sellingPrice && margin !== null ? (margin / sellingPrice) * 100 : null,
          pharmacySellingPrice: null,
          purchaseTotal: sellingPrice
        };
      }
      const sellingPrice = calculateSellingPriceFromMarginRate(baseAmounts.finalUnitCost, parseNumber(scenario.chamyaksaMarginRate));
      const margin = sellingPrice !== null && baseAmounts.finalUnitCost !== null ? sellingPrice - baseAmounts.finalUnitCost : null;
      return {
        type: "일반 가격대",
        label: scenario.label,
        products: getItemLabel(selectedItem),
        quantity: quantity ? `${quantity.toLocaleString("ko-KR")}개 이상` : "기본",
        cost: baseAmounts.finalUnitCost,
        sellingPrice,
        margin,
        marginExVat: margin === null ? null : margin / 1.1,
        marginRate: parseNumber(scenario.chamyaksaMarginRate),
        pharmacySellingPrice,
        purchaseTotal: sellingPrice !== null && quantity ? sellingPrice * quantity : null
      };
    });
    const headCells = ["구분", "가격대", "적용 제품", "적용 물량", "공급 원가(VAT 포함)", "참약사/묶음 판매가", "마진액(VAT 포함)", "마진액(VAT 미포함)", "마진율", "약국 판매가", "약국 구입 총액"];
    const rowHtml = rows.map((row) => `<tr>${[
      row.type, row.label, row.products || "-", row.quantity, formatWon(row.cost), formatWon(row.sellingPrice),
      formatWon(row.margin), formatWon(row.marginExVat), formatPercent(row.marginRate), formatWon(row.pharmacySellingPrice), formatWon(row.purchaseTotal)
    ].map((value) => `<td>${escapeReportMarkup(value)}</td>`).join("")}</tr>`).join("");
    const comparisonQuotes = comparisonGroupItems.map((item) => {
      const itemDistribution = getDistribution(item);
      const itemPricingScenarios = getPricingScenariosForItem(item, items);
      const scenario = itemPricingScenarios.find((entry) => String(entry.id) === String(comparisonScenarioByItemId[item.id])) || itemPricingScenarios[0];
      const amounts = getBaseAmounts(item);
      const expectedSellingPrice = scenario?.scenarioType === "bundle"
        ? parseNumber(scenario.bundleSellingPrice)
        : calculateSellingPriceFromMarginRate(amounts.finalUnitCost, parseNumber(scenario?.chamyaksaMarginRate));
      return {
        productName: item.productName || "-",
        manufacturer: item.manufacturer || "-",
        permitCompany: item.permitCompany || "-",
        packagingUnit: item.packagingUnit || "-",
        quantity: item.quantity || "-",
        scenario: `${scenario?.label || "기본"}${scenario?.scenarioType === "bundle" ? " (묶음)" : ""}`,
        vatUnitPrice: amounts.vatUnitPrice,
        finalUnitCost: amounts.finalUnitCost,
        expectedSellingPrice,
        marginRate: scenario?.scenarioType === "bundle" ? "묶음 총액" : formatPercent(parseNumber(scenario?.chamyaksaMarginRate)),
        pharmacySellingPrice: parseNumber(itemDistribution.pharmacySellingPrice)
      };
    });
    const comparisonQuoteHeaders = ["제품명", "제조사", "허가사", "포장단위", "배치 당 포장단위 개수", "가격대", "VAT 포함 단가", "최종 공급사 판매가", "참약사 예상 판매가", "예상 마진율", "약국 판매가"];
    const comparisonQuoteRows = comparisonQuotes.map((quote) => `<tr>${[
      quote.productName, quote.manufacturer, quote.permitCompany, quote.packagingUnit, quote.quantity, quote.scenario,
      formatWon(quote.vatUnitPrice), formatWon(quote.finalUnitCost), formatWon(quote.expectedSellingPrice), quote.marginRate, formatWon(quote.pharmacySellingPrice)
    ].map((value) => `<td>${escapeReportMarkup(value)}</td>`).join("")}</tr>`).join("");
    const competitors = sharedCompetitors.map((competitor) => ({
      date: competitor.date || "-",
      productName: competitor.productName || "-",
      salesChannel: competitor.salesChannel || "-",
      packagingUnit: competitor.packagingUnit || "-",
      prices: getCompetitorPriceTiers(competitor).map((tier) => `${tier.label}: ${formatEnteredPrice(tier.price)}`).join(" / ") || "-",
      memo: competitor.memo || "-"
    }));
    const competitorRows = competitors.map((competitor) => (
      `<tr>${[competitor.date, competitor.productName, competitor.salesChannel, competitor.packagingUnit, competitor.prices, competitor.memo].map((value) => `<td>${escapeReportMarkup(value)}</td>`).join("")}</tr>`
    )).join("");
    return {
      title: getItemLabel(selectedItem),
      rows,
      comparisonQuotes,
      competitors,
      html: `<div class="report"><h1>유통 구조 정책 보고서</h1><h2>${escapeReportMarkup(getItemLabel(selectedItem))}</h2><p>${escapeReportMarkup(selectedItem.manufacturer || "제조사 미입력")} · ${escapeReportMarkup(categoryLabelById[selectedItem.category] || selectedItem.category)} · 생성 ${escapeReportMarkup(new Date().toLocaleString("ko-KR"))}</p><h3>공급 기준</h3><table><tbody><tr><th>포장단위</th><td>${escapeReportMarkup(selectedItem.packagingUnit || "-")}</td><th>배치 당 포장단위 개수</th><td>${escapeReportMarkup(baseAmounts.quantity === null ? "-" : `${baseAmounts.quantity.toLocaleString("ko-KR")}개`)}</td><th>최소 주문단위</th><td>${escapeReportMarkup(baseAmounts.minimumOrderQuantity === null ? "-" : `${baseAmounts.minimumOrderQuantity.toLocaleString("ko-KR")}개 (${baseAmounts.minimumOrderBatches}배치)`)}</td><th>최종 공급사 판매가</th><td>${escapeReportMarkup(formatWon(baseAmounts.finalUnitCost))}</td><th>최소 주문 총액</th><td>${escapeReportMarkup(formatWon(baseAmounts.minimumOrderFinalTotal))}</td></tr></tbody></table><h3>가격대 및 묶음 프로모션 전체</h3><table><thead><tr>${headCells.map((value) => `<th>${value}</th>`).join("")}</tr></thead><tbody>${rowHtml}</tbody></table><h3>제조사 견적 비교${distribution.comparisonCategory ? ` · ${escapeReportMarkup(distribution.comparisonCategory)}` : ""}</h3><table><thead><tr>${comparisonQuoteHeaders.map((value) => `<th>${value}</th>`).join("")}</tr></thead><tbody>${comparisonQuoteRows}</tbody></table><h3>경쟁제품 비교</h3><table><thead><tr>${["기준일", "경쟁제품명", "판매처", "포장단위", "판매구간 및 단가", "비고"].map((value) => `<th>${value}</th>`).join("")}</tr></thead><tbody>${competitorRows || '<tr><td colspan="6">등록된 경쟁제품 없음</td></tr>'}</tbody></table></div>`
    };
  };

  const downloadDistributionExcel = () => {
    if (!selectedItem) return;
    const report = createDistributionReport();
    const css = `<style>body{font-family:Arial,'Malgun Gothic',sans-serif;color:#0f172a}h1{font-size:22px}h2{font-size:17px}h3{margin-top:20px;font-size:14px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #94a3b8;padding:7px;font-size:11px;text-align:left;vertical-align:top}th{background:#dbeafe;font-weight:700}</style>`;
    downloadReportBlob(new Blob([`\uFEFF<html><head><meta charset="utf-8">${css}</head><body>${report.html}</body></html>`], { type: "application/vnd.ms-excel;charset=utf-8" }), `${reportFileName(report.title)}_유통구조.xls`);
  };

  const downloadDistributionImage = async () => {
    if (!selectedItem) return;
    const report = createDistributionReport();
    try {
      const width = 2200;
      const margin = 40;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.max(2200, 1250 + (report.rows.length * 260) + (report.comparisonQuotes.length * 180) + (report.competitors.length * 160));
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#0f172a";
      context.textBaseline = "top";
      context.font = "700 38px 'Malgun Gothic', Arial, sans-serif";
      context.fillText("유통 구조 정책 보고서", margin, margin);
      context.font = "700 28px 'Malgun Gothic', Arial, sans-serif";
      context.fillText(report.title, margin, 102);
      context.font = "18px 'Malgun Gothic', Arial, sans-serif";
      context.fillStyle = "#475569";
      context.fillText(`${selectedItem.manufacturer || "제조사 미입력"} · ${categoryLabelById[selectedItem.category] || selectedItem.category} · 생성 ${new Date().toLocaleString("ko-KR")}`, margin, 148);

      context.fillStyle = "#0f172a";
      context.font = "700 22px 'Malgun Gothic', Arial, sans-serif";
      context.fillText("공급 기준", margin, 198);
      let y = drawCanvasTable(context, {
        headers: ["포장단위", "배치 당 포장단위 개수", "최소 주문단위", "최종 공급사 판매가", "최소 주문 총액"],
        rows: [[selectedItem.packagingUnit || "-", baseAmounts.quantity === null ? "-" : `${baseAmounts.quantity.toLocaleString("ko-KR")}개`, baseAmounts.minimumOrderQuantity === null ? "-" : `${baseAmounts.minimumOrderQuantity.toLocaleString("ko-KR")}개 (${baseAmounts.minimumOrderBatches}배치)`, formatWon(baseAmounts.finalUnitCost), formatWon(baseAmounts.minimumOrderFinalTotal)]],
        widths: [360, 430, 500, 430, 400],
        x: margin,
        y: 232
      });

      context.fillStyle = "#0f172a";
      context.font = "700 22px 'Malgun Gothic', Arial, sans-serif";
      context.fillText("가격대 및 묶음 프로모션 전체", margin, y + 34);
      y = drawCanvasTable(context, {
        headers: ["구분", "가격대", "적용 제품", "적용 물량", "공급 원가", "참약사/묶음 판매가", "마진액 VAT 포함", "마진액 VAT 미포함", "마진율", "약국 판매가", "약국 구입 총액"],
        rows: report.rows.map((row) => [
          row.type, row.label, row.products || "-", row.quantity, formatWon(row.cost), formatWon(row.sellingPrice),
          formatWon(row.margin), formatWon(row.marginExVat), formatPercent(row.marginRate), formatWon(row.pharmacySellingPrice), formatWon(row.purchaseTotal)
        ]),
        widths: [125, 150, 350, 130, 155, 190, 170, 180, 115, 155, 200],
        x: margin,
        y: y + 70
      });

      context.fillStyle = "#0f172a";
      context.font = "700 22px 'Malgun Gothic', Arial, sans-serif";
      context.fillText(`제조사 견적 비교${distribution.comparisonCategory ? ` · ${distribution.comparisonCategory}` : ""}`, margin, y + 34);
      y = drawCanvasTable(context, {
        headers: ["제품명/제조사", "허가사", "포장단위", "배치 수량", "가격대", "VAT 포함", "최종 원가", "예상 판매가", "마진율", "약국 판매가"],
        rows: report.comparisonQuotes.map((quote) => [`${quote.productName}\n${quote.manufacturer}`, quote.permitCompany, quote.packagingUnit, quote.quantity, quote.scenario, formatWon(quote.vatUnitPrice), formatWon(quote.finalUnitCost), formatWon(quote.expectedSellingPrice), quote.marginRate, formatWon(quote.pharmacySellingPrice)]),
        widths: [330, 210, 180, 180, 220, 190, 190, 210, 160, 230], x: margin, y: y + 70
      });
      context.fillStyle = "#0f172a";
      context.font = "700 22px 'Malgun Gothic', Arial, sans-serif";
      context.fillText("경쟁제품 비교", margin, y + 34);
      y = drawCanvasTable(context, {
        headers: ["기준일", "경쟁제품명", "판매처", "포장단위", "판매구간 및 단가", "비고"],
        rows: report.competitors.length > 0
          ? report.competitors.map((competitor) => [competitor.date, competitor.productName, competitor.salesChannel, competitor.packagingUnit, competitor.prices, competitor.memo])
          : [["-", "등록된 경쟁제품 없음", "-", "-", "-", "-"]],
        widths: [220, 420, 320, 260, 520, 380],
        x: margin,
        y: y + 70
      });

      const output = document.createElement("canvas");
      output.width = width;
      output.height = Math.ceil(y + margin);
      output.getContext("2d").drawImage(canvas, 0, 0, width, output.height, 0, 0, width, output.height);
      const blob = await new Promise((resolve) => output.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("이미지 생성 실패");
      downloadReportBlob(blob, `${reportFileName(report.title)}_유통구조.png`);
    } catch (error) {
      console.error("유통 구조 이미지 저장 실패", error);
      window.alert("이미지를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  useEffect(() => {
    setComparisonCategoryDraft(distribution.comparisonCategory);
  }, [distribution.comparisonCategory, selectedItem?.id]);

  const updateDistribution = (patch) => {
    if (!selectedItem) return;
    onUpdateItem?.(selectedItem.id, {
      distributionStructure: {
        ...distribution,
        ...patch,
        updatedAt: new Date().toISOString()
      }
    });
  };

  const updateSharedCompetitors = (competitors) => {
    const targetItems = distribution.comparisonCategory ? comparisonGroupItems : [selectedItem];
    const updatedAt = new Date().toISOString();
    targetItems.filter(Boolean).forEach((item) => {
      onUpdateItem?.(item.id, {
        distributionStructure: {
          ...getDistribution(item),
          competitors,
          updatedAt
        }
      });
    });
  };

  const applyComparisonCategory = () => {
    if (!selectedItem) return;
    const nextCategory = normalizeComparisonCategory(comparisonCategoryDraft);
    const nextGroupItems = nextCategory
      ? items.filter((item) => getDistribution(item).comparisonCategory === nextCategory)
      : [];
    const competitors = mergeCompetitors([selectedItem, ...nextGroupItems]);
    const updatedAt = new Date().toISOString();

    nextGroupItems.forEach((item) => {
      onUpdateItem?.(item.id, {
        distributionStructure: {
          ...getDistribution(item),
          competitors,
          updatedAt
        }
      });
    });
    onUpdateItem?.(selectedItem.id, {
      distributionStructure: {
        ...distribution,
        comparisonCategory: nextCategory,
        competitors,
        updatedAt
      }
    });
  };

  const clearComparisonCategory = () => {
    if (!selectedItem || !distribution.comparisonCategory) return;
    onUpdateItem?.(selectedItem.id, {
      distributionStructure: {
        ...distribution,
        comparisonCategory: "",
        competitors: sharedCompetitors,
        updatedAt: new Date().toISOString()
      }
    });
    setComparisonCategoryDraft("");
  };

  const openComparisonItem = (itemId) => {
    onSelectedItemChange?.(itemId);
    window.requestAnimationFrame(() => {
      document.querySelector(".decision-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const updatePricingScenario = (patch) => {
    if (!activePricingScenario) return;
    const ownerId = String(activePricingScenario._ownerItemId || selectedItem?.id || "");
    const ownerItem = items.find((item) => String(item.id) === ownerId);
    if (!ownerItem) return;
    const ownerDistribution = getDistribution(ownerItem);
    onUpdateItem?.(ownerItem.id, {
      distributionStructure: {
        ...ownerDistribution,
        pricingScenarios: ownerDistribution.pricingScenarios.map((scenario) => (
        String(scenario.id) === String(activePricingScenario.id) ? { ...scenario, ...patch } : scenario
        )),
        updatedAt: new Date().toISOString()
      }
    });
  };

  const reorderPricingScenarios = (draggedKey, targetKey) => {
    if (!draggedKey || !targetKey || draggedKey === targetKey) return;
    const draggedScenario = visiblePricingScenarios.find((scenario) => (
      pricingScenarioKey(scenario, selectedItem?.id) === draggedKey
    ));
    const targetScenario = visiblePricingScenarios.find((scenario) => (
      pricingScenarioKey(scenario, selectedItem?.id) === targetKey
    ));
    if (!draggedScenario || !targetScenario || draggedScenario.scenarioType !== targetScenario.scenarioType) return;

    if (draggedScenario.scenarioType !== "bundle") {
      const ownerId = String(draggedScenario._ownerItemId || selectedItem?.id || "");
      if (ownerId !== String(targetScenario._ownerItemId || selectedItem?.id || "")) return;
      const ownerItem = items.find((item) => String(item.id) === ownerId);
      if (!ownerItem) return;
      const ownerDistribution = getDistribution(ownerItem);
      const singleScenarios = ownerDistribution.pricingScenarios.filter((scenario) => scenario.scenarioType !== "bundle");
      const bundleScenarios = ownerDistribution.pricingScenarios.filter((scenario) => scenario.scenarioType === "bundle");
      const sourceIndex = singleScenarios.findIndex((scenario) => String(scenario.id) === String(draggedScenario.id));
      const targetIndex = singleScenarios.findIndex((scenario) => String(scenario.id) === String(targetScenario.id));
      if (sourceIndex < 0 || targetIndex < 0) return;
      const nextSingleScenarios = [...singleScenarios];
      const [movedScenario] = nextSingleScenarios.splice(sourceIndex, 1);
      nextSingleScenarios.splice(targetIndex, 0, movedScenario);
      onUpdateItem?.(ownerItem.id, {
        distributionStructure: {
          ...ownerDistribution,
          pricingScenarios: [...nextSingleScenarios, ...bundleScenarios],
          updatedAt: new Date().toISOString()
        }
      });
      setActivePricingScenarioId(movedScenario.id);
      return;
    }

    const allBundleScenarios = items.flatMap((item) => (
      getDistribution(item).pricingScenarios
        .filter((scenario) => scenario.scenarioType === "bundle")
        .map((scenario) => ({ ...scenario, _ownerItemId: String(item.id) }))
    )).sort((left, right) => {
      const leftOrder = Number.isFinite(left.bundleOrder) ? left.bundleOrder : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(right.bundleOrder) ? right.bundleOrder : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
    const sourceIndex = allBundleScenarios.findIndex((scenario) => pricingScenarioKey(scenario) === draggedKey);
    const targetIndex = allBundleScenarios.findIndex((scenario) => pricingScenarioKey(scenario) === targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const nextBundleScenarios = [...allBundleScenarios];
    const [movedScenario] = nextBundleScenarios.splice(sourceIndex, 1);
    nextBundleScenarios.splice(targetIndex, 0, movedScenario);
    const orderByKey = new Map(nextBundleScenarios.map((scenario, index) => [
      pricingScenarioKey(scenario),
      index + 1
    ]));
    const updatedAt = new Date().toISOString();

    items.forEach((item) => {
      const ownerId = String(item.id);
      const ownerDistribution = getDistribution(item);
      if (!ownerDistribution.pricingScenarios.some((scenario) => scenario.scenarioType === "bundle")) return;
      const nextScenarios = ownerDistribution.pricingScenarios.map((scenario) => {
        if (scenario.scenarioType !== "bundle") return scenario;
        const bundleOrder = orderByKey.get(`${ownerId}::${String(scenario.id)}`);
        return Number.isFinite(bundleOrder) ? { ...scenario, bundleOrder } : scenario;
      });
      onUpdateItem?.(item.id, {
        distributionStructure: {
          ...ownerDistribution,
          pricingScenarios: [
            ...nextScenarios.filter((scenario) => scenario.scenarioType !== "bundle"),
            ...nextScenarios
              .filter((scenario) => scenario.scenarioType === "bundle")
              .sort((left, right) => (left.bundleOrder ?? Number.MAX_SAFE_INTEGER) - (right.bundleOrder ?? Number.MAX_SAFE_INTEGER))
          ],
          updatedAt
        }
      });
    });
    setActivePricingScenarioId(movedScenario.id);
  };

  const addPricingScenario = () => {
    const nextScenario = createPricingScenario(distribution.pricingScenarios.length);
    updateDistribution({ pricingScenarios: [...distribution.pricingScenarios, nextScenario] });
    setActivePricingScenarioId(nextScenario.id);
  };

  const addBundlePricingScenario = () => {
    const bundleOrderStats = items.reduce((stats, item) => (
      getDistribution(item).pricingScenarios.reduce((itemStats, scenario) => {
        if (scenario.scenarioType !== "bundle") return itemStats;
        return {
          count: itemStats.count + 1,
          highestOrder: Number.isFinite(scenario.bundleOrder)
            ? Math.max(itemStats.highestOrder, scenario.bundleOrder)
            : itemStats.highestOrder
        };
      }, stats)
    ), { count: 0, highestOrder: 0 });
    const nextBundleOrder = Math.max(bundleOrderStats.count, bundleOrderStats.highestOrder) + 1;
    const nextScenario = {
      ...createPricingScenario(distribution.pricingScenarios.length, "bundle", selectedItem?.id),
      bundleOrder: nextBundleOrder
    };
    updateDistribution({ pricingScenarios: [...distribution.pricingScenarios, nextScenario] });
    setActivePricingScenarioId(nextScenario.id);
  };

  const toggleBundleItem = (itemId) => {
    if (!activePricingScenario) return;
    const id = String(itemId);
    const ownerId = String(activePricingScenario._ownerItemId || selectedItem?.id || "");
    const nextIds = new Set((activePricingScenario.bundleItemIds || []).map(String));
    if (nextIds.has(id)) {
      if (id === ownerId) return;
      nextIds.delete(id);
    } else {
      nextIds.add(id);
    }
    if (ownerId) nextIds.add(ownerId);
    updatePricingScenario({ bundleItemIds: [...nextIds] });
  };

  const removeActivePricingScenario = () => {
    const ownerId = String(activePricingScenario?._ownerItemId || selectedItem?.id || "");
    const ownerItem = items.find((item) => String(item.id) === ownerId);
    const ownerDistribution = getDistribution(ownerItem);
    if (!activePricingScenario || !ownerItem || (activePricingScenario.scenarioType !== "bundle" && ownerDistribution.pricingScenarios.length <= 1)) {
      window.alert("가격대 탭은 최소 1개가 필요합니다.");
      return;
    }
    if (!window.confirm(`"${activePricingScenario.label || "가격대"}" 탭을 삭제하시겠습니까?`)) return;
    const nextScenarios = ownerDistribution.pricingScenarios.filter((scenario) => (
      String(scenario.id) !== String(activePricingScenario.id)
    ));
    onUpdateItem?.(ownerItem.id, {
      distributionStructure: {
        ...ownerDistribution,
        pricingScenarios: nextScenarios,
        updatedAt: new Date().toISOString()
      }
    });
    setActivePricingScenarioId(distribution.pricingScenarios[0]?.id || null);
  };

  const resetDistributionStructure = () => {
    if (!selectedItem || !distribution.updatedAt) return;
    if (!window.confirm(
      "이 공급단가 건의 판매가·마진 설정과 경쟁제품 비교 내용을 모두 초기화하시겠습니까?\n초기화 후 유통 구조 미설정 상태로 돌아갑니다."
    )) return;
    onUpdateItem?.(selectedItem.id, { distributionStructure: {} });
    setActivePricingScenarioId(null);
    setEditingItemId(null);
  };

  const completeDistributionStructure = () => {
    if (!selectedItem || distribution.isConfigured) return;
    updateDistribution({
      isConfigured: true,
      configuredAt: new Date().toISOString()
    });
  };

  const updateCompetitor = (competitorId, patch) => {
    updateSharedCompetitors(
      sharedCompetitors.map((competitor) => (
        String(competitor.id) === String(competitorId) ? { ...competitor, ...patch } : competitor
      ))
    );
  };

  const updateCompetitorPriceTier = (competitorId, tierId, patch) => {
    const competitor = sharedCompetitors.find((entry) => String(entry.id) === String(competitorId));
    if (!competitor) return;
    const priceTiers = getCompetitorPriceTiers(competitor).map((tier) => (
      String(tier.id) === String(tierId) ? { ...tier, ...patch } : tier
    ));
    updateCompetitor(competitorId, {
      priceTiers,
      salePrice: priceTiers[0]?.price || ""
    });
  };

  const addCompetitorPriceTier = (competitorId) => {
    const competitor = sharedCompetitors.find((entry) => String(entry.id) === String(competitorId));
    if (!competitor) return;
    const priceTiers = getCompetitorPriceTiers(competitor);
    updateCompetitor(competitorId, {
      priceTiers: [...priceTiers, createPriceTier(priceTiers.length)],
      salePrice: priceTiers[0]?.price || ""
    });
  };

  const removeCompetitorPriceTier = (competitorId, tierId) => {
    const competitor = sharedCompetitors.find((entry) => String(entry.id) === String(competitorId));
    if (!competitor) return;
    const priceTiers = getCompetitorPriceTiers(competitor).filter((tier) => String(tier.id) !== String(tierId));
    updateCompetitor(competitorId, {
      priceTiers,
      salePrice: priceTiers[0]?.price || ""
    });
  };

  return (
    <div className="distribution-root">
      <section style={{ ...panelStyle, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: "#0f172a", fontSize: 23 }}>유통 구조 설정</h1>
            <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 14 }}>
              공급단가를 기준으로 참약사와 약국의 판매가 및 마진 구조를 건별로 설정합니다.
            </p>
          </div>
          <div style={{ color: syncState?.status === "error" ? "#dc2626" : "#059669", fontSize: 12, fontWeight: 800, textAlign: "right" }}>
            {syncState?.message || "변경 내용 자동 저장"}
          </div>
        </div>
      </section>

      <div className="distribution-layout">
        <aside style={{ ...panelStyle, minWidth: 0, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #dbe3ee", background: "#f8fafc" }}>
            <label htmlFor="distribution-search" style={labelStyle}>공급단가 건 검색</label>
            <div style={{ marginBottom: 7, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <label
                htmlFor="distribution-adoption-filter"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#475569",
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  fontWeight: 800
                }}
              >
                채택
                <select
                  id="distribution-adoption-filter"
                  value={adoptionStatusFilter}
                  onChange={(event) => setAdoptionStatusFilter(event.target.value)}
                  style={{
                    minHeight: 30,
                    padding: "4px 25px 4px 7px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    color: "#334155",
                    fontSize: 11,
                    fontWeight: 800
                  }}
                >
                  <option value="all">전체</option>
                  <option value="expected">채택 예상</option>
                  <option value="reconsider">채택 재고</option>
                </select>
              </label>
              <label
                htmlFor="distribution-structure-status-filter"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#475569",
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  fontWeight: 800
                }}
              >
                구조
                <select
                  id="distribution-structure-status-filter"
                  value={structureStatusFilter}
                  onChange={(event) => setStructureStatusFilter(event.target.value)}
                  style={{
                    minHeight: 30,
                    padding: "4px 25px 4px 7px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    color: "#334155",
                    fontSize: 11,
                    fontWeight: 800
                  }}
                >
                  <option value="all">전체</option>
                  <option value="configured">설정됨</option>
                  <option value="unconfigured">미설정</option>
                </select>
              </label>
            </div>
            <select
              value={permitCompanyFilter}
              onChange={(event) => setPermitCompanyFilter(event.target.value)}
              aria-label="허가사 필터"
              style={{ ...inputStyle, minHeight: 34, marginBottom: 7, fontSize: 12 }}
            >
              <option value="all">전체 허가사</option>
              {permitCompanyOptions.map((permitCompany) => <option key={permitCompany} value={permitCompany}>{permitCompany}</option>)}
              <option value={MISSING_PERMIT_COMPANY_FILTER}>허가사 미입력</option>
            </select>
            <input
              id="distribution-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="제품명, 성분명 또는 제조사"
              style={inputStyle}
            />
          </div>
          <div style={{ maxHeight: "calc(100vh - 236px)", overflowY: "auto", padding: 8 }}>
            {visibleItems.map((item) => {
              const active = selectedItem && String(item.id) === String(selectedItem.id);
              const structure = getDistribution(item);
              const fullLabel = getItemLabel(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectedItemChange?.(item.id)}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    maxWidth: "100%",
                    overflow: "hidden",
                    marginBottom: 7,
                    padding: "11px 10px",
                    border: `1px solid ${active ? "#2563eb" : "#dbe3ee"}`,
                    borderRadius: 7,
                    background: active ? "#eff6ff" : "#fff",
                    color: "#0f172a",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div style={{ width: "100%", minWidth: 0, display: "flex", justifyContent: "space-between", gap: 8, overflow: "hidden" }}>
                    <IngredientAmountTitle label={fullLabel} maxFontSize={14} minFontSize={12} />
                    <span style={{ flex: "0 0 auto", color: "#64748b", fontSize: 11 }}>
                      {categoryLabelById[item.category] || item.category}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                    {item.manufacturer || "제조사 미입력"} · {item.quoteDate || "견적일 미입력"}
                  </div>
                  <div style={{ marginTop: 3, color: "#475569", fontSize: 11, fontWeight: 700 }}>
                    포장단위: {item.packagingUnit || "미입력"}
                    {item.packagingForm ? ` · 포장형태: ${item.packagingForm}` : ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 7, marginTop: 5, fontSize: 11, fontWeight: 700 }}>
                    <span style={{ color: structure.isConfigured ? "#047857" : "#94a3b8" }}>
                      {structure.isConfigured ? "유통 구조 설정됨" : "유통 구조 미설정"}
                    </span>
                    <span style={{ color: item.quoteAdoptionExpected ? "#047857" : "#b45309" }}>
                      {item.quoteAdoptionExpected ? "채택 예상" : "채택 재고"}
                    </span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ ...marketDecisionBadgeStyle(item.marketDecisionStatus), minHeight: 21, padding: "2px 7px", fontSize: 11 }}>
                      검토결과 · {marketDecisionLabel(item.marketDecisionStatus)}
                    </span>
                  </div>
                </button>
              );
            })}
            {visibleItems.length === 0 && (
              <div style={{ padding: 18, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                표시할 공급단가 건이 없습니다.
              </div>
            )}
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          {!selectedItem ? (
            <section style={{ ...panelStyle, padding: 28, color: "#64748b", textAlign: "center" }}>
              공급단가 건을 먼저 등록하거나 왼쪽 목록에서 선택해주세요.
            </section>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="decision-grid">
              <section style={panelStyle}>
                <div className="supply-summary-header" style={{ padding: "13px 15px", borderBottom: "1px solid #cbd5e1", background: "#e8f1fb" }}>
                  <div className="supply-summary-title" style={{ minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
                    <IngredientAmountTitle label={getItemLabel(selectedItem)} maxFontSize={17} minFontSize={12} />
                    <div style={{ marginTop: 3, color: "#64748b", fontSize: 12 }}>
                      {selectedItem.manufacturer || "제조사 미입력"} · {categoryLabelById[selectedItem.category] || selectedItem.category}
                    </div>
                  </div>
                  <div className="supply-summary-actions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, minWidth: 0, flexWrap: "wrap" }}>
                    <label style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      borderRadius: 5,
                      border: `1px solid ${selectedItem.quoteAdoptionExpected ? "#a7f3d0" : "#fde68a"}`,
                      background: selectedItem.quoteAdoptionExpected ? "#ecfdf5" : "#fffbeb",
                      color: selectedItem.quoteAdoptionExpected ? "#047857" : "#b45309",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer"
                    }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedItem.quoteAdoptionExpected)}
                        onChange={(event) => onUpdateItem?.(selectedItem.id, { quoteAdoptionExpected: event.target.checked })}
                        aria-label="견적 채택 예상"
                      />
                      {selectedItem.quoteAdoptionExpected ? "채택 예상" : "채택 재고"}
                    </label>
                    <span style={marketDecisionBadgeStyle(selectedItem.marketDecisionStatus)}>
                      검토결과 · {marketDecisionLabel(selectedItem.marketDecisionStatus)}
                    </span>
                    <div style={{ display: "grid", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => onOpenSupply?.(selectedItem.id)}
                        style={{
                          minHeight: 32,
                          padding: "6px 11px",
                          border: "1px solid #93c5fd",
                          borderRadius: 6,
                          background: "#fff",
                          color: "#1d4ed8",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: "nowrap"
                        }}
                      >
                        공급단가 보기
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenMarket?.(selectedItem.id)}
                        style={{
                          minHeight: 32,
                          padding: "6px 11px",
                          border: "1px solid #86efac",
                          borderRadius: 6,
                          background: "#f0fdf4",
                          color: "#047857",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: "nowrap"
                        }}
                      >
                        시장 규모 분석
                      </button>
                    </div>
                  </div>
                </div>
                <div className="base-grid">
                  <div style={{ minWidth: 0, padding: 13, borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", overflow: "hidden" }}>
                    <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>포장단위</div>
                    <div style={{ marginTop: 7, color: "#0f172a", fontSize: 16, fontWeight: 900 }}>{selectedItem.packagingUnit || "-"}</div>
                    {selectedItem.packagingForm && <div style={{ marginTop: 4, color: "#64748b", fontSize: 11 }}>포장형태: {selectedItem.packagingForm}</div>}
                  </div>
                  <div className="fee-projection-cell">
                    <div className="fee-projection-title">배치 당 포장단위 개수</div>
                    <div className="fee-projection-section">
                      <div className="fee-projection-label">1배치 기준</div>
                      <div className="fee-projection-value">{baseAmounts.quantity === null ? "-" : `${baseAmounts.quantity.toLocaleString("ko-KR")}개`}</div>
                    </div>
                    <div className="fee-projection-section fee-projection-adjusted">
                      <div className="fee-projection-label">최소 주문단위</div>
                      <div className="fee-projection-value">{baseAmounts.minimumOrderQuantity === null ? "-" : `${baseAmounts.minimumOrderQuantity.toLocaleString("ko-KR")}개`}</div>
                      <div className="fee-projection-note">최소 주문 {baseAmounts.minimumOrderBatches}배치</div>
                    </div>
                  </div>
                  <div className="fee-projection-cell">
                    <div className="fee-projection-title">배치 당 공급단가</div>
                    <div className="fee-projection-section">
                      <div className="fee-projection-label">기본</div>
                      <div className="fee-projection-value">{formatWon(baseAmounts.unitPrice)}</div>
                      <div className="fee-projection-note">총 금액: {formatWon(baseAmounts.supplyTotal)}</div>
                    </div>
                    <div className="fee-projection-section fee-projection-adjusted">
                      <div className="fee-projection-label">허가사 수수료 반영 시</div>
                      <div className="fee-projection-value">{formatWon(baseAmounts.permitFeeUnitPrice)}</div>
                      <div className="fee-projection-note">총 금액: {formatWon(baseAmounts.permitFeeSupplyTotal)}{permitFeeRateUnknown ? " · 공급단가에 포함" : ""}</div>
                    </div>
                  </div>
                  <div className="fee-projection-cell">
                    <div className="fee-projection-title">배치 당 VAT 포함 가격</div>
                    <div className="fee-projection-section">
                      <div className="fee-projection-label">기본</div>
                      <div className="fee-projection-value">{formatWon(baseAmounts.vatUnitPrice)}</div>
                      <div className="fee-projection-note">VAT 포함 총금액: {formatWon(baseAmounts.vatTotal)}</div>
                    </div>
                    <div className="fee-projection-section fee-projection-adjusted">
                      <div className="fee-projection-label">허가사 수수료 반영 시</div>
                      <div className="fee-projection-value">{formatWon(baseAmounts.permitFeeVatUnitPrice)}</div>
                      <div className="fee-projection-note">총 금액: {formatWon(baseAmounts.permitFeeVatTotal)}{permitFeeRateUnknown ? " · 공급단가에 포함" : ""}</div>
                    </div>
                  </div>
                  <div style={{ minWidth: 0, padding: 13, borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", overflow: "hidden" }}>
                    <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>허가사 수수료</div>
                    <div style={{ marginTop: 7, color: "#0f172a", fontSize: 16, fontWeight: 900 }}>{permitFeeStatus}</div>
                    {hasPermitCompanyFee && <div style={{ marginTop: 4, color: "#64748b", fontSize: 11, lineHeight: 1.45, whiteSpace: "pre-line" }}>허가사: {selectedItem.permitCompany || "미입력"}{permitFeeRateUnknown ? "\n공급단가에 포함" : ""}</div>}
                  </div>
                  <div className="fee-projection-cell">
                    <div className="fee-projection-title">최종 공급사 판매가</div>
                    <div className="fee-projection-section">
                      <div className="fee-projection-label">1배치 기준</div>
                      <div className="fee-projection-value">{formatWon(baseAmounts.finalTotal)}</div>
                      <div className="fee-projection-note">개당: {formatWon(baseAmounts.finalUnitCost)}</div>
                    </div>
                    <div className="fee-projection-section fee-projection-adjusted">
                      <div className="fee-projection-label">최소 주문단위</div>
                      <div className="fee-projection-value">{formatWon(baseAmounts.minimumOrderFinalTotal)}</div>
                      <div className="fee-projection-note">{baseAmounts.minimumOrderBatches}배치 · {permitFeeApplied ? (permitFeeRateUnknown ? "VAT 반영 · 허가사 수수료 포함" : "VAT·허가사 수수료 반영") : "VAT 반영"}</div>
                    </div>
                  </div>
                </div>
              </section>

              <section style={panelStyle}>
                <div style={{ padding: "12px 15px", borderBottom: "1px solid #cbd5e1" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 900 }}>판매가 및 마진 설정</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, flexWrap: "wrap" }}>
                      <button type="button" onClick={downloadDistributionExcel} style={{ ...secondaryButtonStyle, minHeight: 32, padding: "5px 9px", fontSize: 12 }}>Excel 다운로드</button>
                      <button type="button" onClick={downloadDistributionImage} style={{ ...secondaryButtonStyle, minHeight: 32, padding: "5px 9px", fontSize: 12 }}>이미지 저장</button>
                      <button
                        type="button"
                        onClick={completeDistributionStructure}
                        disabled={distribution.isConfigured}
                        style={{
                          minHeight: 32,
                          padding: "5px 10px",
                          border: `1px solid ${distribution.isConfigured ? "#a7f3d0" : "#2563eb"}`,
                          borderRadius: 6,
                          background: distribution.isConfigured ? "#ecfdf5" : "#2563eb",
                          color: distribution.isConfigured ? "#047857" : "#fff",
                          cursor: distribution.isConfigured ? "default" : "pointer",
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {distribution.isConfigured ? "설정 완료됨" : "설정 완료"}
                      </button>
                      <button type="button" onClick={addPricingScenario} style={{ ...secondaryButtonStyle, minHeight: 32, padding: "5px 9px", fontSize: 12 }}>
                        + 가격대 탭 추가
                      </button>
                      <button type="button" onClick={addBundlePricingScenario} style={{ ...secondaryButtonStyle, minHeight: 32, padding: "5px 9px", fontSize: 12 }}>
                        + 묶음 프로모션
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 4, color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
                    모든 금액은 VAT 포함 기준입니다.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderBottom: "1px solid #dbe3ee", background: "#f8fafc", overflowX: "auto" }}>
                  {visiblePricingScenarios.map((scenario, index) => {
                    const active = String(scenario.id) === String(activePricingScenario?.id);
                    const scenarioDragKey = pricingScenarioKey(scenario, selectedItem?.id);
                    const canReorder = scenario.scenarioType === "bundle"
                      || String(scenario._ownerItemId || selectedItem?.id) === String(selectedItem?.id);
                    const isDragging = draggedPricingScenarioKey === scenarioDragKey;
                    const draggedScenario = visiblePricingScenarios.find((entry) => (
                      pricingScenarioKey(entry, selectedItem?.id) === draggedPricingScenarioKey
                    ));
                    const beginsBundleZone = scenario.scenarioType === "bundle"
                      && visiblePricingScenarios[index - 1]?.scenarioType !== "bundle";
                    return (
                      <button
                        key={scenarioDragKey}
                        type="button"
                        draggable={canReorder}
                        onClick={() => setActivePricingScenarioId(scenario.id)}
                        onDragStart={(event) => {
                          if (!canReorder) return;
                          setDraggedPricingScenarioKey(scenarioDragKey);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/pricing-scenario-key", scenarioDragKey);
                        }}
                        onDragOver={(event) => {
                          if (canReorder && draggedScenario?.scenarioType === scenario.scenarioType) {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceKey = event.dataTransfer.getData("text/pricing-scenario-key") || draggedPricingScenarioKey;
                          reorderPricingScenarios(sourceKey, scenarioDragKey);
                          setDraggedPricingScenarioKey(null);
                        }}
                        onDragEnd={() => setDraggedPricingScenarioKey(null)}
                        title={`${scenario.minimumQuantity ? `${scenario.minimumQuantity}개 이상 적용` : scenario.scenarioType === "bundle" ? "묶음 프로모션" : "기본 가격대"} · ${scenario.scenarioType === "bundle" ? "드래그하여 묶음 구역 내 순서 변경 · 연결 제품에 공통 반영" : "드래그하여 가격대 구역 내 순서 변경"}`}
                        style={{
                          minHeight: 32,
                          marginLeft: beginsBundleZone ? 8 : 0,
                          padding: "5px 10px",
                          border: `1px solid ${active ? "#2563eb" : "#cbd5e1"}`,
                          borderRadius: 6,
                          background: active ? "#eff6ff" : "#fff",
                          color: active ? "#1d4ed8" : "#475569",
                          cursor: canReorder ? (isDragging ? "grabbing" : "grab") : "pointer",
                          opacity: isDragging ? 0.55 : 1,
                          fontSize: 12,
                          fontWeight: 800,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {scenario.label || `가격대 ${index + 1}`}
                        {scenario._linked ? " · 연결" : ""}
                        {scenario.scenarioType === "bundle" ? " · 묶음" : ""}
                        {scenario.minimumQuantity ? ` · ${scenario.minimumQuantity}개 이상` : ""}
                      </button>
                    );
                  })}
                </div>
                <div className="margin-grid">
                  <div>
                    <label style={labelStyle}>가격대 탭 이름</label>
                    <input
                      value={activePricingScenario?.label || ""}
                      onChange={(event) => updatePricingScenario({ label: event.target.value })}
                      placeholder="예: 기본, 대량구매"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>{activePricingScenario?.scenarioType === "bundle" ? "제품별 최소 구매수량 (개 이상)" : "적용 물량 (개 이상)"}</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={activePricingScenario?.minimumQuantity || ""}
                      onChange={(event) => updatePricingScenario({ minimumQuantity: event.target.value })}
                      placeholder={activePricingScenario?.scenarioType === "bundle" ? "예: 각 제품 30개" : "기본 가격대는 비워두기"}
                      style={inputStyle}
                    />
                  </div>
                  {activePricingScenario?.scenarioType === "bundle" ? (
                    <>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={labelStyle}>결합 판매 제품</label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7, padding: 9, border: "1px solid #dbe3ee", borderRadius: 6, background: "#f8fafc", maxHeight: 190, overflowY: "auto" }}>
                          {bundleCandidateItems.map((item) => {
                            const checked = bundleItemIdSet.has(String(item.id));
                            const locked = String(item.id) === String(activePricingScenario?._ownerItemId || selectedItem?.id);
                            return (
                              <label key={item.id} style={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: 7, padding: "7px 8px", border: `1px solid ${checked ? "#93c5fd" : "#e2e8f0"}`, borderRadius: 6, background: checked ? "#eff6ff" : "#fff", cursor: locked ? "default" : "pointer" }}>
                                <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggleBundleItem(item.id)} style={{ marginTop: 2 }} />
                                <span style={{ minWidth: 0 }}>
                                  <strong title={getItemLabel(item)} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#0f172a", fontSize: 12 }}>{getItemLabel(item)}</strong>
                                  <small style={{ color: "#64748b", fontSize: 11 }}>{item.manufacturer || "제조사 미입력"}</small>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: 5, color: bundleItems.length < 2 ? "#dc2626" : "#64748b", fontSize: 11 }}>
                          {bundleItems.length < 2 ? "묶음 프로모션에는 2개 이상의 제품을 선택해주세요." : `${bundleItems.length}종을 같은 구매 조건으로 결합합니다.`}
                        </div>
                      </div>
                      <div className="calculated-cell">
                        <span>결합 공급 원가 (VAT 포함)</span>
                        <strong>{formatWon(bundleCostTotal)}</strong>
                        <small style={{ color: "#64748b", fontWeight: 700 }}>
                          {bundleTotalUnits ? `총 ${bundleTotalUnits.toLocaleString("ko-KR")}개 기준` : "최소 구매수량 입력 시 계산"}
                        </small>
                      </div>
                      <div className="calculated-cell">
                        <span>개당 공급 원가 (VAT 포함)</span>
                        <strong>{formatWon(bundleCostPerUnit)}</strong>
                        <small style={{ color: "#64748b", fontWeight: 700 }}>
                          결합 공급 원가 ÷ 묶음 총 판매수량
                        </small>
                      </div>
                      <div className="calculated-cell">
                        <span>참약사 묶음 총 마진액 (VAT 포함)</span>
                        <strong>{formatWon(bundleMarginAmount)}</strong>
                        <small style={{ color: "#64748b", fontWeight: 700 }}>VAT 미포함 {formatWon(bundleMarginAmountExcludingVat)}</small>
                      </div>
                      <div className="calculated-cell">
                        <span>참약사 묶음 실질 마진율</span>
                        <strong>{formatPercent(bundleMarginRate)}</strong>
                        <small style={{ color: "#64748b", fontWeight: 700 }}>총 마진액 ÷ 묶음 판매가</small>
                      </div>
                      <div className="calculated-cell">
                        <span>묶음 개당 판매가 (VAT 포함)</span>
                        <strong>{formatWon(bundleSellingPricePerUnit)}</strong>
                        <small style={{ color: "#64748b", fontWeight: 700 }}>묶음 일괄 판매가 ÷ 묶음 총 판매수량</small>
                      </div>
                      <div>
                        <label style={labelStyle}>묶음 일괄 판매가 (약국 구입 총액, VAT 포함)</label>
                        <input value={activePricingScenario?.bundleSellingPrice || ""} onChange={(event) => updatePricingScenario({ bundleSellingPrice: event.target.value })} inputMode="numeric" placeholder="예: 3종 합계 120,000원" style={inputStyle} />
                        <div style={{ marginTop: 5, color: "#64748b", fontSize: 11, fontWeight: 700 }}>
                          {bundleTotalUnits ? `${bundleItems.length}종 × 각 ${bundleQuantity.toLocaleString("ko-KR")}개 · 총 ${bundleTotalUnits.toLocaleString("ko-KR")}개` : "선택 제품 전체 묶음 금액"}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                  <div>
                    <label style={labelStyle}>참약사 목표 마진율 (판매가 기준, %)</label>
                    <input
                      value={activePricingScenario?.chamyaksaMarginRate || ""}
                      onChange={(event) => updatePricingScenario({ chamyaksaMarginRate: event.target.value })}
                      inputMode="decimal"
                      placeholder="예: 60"
                      style={inputStyle}
                    />
                    {activePricingScenario?.chamyaksaMarginRate && !marginRateIsValid && (
                      <div style={{ marginTop: 5, color: "#dc2626", fontSize: 11 }}>0 이상 100 미만의 숫자를 입력해주세요.</div>
                    )}
                    <div style={{ marginTop: 5, color: "#64748b", fontSize: 11 }}>
                      목표 마진율 = 참약사 마진금액 ÷ 참약사 판매가
                    </div>
                  </div>
                  <div className="calculated-cell">
                    <span>참약사 마진금액 (VAT 포함)</span>
                    <strong>{formatWon(chamyaksaMarginAmount)}</strong>
                    <small style={{ color: "#64748b", fontWeight: 700 }}>VAT 미포함 {formatWon(chamyaksaMarginAmountExcludingVat)}</small>
                  </div>
                  <div className="calculated-cell">
                    <span>참약사 판매가 (VAT 포함)</span>
                    <strong>{formatWon(chamyaksaSellingPrice)}</strong>
                    <small style={{ color: "#64748b", fontWeight: 700 }}>약국 사입 금액</small>
                  </div>
                  <div className="calculated-cell">
                    <span>적용물량 참약사 총 마진액 (VAT 포함)</span>
                    <strong>{formatWon(totalChamyaksaMarginAmount)}</strong>
                    <small style={{ color: "#64748b", fontWeight: 700 }}>
                      {appliedQuantity ? `VAT 미포함 ${formatWon(totalChamyaksaMarginAmountExcludingVat)}` : "적용 물량 입력 시 계산"}
                    </small>
                  </div>
                  <div>
                    <label style={labelStyle}>약국 판매가 (VAT 포함)</label>
                    <input
                      value={distribution.pharmacySellingPrice || ""}
                      onChange={(event) => updateDistribution({ pharmacySellingPrice: event.target.value })}
                      inputMode="numeric"
                      placeholder="예: 15,000"
                      style={inputStyle}
                    />
                  </div>
                  <div className="calculated-cell">
                    <span>약국 마진율 (판매가 기준)</span>
                    <strong style={{ color: pharmacyMarginAmount !== null && pharmacyMarginAmount < 0 ? "#dc2626" : "#0f172a" }}>
                      {formatPercent(pharmacyMarginRate)}
                    </strong>
                  </div>
                  <div className="calculated-cell">
                    <span>약국 마진금액 (VAT 포함)</span>
                    <strong style={{ color: pharmacyMarginAmount !== null && pharmacyMarginAmount < 0 ? "#dc2626" : "#0f172a" }}>
                      {formatWon(pharmacyMarginAmount)}
                    </strong>
                  </div>
                  <div className="calculated-cell">
                    <span>약국 구입 총액 (VAT 포함)</span>
                    <strong>{formatWon(pharmacyPurchaseTotal)}</strong>
                    <small style={{ color: "#64748b", fontWeight: 700 }}>
                      {appliedQuantity ? `참약사 판매가 × ${appliedQuantity.toLocaleString("ko-KR")}개` : "적용 물량 입력 시 계산"}
                    </small>
                  </div>
                    </>
                  )}
                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={resetDistributionStructure}
                      disabled={!distribution.updatedAt}
                      style={{
                        ...secondaryButtonStyle,
                        color: distribution.updatedAt ? "#c2410c" : "#94a3b8",
                        borderColor: distribution.updatedAt ? "#fdba74" : "#e2e8f0",
                        background: distribution.updatedAt ? "#fff7ed" : "#f8fafc",
                        cursor: distribution.updatedAt ? "pointer" : "not-allowed",
                        opacity: distribution.updatedAt ? 1 : 0.65
                      }}
                    >
                      유통 구조 설정 초기화
                    </button>
                    <button
                      type="button"
                      onClick={removeActivePricingScenario}
                      disabled={activePricingScenario?.scenarioType !== "bundle" && getDistribution(items.find((item) => String(item.id) === String(activePricingScenario?._ownerItemId || selectedItem?.id))).pricingScenarios.length <= 1}
                      style={{
                        ...secondaryButtonStyle,
                        color: activePricingScenario?.scenarioType !== "bundle" && getDistribution(items.find((item) => String(item.id) === String(activePricingScenario?._ownerItemId || selectedItem?.id))).pricingScenarios.length <= 1 ? "#94a3b8" : "#dc2626",
                        borderColor: activePricingScenario?.scenarioType !== "bundle" && getDistribution(items.find((item) => String(item.id) === String(activePricingScenario?._ownerItemId || selectedItem?.id))).pricingScenarios.length <= 1 ? "#e2e8f0" : "#fecaca",
                        cursor: activePricingScenario?.scenarioType !== "bundle" && getDistribution(items.find((item) => String(item.id) === String(activePricingScenario?._ownerItemId || selectedItem?.id))).pricingScenarios.length <= 1 ? "not-allowed" : "pointer",
                        opacity: activePricingScenario?.scenarioType !== "bundle" && getDistribution(items.find((item) => String(item.id) === String(activePricingScenario?._ownerItemId || selectedItem?.id))).pricingScenarios.length <= 1 ? 0.65 : 1
                      }}
                    >
                      현재 가격대 탭 삭제
                    </button>
                  </div>
                </div>
              </section>

              <section className="competitor-panel" style={panelStyle}>
                <div className="competitor-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: "1px solid #cbd5e1" }}>
                  <div>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 900 }}>견적·경쟁제품 비교</div>
                    <div style={{ marginTop: 2, color: "#64748b", fontSize: 12 }}>같은 비교 카테고리의 제조사 견적과 시장 판매 조건을 함께 확인합니다.</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <label style={{ display: "grid", gap: 3, minWidth: 210 }}>
                      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>비교 카테고리</span>
                      <input
                        list="distribution-comparison-categories"
                        value={comparisonCategoryDraft}
                        onChange={(event) => setComparisonCategoryDraft(event.target.value)}
                        placeholder="예: 지사제"
                        style={{ ...inputStyle, minHeight: 34, padding: "6px 8px", fontSize: 12 }}
                      />
                      <datalist id="distribution-comparison-categories">
                        {comparisonCategoryOptions.map((category) => <option key={category} value={category} />)}
                      </datalist>
                    </label>
                    <button type="button" onClick={applyComparisonCategory} style={secondaryButtonStyle}>적용</button>
                    {distribution.comparisonCategory && (
                      <button
                        type="button"
                        onClick={clearComparisonCategory}
                        style={{ ...secondaryButtonStyle, color: "#dc2626", borderColor: "#fecaca", background: "#fff" }}
                      >
                        적용 해제
                      </button>
                    )}
                    {distribution.comparisonCategory && (
                      <span style={{ padding: "5px 8px", border: "1px solid #bfdbfe", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", fontSize: 11, fontWeight: 900 }}>
                        공동 견적 {comparisonGroupItems.length}건
                      </span>
                    )}
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => updateSharedCompetitors([...sharedCompetitors, createCompetitor()])}
                        style={secondaryButtonStyle}
                      >
                        + 경쟁제품 추가
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingItemId(isEditing ? null : selectedItem.id)}
                      style={isEditing
                        ? { ...secondaryButtonStyle, background: "#0f172a", borderColor: "#0f172a", color: "#fff" }
                        : secondaryButtonStyle}
                    >
                      {isEditing ? "완료" : "수정"}
                    </button>
                  </div>
                </div>
                <div style={{ borderBottom: "1px solid #cbd5e1", overflowX: "auto" }}>
                  <div style={{ padding: "9px 12px", background: "#f8fafc", color: "#334155", fontSize: 12, fontWeight: 900 }}>
                    제조사 견적 비교 {distribution.comparisonCategory ? `· ${distribution.comparisonCategory}` : "· 미분류"}
                  </div>
                  <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "10%" }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: "#eef6ff" }}>
                        {["제품명 / 제조사", "허가사", "포장단위", "배치 당 포장단위 개수", "가격대", "VAT 포함 단가", "최종 공급사 판매가", "참약사 예상 판매가", "예상 마진율", "약국 판매가"].map((header) => (
                          <th key={header} style={{ padding: "8px 9px", borderBottom: "1px solid #dbe3ee", color: "#475569", fontSize: 11, textAlign: "left" }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonGroupItems.map((item) => {
                        const itemDistribution = getDistribution(item);
                        const itemPricingScenarios = getPricingScenariosForItem(item, items);
                        const scenario = itemPricingScenarios.find((entry) => String(entry.id) === String(comparisonScenarioByItemId[item.id])) || itemPricingScenarios[0];
                        const amounts = getBaseAmounts(item);
                        const expectedSellingPrice = scenario?.scenarioType === "bundle"
                          ? parseNumber(scenario.bundleSellingPrice)
                          : calculateSellingPriceFromMarginRate(amounts.finalUnitCost, parseNumber(scenario?.chamyaksaMarginRate));
                        return (
                          <tr key={item.id} style={{ background: String(item.id) === String(selectedItem.id) ? "#f0f9ff" : "#fff" }}>
                            <td style={{ padding: 6, borderBottom: "1px solid #edf2f7", fontSize: 12, fontWeight: 800 }}>
                              {item.productName && <div title={item.productName} style={{ margin: "0 4px 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#0f172a", fontWeight: 900 }}>{item.productName}</div>}
                              <button
                                type="button"
                                onClick={() => openComparisonItem(item.id)}
                                title={`${item.manufacturer || "제조사 미입력"} 견적 열기`}
                                style={{ padding: "3px 4px", border: 0, background: "transparent", color: "#1d4ed8", cursor: "pointer", font: "inherit", fontWeight: 900, textDecoration: "underline", textUnderlineOffset: 3 }}
                              >
                                {item.manufacturer || "-"}
                              </button>
                            </td>
                            <td style={{ padding: 6, borderBottom: "1px solid #edf2f7", fontSize: 12 }}>
                              <button
                                type="button"
                                onClick={() => openComparisonItem(item.id)}
                                title={`${item.permitCompany || "허가사 미입력"} 견적 열기`}
                                style={{ padding: "3px 4px", border: 0, background: "transparent", color: "#1d4ed8", cursor: "pointer", font: "inherit", fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 3 }}
                              >
                                {item.permitCompany || "-"}
                              </button>
                            </td>
                            <td style={{ padding: 9, borderBottom: "1px solid #edf2f7", fontSize: 12 }}>{item.packagingUnit || "-"}</td>
                            <td style={{ padding: 9, borderBottom: "1px solid #edf2f7", fontSize: 12 }}>{item.quantity || "-"}</td>
                            <td style={{ padding: 6, borderBottom: "1px solid #edf2f7" }}>
                              <select value={scenario?.id || ""} onChange={(event) => setComparisonScenarioByItemId((current) => ({ ...current, [item.id]: event.target.value }))} style={{ ...inputStyle, minHeight: 30, padding: "4px 6px", fontSize: 11 }} aria-label={`${item.productName || item.manufacturer || "견적"} 가격대`}>
                                {itemPricingScenarios.map((entry) => <option key={`${entry._ownerItemId}_${entry.id}`} value={entry.id}>{entry.label}{entry.scenarioType === "bundle" ? " (묶음)" : ""}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: 9, borderBottom: "1px solid #edf2f7", fontSize: 12, fontWeight: 800 }}>{formatWon(amounts.vatUnitPrice)}</td>
                            <td style={{ padding: 9, borderBottom: "1px solid #edf2f7", borderLeft: "1px solid #dbeafe", fontSize: 12, fontWeight: 800 }}>{formatWon(amounts.finalUnitCost)}</td>
                            <td style={{ padding: 9, borderBottom: "1px solid #edf2f7", borderLeft: "2px solid #bfdbfe", color: "#047857", fontSize: 12, fontWeight: 900 }}>{formatWon(expectedSellingPrice)}</td>
                            <td style={{ padding: 9, borderBottom: "1px solid #edf2f7", color: "#047857", fontSize: 12, fontWeight: 900 }}>{scenario?.scenarioType === "bundle" ? "묶음 총액" : formatPercent(parseNumber(scenario?.chamyaksaMarginRate))}</td>
                            <td style={{ padding: 9, borderBottom: "1px solid #edf2f7", borderLeft: "1px solid #d1fae5", color: "#0f766e", fontSize: 12, fontWeight: 900 }}>{formatWon(parseNumber(itemDistribution.pharmacySellingPrice))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: isEditing ? 1080 : 860, borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: isEditing ? "15%" : "11%" }} />
                      <col style={{ width: isEditing ? "18%" : "23%" }} />
                      <col style={{ width: isEditing ? "13%" : "16%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: isEditing ? "23%" : "22%" }} />
                      <col style={{ width: isEditing ? "15%" : "18%" }} />
                      {isEditing && <col style={{ width: "6%" }} />}
                    </colgroup>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        {["기준일", "경쟁제품명", "판매처", "포장단위", "판매단가", "비고", ...(isEditing ? ["관리"] : [])].map((header) => (
                          <th key={header} style={{ padding: "9px 10px", borderBottom: "1px solid #dbe3ee", color: "#475569", fontSize: 12, textAlign: "left" }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sharedCompetitors.map((competitor) => (
                        <tr key={competitor.id}>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <SegmentedDateInput
                                value={competitor.date || ""}
                                onChange={(value) => updateCompetitor(competitor.id, { date: value })}
                                aria-label={`${competitor.productName || "경쟁제품"} 기준일`}
                                style={{
                                  ...inputStyle,
                                  minHeight: 36,
                                  padding: "6px 7px",
                                  fontSize: 12,
                                  gridTemplateColumns: "minmax(42px, 1.35fr) 7px minmax(22px, .7fr) 7px minmax(22px, .7fr)",
                                  gap: 1
                                }}
                              />
                            ) : (
                              <div style={labelStyle}>{competitor.date || "-"}</div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <input value={competitor.productName || ""} onChange={(event) => updateCompetitor(competitor.id, { productName: event.target.value })} placeholder="경쟁제품명" style={inputStyle} />
                            ) : (
                              <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 700 }}>{competitor.productName || "-"}</div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <input value={competitor.salesChannel || ""} onChange={(event) => updateCompetitor(competitor.id, { salesChannel: event.target.value })} placeholder="판매처" style={inputStyle} />
                            ) : (
                              <div style={{ color: "#334155", fontSize: 13, overflowWrap: "anywhere" }}>{competitor.salesChannel || "-"}</div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <input value={competitor.packagingUnit || ""} onChange={(event) => updateCompetitor(competitor.id, { packagingUnit: event.target.value })} placeholder="예: 30정" style={inputStyle} />
                            ) : (
                              <div style={{ color: "#334155", fontSize: 13 }}>{competitor.packagingUnit || "-"}</div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                {getCompetitorPriceTiers(competitor).map((tier, tierIndex) => (
                                  <div key={tier.id} style={{ display: "grid", gridTemplateColumns: "minmax(88px, 1fr) minmax(96px, 1fr) auto", gap: 5, alignItems: "center" }}>
                                    <input
                                      value={tier.label || ""}
                                      onChange={(event) => updateCompetitorPriceTier(competitor.id, tier.id, { label: event.target.value })}
                                      placeholder={tierIndex === 0 ? "기본" : "예: 100개 이상"}
                                      style={{ ...inputStyle, minHeight: 34, padding: "6px 8px", fontSize: 12 }}
                                    />
                                    <input
                                      value={tier.price || ""}
                                      onChange={(event) => updateCompetitorPriceTier(competitor.id, tier.id, { price: event.target.value })}
                                      inputMode="numeric"
                                      placeholder="판매단가"
                                      style={{ ...inputStyle, minHeight: 34, padding: "6px 8px", fontSize: 12 }}
                                    />
                                    {tierIndex > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => removeCompetitorPriceTier(competitor.id, tier.id)}
                                        title="할인구간 삭제"
                                        aria-label="할인구간 삭제"
                                        style={{ ...secondaryButtonStyle, minHeight: 34, padding: "5px 8px", color: "#dc2626", borderColor: "#fecaca" }}
                                      >
                                        삭제
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => addCompetitorPriceTier(competitor.id)}
                                  style={{ ...secondaryButtonStyle, minHeight: 32, padding: "5px 8px", justifySelf: "start", fontSize: 12 }}
                                >
                                  + 할인구간
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "grid", gap: 5 }}>
                                {getCompetitorPriceTiers(competitor).map((tier) => (
                                  <div key={tier.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingBottom: 4, borderBottom: "1px dashed #dbe3ee", color: "#334155", fontSize: 12 }}>
                                    <span>{tier.label || "구간 미입력"}</span>
                                    <strong style={{ color: "#0f172a", whiteSpace: "nowrap" }}>{formatEnteredPrice(tier.price)}</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <textarea
                                value={competitor.memo || ""}
                                onChange={(event) => updateCompetitor(competitor.id, { memo: event.target.value })}
                                placeholder="비고"
                                rows={2}
                                style={{ ...inputStyle, minHeight: 66, resize: "vertical", fontFamily: "inherit" }}
                              />
                            ) : (
                              <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{competitor.memo || "-"}</div>
                            )}
                          </td>
                          {isEditing && <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            <button
                              type="button"
                              onClick={() => updateSharedCompetitors(sharedCompetitors.filter((entry) => String(entry.id) !== String(competitor.id)))}
                              style={{ ...secondaryButtonStyle, color: "#dc2626", borderColor: "#fecaca" }}
                            >
                              삭제
                            </button>
                          </td>}
                        </tr>
                      ))}
                      {sharedCompetitors.length === 0 && (
                        <tr>
                            <td colSpan={isEditing ? 7 : 6} style={{ padding: 20, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                            등록된 경쟁제품이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              </div>
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .distribution-root {
          display: grid;
          gap: 14px;
        }
        .distribution-layout {
          display: grid;
          grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }
        .base-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-auto-rows: 1fr;
          height: 100%;
        }
        .fee-projection-cell {
          min-width: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
          border-right: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .fee-projection-title {
          padding: 13px 13px 5px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }
        .fee-projection-section {
          min-width: 0;
          padding: 7px 13px 10px;
        }
        .fee-projection-adjusted {
          border-top: 1px solid #dbe3ee;
          background: #f8fafc;
        }
        .fee-projection-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
        }
        .fee-projection-value {
          margin-top: 4px;
          color: #0f172a;
          font-size: 16px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .fee-projection-note {
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        .supply-summary-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: start;
          gap: 12px;
          min-width: 0;
          overflow: hidden;
        }
        .supply-summary-actions {
          max-width: 270px;
        }
        .decision-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 14px;
          align-items: stretch;
        }
        .decision-grid > section:not(.competitor-panel) {
          display: grid;
          grid-template-rows: auto 1fr;
        }
        .competitor-panel {
          grid-column: 1 / -1;
          min-width: 0;
        }
        .margin-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          padding: 15px;
          align-items: stretch;
        }
        .calculated-cell {
          min-height: 66px;
          padding: 10px 12px;
          border: 1px solid #dbe3ee;
          border-radius: 7px;
          background: #f8fafc;
          display: grid;
          align-content: center;
          gap: 4px;
        }
        .calculated-cell span {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }
        .calculated-cell strong {
          color: #0f172a;
          font-size: 17px;
        }
        .calculated-cell small {
          color: #64748b;
          font-size: 11px;
        }
        @media (max-width: 1800px) {
          .decision-grid {
            grid-template-columns: 1fr;
          }
          .margin-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 1050px) {
          .distribution-layout {
            grid-template-columns: 1fr;
          }
          .distribution-layout aside > div:last-child {
            max-height: 280px !important;
          }
        }
        @media (max-width: 760px) {
          .supply-summary-header {
            grid-template-columns: minmax(0, 1fr);
          }
          .supply-summary-actions {
            max-width: none;
            justify-content: flex-start !important;
          }
          .competitor-panel-header {
            align-items: stretch !important;
            flex-direction: column;
          }
          .base-grid,
          .margin-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
