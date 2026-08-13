import {
  calculateMarketAnalysis,
  calculateSellingPriceFromMarginRate
} from "@/lib/pms/marketAnalysis";
import { marketDecisionLabel } from "@/lib/pms/marketDecision";
import { contractStatusLabel, contractTypeLabel, normalizeContractRecords } from "@/lib/pms/contracts";
import {
  supplyCostBreakdownCsvText,
  supplyCostBreakdownPerPackage,
  supplyCostBreakdownTotal
} from "@/lib/pms/supplyCostBreakdown";
import {
  calculateProjectPromotionCost,
  projectPromotionReadiness,
  projectPromotionTotalExpectedCost,
  promotionProgressLabel
} from "@/lib/pms/projectPromotion";

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

export function contractModuleToCsv(records = [], projects = [], supplyItems = []) {
  const projectById = new Map((Array.isArray(projects) ? projects : []).map((project) => [String(project.id), project]));
  const supplyById = new Map((Array.isArray(supplyItems) ? supplyItems : []).map((item) => [String(item.id), item]));
  const normalized = normalizeContractRecords(records);
  const recordById = new Map(normalized.map((record) => [String(record.id), record]));
  const headers = [
    "계약 ID", "구조", "계약·문서 유형", "연결 모계약", "계약명", "계약번호", "계약 상대방",
    "계약 상태", "연결 제품개발 프로젝트", "연결 공급단가 건", "체결일", "계약 시작일", "계약 종료일",
    "자동연장", "갱신 사전 통보기한(일)", "계약금액", "지급조건", "NAS 계약서 경로",
    "핵심 계약조건", "비고", "등록일시", "수정일시"
  ];
  const rows = normalized.map((record) => {
    const linkedParent = recordById.get(String(record.parentId));
    const linkedSupply = supplyById.get(String(record.supplyItemId));
    return [
      record.id,
      record.recordType === "parent" ? "모계약" : "하위 계약·문서",
      contractTypeLabel(record),
      linkedParent?.title || "",
      record.title,
      record.contractNumber,
      record.counterparty,
      contractStatusLabel(record.status),
      projectById.get(String(record.projectId))?.name || "",
      linkedSupply ? ingredientLabel(linkedSupply) : "",
      record.signedDate,
      record.effectiveDate,
      record.expirationDate,
      record.autoRenewal ? "있음" : "없음",
      record.renewalNoticeDays,
      record.contractAmount,
      record.paymentTerms,
      record.nasPath,
      record.keyTerms,
      record.memo,
      record.createdAt,
      record.updatedAt
    ];
  });
  return toCsv(headers, rows);
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
    "브랜드/공급처", "kg당 가격대", "포장단위", "포장형태", "배치 당 포장단위 개수", "최소 주문 배치 수량",
    "견적 원가 구성", "원가 구성 합계(원)", "포장단위당 원가 구성(원)",
    "배치 당 공급단가", "VAT 포함", "허가사 수수료", "허가사 수수료율/상태", "견적일자",
    "사용기한", "비고", "견적 채택", "시장 분석 검토결과"
  ];
  const rows = items.flatMap((item) => {
    const ingredients = Array.isArray(item.ingredients) && item.ingredients.length > 0 ? item.ingredients : [{}];
    const costBreakdownText = supplyCostBreakdownCsvText(item.costBreakdown);
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
      costBreakdownText,
      costBreakdownText ? supplyCostBreakdownTotal(item.costBreakdown) : "",
      costBreakdownText ? (supplyCostBreakdownPerPackage(item.costBreakdown, item.quantity) ?? "") : "",
      item.supplyUnitPrice,
      item.vatIncluded ? "포함" : "불포함",
      item.permitCompanyFee ? "해당" : "불포함",
      item.permitCompanyFee
        ? (item.permitCompanyFeeRateUnknown ? "알 수 없음(공급단가에 포함)" : item.permitCompanyFeeRate)
        : "",
      item.quoteDate,
      item.shelfLife,
      item.memo,
      item.quoteAdoptionExpected ? "채택 예상" : "채택 재고",
      marketDecisionLabel(item.marketDecisionStatus)
    ]);
  });
  return toCsv(headers, rows);
}

export function distributionModuleToCsv(items = []) {
  const headers = [
    "구분", "공급단가 ID", "공급 성분/함량", "제조사", "견적일자",
    "가격대 탭", "적용 물량(개 이상)", "참약사 마진율(%)", "참약사 판매가(VAT 포함)", "약국 판매가(VAT 포함)",
    "경쟁제품 기준일", "경쟁제품명", "판매처", "경쟁제품 포장단위", "판매구간", "판매단가", "비고",
    "시장 분석 검토결과"
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
      const calculatedSellingPrice = calculateSellingPriceFromMarginRate(finalUnitCost, marginRate);
      const chamyaksaSellingPrice = calculatedSellingPrice === null
        ? ""
        : Math.round(calculatedSellingPrice);
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
        "", "", "", "", "", "", "",
        marketDecisionLabel(item.marketDecisionStatus)
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
          competitor.memo,
          marketDecisionLabel(item.marketDecisionStatus)
        ]);
      });
    });
  });

  return toCsv(headers, rows);
}

