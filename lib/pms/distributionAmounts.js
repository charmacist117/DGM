function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getBaseAmounts(item) {
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

  const permitFeeTotalExcludingVat = !hasPermitFee ? 0
    : (!hasKnownPermitFee || unitPrice === null || quantity === null ? null : unitPrice * quantity * permitFeeRate / 100);
  const permitFeeTotal = permitFeeTotalExcludingVat === null ? null : permitFeeTotalExcludingVat * 1.1;

  return {
    permitFeeTotalExcludingVat,
    permitFeeTotal,
    minimumOrderPermitFeeTotal: permitFeeTotal === null ? null : permitFeeTotal * minimumOrderBatches,
    minimumOrderPermitFeeTotalExcludingVat: permitFeeTotalExcludingVat === null ? null : permitFeeTotalExcludingVat * minimumOrderBatches,
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

