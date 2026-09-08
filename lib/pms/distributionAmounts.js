function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getPermitFeeRates(rate, type = "markup") {
  const enteredRate = parseNumber(rate);
  const rateType = type === "margin" ? "margin" : "markup";
  if (enteredRate === null || enteredRate < 0 || (rateType === "margin" && enteredRate >= 100)) {
    return { rateType, enteredRate, markupRate: null, marginRate: null, multiplier: null };
  }
  const multiplier = rateType === "margin"
    ? 1 / (1 - (enteredRate / 100))
    : 1 + (enteredRate / 100);
  return {
    rateType,
    enteredRate,
    markupRate: (multiplier - 1) * 100,
    marginRate: (1 - (1 / multiplier)) * 100,
    multiplier
  };
}

export function getBaseAmounts(item) {
  const unitPrice = parseNumber(item?.supplyUnitPrice);
  const quantity = parseNumber(item?.quantity);
  const minimumOrderBatches = Math.max(1, Math.ceil(parseNumber(item?.minimumOrderBatchQuantity) ?? 1));
  const hasPermitFee = item?.category === "OTC" && item?.permitCompanyFee;
  const permitFeeRateUnknown = item?.category === "OTC" && item?.permitCompanyFee && item?.permitCompanyFeeRateUnknown;
  const permitFeeRates = getPermitFeeRates(item?.permitCompanyFeeRate, item?.permitCompanyFeeRateType);
  const hasKnownPermitFee = hasPermitFee && !permitFeeRateUnknown && permitFeeRates.multiplier !== null;
  const permitFeeMultiplier = hasKnownPermitFee ? permitFeeRates.multiplier : 1;
  const finalUnitCost = unitPrice === null
    ? null
    : unitPrice * 1.1 * permitFeeMultiplier;
  const permitFeeUnitPrice = unitPrice === null ? null : unitPrice * permitFeeMultiplier;
  const permitFeeSupplyTotal = permitFeeUnitPrice === null || quantity === null ? null : permitFeeUnitPrice * quantity;
  const finalTotal = finalUnitCost === null || quantity === null ? null : finalUnitCost * quantity;

  const permitFeeTotalExcludingVat = !hasPermitFee ? 0
    : (!hasKnownPermitFee || unitPrice === null || quantity === null ? null : (permitFeeUnitPrice - unitPrice) * quantity);
  const permitFeeTotal = permitFeeTotalExcludingVat === null ? null : permitFeeTotalExcludingVat * 1.1;

  return {
    permitFeeTotalExcludingVat,
    permitFeeTotal,
    permitFeeRateType: permitFeeRates.rateType,
    permitFeeMarkupRate: hasKnownPermitFee ? permitFeeRates.markupRate : null,
    permitFeeMarginRate: hasKnownPermitFee ? permitFeeRates.marginRate : null,
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