export function marketModuleToCsv(items = [], marketAnalysisDefaults = {}) {
  const headers = [
    "공급단가 ID", "공급 성분/함량", "제조사", "포장단위", "배치 당 포장단위 개수",
    "연도", "생산실적(천원)", "수입실적(USD)", "성장률 계산 포함", "기준 환율", "합산 시장규모(원)",
    "선택 포함연도 연평균 성장률(%)", "최근 3개년 연평균 성장률(%)", "성장률 포함 연도 수",
    "전국 약국 수", "참약사 약국 수", "참약사 약국 점유율(%)", "가맹약국 침투율(%)",
    "기준 공급원가", "참약사 판매가 조정률(%)", "제조사 판매가 조정률(%)", "제조사 조정 공급원가", "시장 환산 평균 공급단가 직접입력", "시장 환산 적용단가", "전국 예상 공급수량",
    "연간 예상 소진수량", "공급단가 최소 주문 배치 수", "공급단가 최소 주문 수량",
    "연간 필요 배치", "연간 조달 예상 배치", "연간 조달 예상 수량", "배치 소진 예상기간(개월)",
    "연 이자율(%)", "연간 금융 기회비용", "총 금융 기회비용", "참약사 예상 판매가", "참약사 예상 마진율(%)",
    "연간 기대 매출", "연간 기대 매출총이익", "금융비용 차감 기댓값",
    "총 매출총이익", "총 금융비용 차감 기댓값", "검토결과"
  ];
  const rows = [];
  items.forEach((item) => {
    const result = calculateMarketAnalysis(item, item.marketSizeAnalysis, marketAnalysisDefaults);
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
        year.includeInGrowthRate ? "포함" : "제외",
        result.analysis.exchangeRate,
        year.totalKrw,
        result.cagr5Year,
        result.cagr3Year,
        result.growthYearCount,
        result.analysis.nationwidePharmacyCount,
        result.analysis.chamyaksaPharmacyCount,
        result.pharmacyShareRate,
        result.analysis.franchisePenetrationRate,
        result.baseUnitCost,
        result.analysis.chamyaksaSellingPriceAdjustmentRate,
        result.analysis.manufacturerSellingPriceAdjustmentRate,
        result.manufacturerAdjustedUnitCost,
        result.analysis.adjustedUnitCostOverride,
        result.adjustedUnitCost,
        result.marketUnitCount,
        result.annualDemandUnits,
        result.minimumOrderBatches,
        result.minimumOrderQuantity,
        result.exactBatches,
        result.orderBatchCount,
        result.orderQuantity,
        result.depletionMonthsPerBatch,
        result.analysis.annualInterestRate,
        result.annualFinanceCost,
        result.totalFinanceCost,
        result.chamyaksaSellingPrice,
        result.chamyaksaExpectedMarginRate,
        result.expectedRevenue,
        result.expectedGrossProfit,
        result.expectedProfitAfterFinance,
        result.totalExpectedGrossProfit,
        result.totalExpectedProfitAfterFinance,
        marketDecisionLabel(item.marketDecisionStatus)
      ]);
    });
  });
  return toCsv(headers, rows);
}

export function projectPromotionModuleToCsv(items = [], projects = []) {
  const projectById = new Map((Array.isArray(projects) ? projects : []).map((project) => [String(project.id), project]));
  const headers = [
    "공급단가 ID", "공급 성분/함량", "카테고리", "제조사", "허가사", "포장단위",
    "공급단가 완료", "유통 구조 완료", "시장 분석 완료", "추진 구분", "시장 분석 검토결과", "최종 진행",
    "예상 출시일", "최소 주문 기준 생산비", "추가 예상비용", "총 예상비용", "비용 메모",
    "연결 제품개발 프로젝트", "추진 계획 수정일시"
  ];
  const rows = (Array.isArray(items) ? items : [])
    .filter((item) => item.marketDecisionStatus === "proceed" && projectPromotionReadiness(item).isImminent)
    .map((item) => {
    const readiness = projectPromotionReadiness(item);
    const cost = calculateProjectPromotionCost(item);
    const promotion = item.projectPromotion || {};
    return [
      item.id, ingredientLabel(item), item.category, item.manufacturer, item.permitCompany, item.packagingUnit,
      readiness.supplyReady ? "완료" : "미완료",
      readiness.distributionReady ? "완료" : "미완료",
      readiness.marketReady ? "완료" : "미완료",
      readiness.isImminent ? "추진 임박" : "준비 중",
      marketDecisionLabel(item.marketDecisionStatus),
      promotionProgressLabel(promotion.progressDecision),
      promotion.expectedLaunchDate,
      cost.initialProductionCost ?? "",
      promotion.additionalExpectedCost,
      projectPromotionTotalExpectedCost(item) ?? "",
      promotion.costMemo,
      projectById.get(String(promotion.linkedProjectId))?.name || "",
      promotion.updatedAt
    ];
    });
  return toCsv(headers, rows);
}
