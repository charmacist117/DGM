import { calculateMarketAnalysis } from "@/lib/pms/marketAnalysis";

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
}

function numberValue(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function ingredientLabel(item) {
  return (item.ingredients || [])
    .map((ingredient) => [ingredient.name, ingredient.content].filter(Boolean).join(" / "))
    .filter(Boolean)
    .join(", ");
}

export function developmentModuleToCsv(projects = [], adminLogs = []) {
  const headers = [
    "구분", "프로젝트 ID", "프로젝트명", "상태", "카테고리", "PM", "AM", "시작일", "일정 버전",
    "순서/일자", "아이콘/작성자", "제목/태스크명", "상태/유형", "시작일", "완료일", "내용"
  ];
  const rows = projects.flatMap((project) => {
    const tasks = Array.isArray(project.tasks) && project.tasks.length > 0 ? project.tasks : [null];
    const projectRows = tasks.map((task, index) => [
      task ? "태스크" : "프로젝트",
      project.id, project.name, project.status, project.category, project.pmName, project.amName,
      project.start, project.scheduleVersion, task ? index + 1 : "", task?.icon || "",
      task?.name || project.desc || "", task?.taskStatus || "", task?.scheduledStart || "",
      task?.scheduledEnd || "", task ? JSON.stringify(task) : JSON.stringify(project.draftChecklist || {})
    ]);
    const nestedLogs = [
      ["자문약사 의견", project.advisorLog],
      ["업체 소통 기록", project.communicationLog],
      ["의사결정 기록", project.decisionLog],
      ["프로젝트 변경 이력", project.changeLog]
    ];
    nestedLogs.forEach(([label, logs]) => {
      (Array.isArray(logs) ? logs : []).forEach((log) => {
        projectRows.push([
          label, project.id, project.name, project.status, project.category, project.pmName, project.amName,
          project.start, project.scheduleVersion, log.date || log.createdAt || "", log.author || log.actor || "",
          log.title || log.subject || log.taskName || "", log.status || log.type || "", "", "",
          JSON.stringify(log)
        ]);
      });
    });
    return projectRows;
  });
  (Array.isArray(adminLogs) ? adminLogs : []).forEach((log) => {
    rows.push([
      "관리자 이력", log.projectId || "", log.projectName || "", "", "", "", "", "", "",
      log.changeDate || log.createdAt || "", log.actor || "", log.title || "", log.type || "", "", "",
      JSON.stringify(log)
    ]);
  });
  return toCsv(headers, rows);
}

export function supplyModuleToCsv(items = [], categoryLabelById = {}) {
  const headers = [
    "공급단가 ID", "카테고리", "제조사", "허가사", "공급 성분", "함량/규격", "원료 원산지",
    "브랜드/공급처", "kg당 가격대", "포장단위", "포장형태", "수량", "최소 주문 배치 수량",
    "배치 당 공급단가", "VAT 포함", "허가사 수수료", "허가사 수수료율/상태", "견적일자",
    "사용기한", "첨부파일", "비고", "견적 채택"
  ];
  const rows = items.flatMap((item) => {
    const ingredients = Array.isArray(item.ingredients) && item.ingredients.length > 0 ? item.ingredients : [{}];
    return ingredients.map((ingredient) => [
      item.id,
      categoryLabelById[item.category] || item.category,
      item.manufacturer,
      item.permitCompany,
      ingredient.name,
      ingredient.content,
      ingredient.origin,
      ingredient.brand,
      ingredient.kilogramPriceRange,
      item.packagingUnit,
      item.packagingForm,
      item.quantity,
      item.minimumOrderBatchQuantity,
      item.supplyUnitPrice,
      item.vatIncluded ? "포함" : "불포함",
      item.permitCompanyFee ? "해당" : "불포함",
      item.permitCompanyFee
        ? (item.permitCompanyFeeRateUnknown ? "알 수 없음(공급단가에 포함)" : item.permitCompanyFeeRate)
        : "",
      item.quoteDate,
      item.shelfLife,
      item.attachment?.name || "",
      item.memo,
      item.quoteAdoptionExpected ? "채택 예상" : "채택 재고"
    ]);
  });
  return toCsv(headers, rows);
}

export function distributionModuleToCsv(items = []) {
  const headers = [
    "구분", "공급단가 ID", "공급 성분/함량", "제조사", "견적일자",
    "가격대 탭", "적용 물량(개 이상)", "참약사 마진율(%)", "참약사 판매가(VAT 포함)", "약국 판매가(VAT 포함)",
    "경쟁제품 기준일", "경쟁제품명", "판매처", "경쟁제품 포장단위", "판매구간", "판매단가", "비고"
  ];
  const rows = [];

  items.forEach((item) => {
    const label = ingredientLabel(item);
    const unitPrice = numberValue(item.supplyUnitPrice);
    const permitFeeRate = numberValue(item.permitCompanyFeeRate);
    const knownPermitFee = item.category === "OTC"
      && item.permitCompanyFee
      && !item.permitCompanyFeeRateUnknown
      && permitFeeRate !== null;
    const finalUnitCost = unitPrice === null ? null : unitPrice * 1.1 * (knownPermitFee ? 1 + (permitFeeRate / 100) : 1);
    const scenarios = item.distributionStructure?.pricingScenarios || [];
    scenarios.forEach((scenario) => {
      const marginRate = numberValue(scenario.chamyaksaMarginRate);
      const chamyaksaSellingPrice = finalUnitCost !== null && marginRate !== null
        ? Math.round(finalUnitCost * (1 + (marginRate / 100)))
        : "";
      rows.push([
        "가격대",
        item.id,
        label,
        item.manufacturer,
        item.quoteDate,
        scenario.label,
        scenario.minimumQuantity,
        scenario.chamyaksaMarginRate,
        chamyaksaSellingPrice,
        scenario.pharmacySellingPrice,
        "", "", "", "", "", "", ""
      ]);
    });

    const competitors = item.distributionStructure?.competitors || [];
    competitors.forEach((competitor) => {
      const tiers = Array.isArray(competitor.priceTiers) && competitor.priceTiers.length > 0
        ? competitor.priceTiers
        : [{ label: "기본", price: competitor.salePrice || "" }];
      tiers.forEach((tier) => {
        rows.push([
          "경쟁제품",
          item.id,
          label,
          item.manufacturer,
          item.quoteDate,
          "", "", "", "", "",
          competitor.date,
          competitor.productName,
          competitor.salesChannel,
          competitor.packagingUnit,
          tier.label,
          tier.price,
          competitor.memo
        ]);
      });
    });
  });

  return toCsv(headers, rows);
}

export function marketModuleToCsv(items = []) {
  const headers = [
    "공급단가 ID", "공급 성분/함량", "제조사", "포장단위", "배치 공급수량",
    "연도", "생산실적(천원)", "수입실적(USD)", "기준 환율", "합산 시장규모(원)",
    "전국 약국 수", "참약사 약국 수", "참약사 약국 점유율(%)", "가맹약국 침투율(%)",
    "기준 공급원가", "공급단가 조정률(%)", "조정 공급원가", "전국 예상 공급수량",
    "연간 예상 소진수량", "연간 필요 배치", "배치 소진 예상기간(개월)",
    "연 이자율(%)", "연간 금융 기회비용", "참약사 예상 판매가",
    "연간 기대 매출", "연간 기대 매출총이익", "금융비용 차감 기댓값"
  ];
  const rows = [];
  items.forEach((item) => {
    const result = calculateMarketAnalysis(item, item.marketSizeAnalysis);
    result.yearResults.forEach((year) => {
      rows.push([
        item.id,
        ingredientLabel(item),
        item.manufacturer,
        item.packagingUnit,
        item.quantity,
        year.year ?? "",
        year.productionThousandKrw,
        year.importUsd,
        result.analysis.exchangeRate,
        year.totalKrw,
        result.analysis.nationwidePharmacyCount,
        result.analysis.chamyaksaPharmacyCount,
        result.pharmacyShareRate,
        result.analysis.franchisePenetrationRate,
        result.baseUnitCost,
        result.analysis.supplyPriceAdjustmentRate,
        result.adjustedUnitCost,
        result.marketUnitCount,
        result.annualDemandUnits,
        result.exactBatches,
        result.depletionMonthsPerBatch,
        result.analysis.annualInterestRate,
        result.annualFinanceCost,
        result.chamyaksaSellingPrice,
        result.expectedRevenue,
        result.expectedGrossProfit,
        result.expectedProfitAfterFinance
      ]);
    });
  });
  return toCsv(headers, rows);
}
