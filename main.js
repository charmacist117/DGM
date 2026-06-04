const STATUS_LABELS = {
  collected: "수집됨",
  fallback: "보조값",
  unavailable: "확인 필요"
};

const STATUS_HELP = {
  collected: "공식 페이지에서 이번 조회 때 자동으로 읽어온 값입니다.",
  fallback: "공식 페이지 자동 해석이 불완전해 사전에 검증해 둔 보정값을 함께 표시합니다.",
  unavailable: "공식 페이지 접속 또는 해석에 실패해 확인이 필요합니다."
};

let policies = [];
let selectedIndustryId = "pharmacy";
const VISIBLE_INDUSTRY_IDS = new Set(["pharmacy"]);

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function getKstToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function parsePeriodDate(year, month, day) {
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function parsePeriodRange(period) {
  if (!period || period === "검색결과 없음") return null;

  const normalized = period.replace(/\s+/g, " ");
  const matches = [
    ...normalized.matchAll(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)
  ];
  if (matches.length >= 2) {
    return {
      start: parsePeriodDate(matches[0][1], matches[0][2], matches[0][3]),
      end: parsePeriodDate(matches[1][1], matches[1][2], matches[1][3])
    };
  }

  const dotted = [
    ...normalized.matchAll(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/g)
  ];
  if (dotted.length >= 2) {
    return {
      start: parsePeriodDate(dotted[0][1], dotted[0][2], dotted[0][3]),
      end: parsePeriodDate(dotted[1][1], dotted[1][2], dotted[1][3])
    };
  }

  return null;
}

function getPeriodStatus(period) {
  if (period === "검색결과 없음") {
    return {
      label: "확인되지 않음",
      className: "invalid",
      title: "공식 페이지에서 관련 할부 정책 게시글을 찾지 못해 적용 기간도 확인되지 않았습니다."
    };
  }

  const range = parsePeriodRange(period);
  if (!range) {
    return {
      label: "확인되지 않음",
      className: "invalid",
      title: "행사 기간을 날짜 범위로 해석하지 못해 오늘 기준 적용 여부를 확인할 수 없습니다."
    };
  }

  const today = getKstToday();
  const isActive = today >= range.start && today <= range.end;
  return {
    label: isActive ? "확인됨" : "확인되지 않음",
    className: isActive ? "valid" : "invalid",
    title: isActive
      ? "오늘 날짜 기준으로 표시된 행사 기간 안에 있어 현재 적용 기간으로 확인됩니다."
      : "오늘 날짜 기준으로 표시된 행사 기간에 포함되지 않아 현재 적용 기간으로 확인되지 않습니다."
  };
}

function getDisplayStatus(status) {
  return status === "unavailable" ? "fallback" : status;
}

function monthScore(months) {
  return months.reduce((score, item) => {
    const numbers = item.match(/\d+/g)?.map(Number) || [];
    return Math.max(score, ...numbers, 0);
  }, 0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getSelectedIndustry(policy) {
  const industryPolicies = policy.industryPolicies || [];
  return (
    industryPolicies.find((item) => item.id === selectedIndustryId) ||
    industryPolicies.find((item) => item.id === "all") ||
    industryPolicies[0] ||
    null
  );
}

function getComparableMonths(policy) {
  const selectedIndustry = getSelectedIndustry(policy);
  return selectedIndustry?.noInterestMonths || policy.noInterestMonths || [];
}

function updateBestMonth() {
  const bestMonth = monthScore(policies.flatMap(getComparableMonths));
  document.querySelector("#bestMonth").textContent = bestMonth
    ? `${bestMonth}개월`
    : "-";
}

function isConfirmedNone(industry) {
  return industry?.minimumAmount === "없음";
}

function formatNoInterestMonths(industry, policy) {
  const months = industry?.noInterestMonths || policy.noInterestMonths || [];
  if (months.length) return months.join(", ");
  return isConfirmedNone(industry) ? "검색결과 없음" : "원문 확인";
}

function formatPartialMonths(industry, policy) {
  const months = industry?.partialMonths || policy.partialMonths || [];
  if (months.length) return months.join(", ");
  return isConfirmedNone(industry) ? "검색결과 없음" : "없음 또는 미확인";
}

function formatMinimumAmount(industry, policy) {
  if (isConfirmedNone(industry)) return "검색결과 없음";
  if (industry?.minimumAmount) return industry.minimumAmount;
  return policy.minimumAmount || "가맹점별 상이";
}

function populateIndustryFilter() {
  const select = document.querySelector("#industryFilter");
  const industryMap = new Map();

  for (const policy of policies) {
    for (const industry of policy.industryPolicies || []) {
      if (!VISIBLE_INDUSTRY_IDS.has(industry.id)) continue;
      if (!industryMap.has(industry.id)) {
        industryMap.set(industry.id, industry.label);
      }
    }
  }

  select.innerHTML = [...industryMap.entries()]
    .map(
      ([id, label]) =>
        `<option value="${escapeHtml(id)}" ${
          id === selectedIndustryId ? "selected" : ""
        }>${escapeHtml(label)}</option>`
    )
    .join("");
  if (!industryMap.has(selectedIndustryId)) {
    selectedIndustryId = [...industryMap.keys()][0] || "pharmacy";
  }
  select.value = selectedIndustryId;
  select.disabled = industryMap.size === 0;
}

function render() {
  const query = document.querySelector("#searchInput").value.trim().toLowerCase();
  const grid = document.querySelector("#policyGrid");
  const filtered = policies
    .filter((policy) => {
      if (!query) return true;
      const industries = (policy.industryPolicies || []).flatMap((item) => [
        item.label,
        ...(item.noInterestMonths || []),
        ...(item.partialMonths || []),
        ...(item.notes || [])
      ]);
      const haystack = [
        policy.issuer,
        policy.period,
        policy.minimumAmount,
        ...(policy.noInterestMonths || []),
        ...(policy.partialMonths || []),
        ...(policy.notes || []),
        ...industries
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort(
      (a, b) =>
        monthScore(getComparableMonths(b)) - monthScore(getComparableMonths(a))
    );

  grid.innerHTML = filtered
    .map((policy) => {
      const selectedIndustry = getSelectedIndustry(policy);
      const periodStatus = getPeriodStatus(policy.period);
      const displayStatus = getDisplayStatus(policy.status);
      const statusTitle =
        policy.status === "unavailable"
          ? "공식 페이지 접속은 실패했지만 사전에 검증해 둔 보정값을 표시합니다."
          : STATUS_HELP[displayStatus] || "수집 상태를 확인할 수 없습니다.";
      const noInterestText = formatNoInterestMonths(selectedIndustry, policy);
      const partialText = formatPartialMonths(selectedIndustry, policy);
      const minimumAmount = formatMinimumAmount(selectedIndustry, policy);
      const industryNotes = (selectedIndustry?.notes || [])
        .map((note) => `<li>${escapeHtml(note)}</li>`)
        .join("");
      const notes = (policy.notes || [])
        .map((note) => `<li>${escapeHtml(note)}</li>`)
        .join("");
      const detectedEvents = (policy.detectedEvents || [])
        .map(
          (event) =>
            `<li><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.period)}</span></li>`
        )
        .join("");
      const eventList = detectedEvents
        ? `<div class="events"><span>공식 페이지 감지</span><ul>${detectedEvents}</ul></div>`
        : "";
      const source = policy.sourceUrl
        ? `<a class="sourceLink" href="${escapeHtml(policy.sourceUrl)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(policy.issuer)} 공식 홈페이지 조회">공식 홈페이지 조회</a>`
        : "";

      return `
        <article class="card">
          <div class="cardHeader">
            <span class="brandMark" style="background-color: ${escapeHtml(policy.brandColor)}" aria-hidden="true"></span>
            <div>
              <h2>${escapeHtml(policy.issuer)}</h2>
              <p class="periodLine">
                <span>${escapeHtml(policy.period)}</span>
                <span class="periodBadge ${escapeHtml(periodStatus.className)} tooltip" title="${escapeHtml(periodStatus.title)}" data-tooltip="${escapeHtml(periodStatus.title)}">${escapeHtml(periodStatus.label)}</span>
              </p>
            </div>
            <span class="badge ${escapeHtml(displayStatus)} tooltip" title="${escapeHtml(statusTitle)}" data-tooltip="${escapeHtml(statusTitle)}">${escapeHtml(STATUS_LABELS[displayStatus] || displayStatus)}</span>
          </div>

          <div class="selectedIndustry">
            <span>비교 업종</span>
            <strong>${escapeHtml(selectedIndustry?.label || "전체/일반")}</strong>
          </div>

          <div class="policyRows">
            <div>
              <span>무이자할부</span>
              <strong>${escapeHtml(noInterestText)}</strong>
            </div>
            <div>
              <span>부분무이자</span>
              <strong>${escapeHtml(partialText)}</strong>
            </div>
            <div>
              <span>결제금액</span>
              <strong>${escapeHtml(minimumAmount)}</strong>
            </div>
          </div>

          ${industryNotes ? `<ul class="notes industryNotes">${industryNotes}</ul>` : ""}
          <ul class="notes">${notes}</ul>
          ${eventList}
          ${source}
        </article>
      `;
    })
    .join("");

  updateBestMonth();
}

async function loadPolicies() {
  const notice = document.querySelector("#notice");

  try {
    const response = await fetch("/api/policies");
    const payload = await response.json();
    policies = payload.policies || [];

    populateIndustryFilter();
    document.querySelector("#updatedAt").textContent =
      formatTime(payload.generatedAt) || "갱신 완료";
    document.querySelector("#totalCount").textContent = policies.length || "-";
    document.querySelector("#collectedCount").textContent = payload.totalCount
      ? `${payload.collectedCount || 0}/${payload.totalCount}`
      : "-";
    notice.hidden = true;
    render();
  } catch (error) {
    notice.textContent = `수집 API 호출에 실패했습니다: ${error.message}`;
    notice.classList.add("error");
  }
}

document.querySelector("#searchInput").addEventListener("input", render);
document.querySelector("#industryFilter").addEventListener("change", (event) => {
  selectedIndustryId = event.target.value;
  render();
});
loadPolicies();
