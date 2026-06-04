import { CARD_SOURCES } from "./cardSources.js";
import { getIndustryPolicies } from "./industryPolicies.js";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; CardPolicyViewer/0.1; +https://vercel.app)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

function compact(value) {
  return value.replace(/\s+/g, " ").trim();
}

function htmlToText(html) {
  return compact(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#40;/g, "(")
      .replace(/&#41;/g, ")")
  );
}

function stripTags(value) {
  return compact(value.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " "));
}

function getKstDate(value = new Date()) {
  return new Date(value.getTime() + 9 * 60 * 60 * 1000);
}

function getCurrentKstMidnightIso(value = new Date()) {
  const kstDate = getKstDate(value);
  const kstMidnightUtcMs =
    Date.UTC(
      kstDate.getUTCFullYear(),
      kstDate.getUTCMonth(),
      kstDate.getUTCDate(),
      0,
      0,
      0
    ) -
    9 * 60 * 60 * 1000;

  return new Date(kstMidnightUtcMs).toISOString();
}

function getCurrentKstMonth() {
  return getKstDate().getUTCMonth() + 1;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean).map((value) => compact(value)))];
}

function findPeriod(text) {
  const normalizedText = text.replace(/\((?:월|화|수|목|금|토|일)\)/g, "");
  const patterns = [
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*[~\-–]\s*(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일/,
    /(\d{4})[.\-]\s*(\d{1,2})[.\-]\s*(\d{1,2})\s*[~\-–]\s*(?:(\d{4})[.\-]\s*)?(\d{1,2})[.\-]\s*(\d{1,2})/
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (!match) continue;
    const endYear = match[4] || match[1];
    return `${match[1]}년 ${match[2]}월 ${match[3]}일 ~ ${endYear}년 ${match[5]}월 ${match[6]}일`;
  }

  const monthMatch = normalizedText.match(/(\d{4})년\s*(\d{1,2})월/);
  return monthMatch ? `${monthMatch[1]}년 ${monthMatch[2]}월 공지` : "";
}

function findMinimumAmount(text) {
  const amounts = [...text.matchAll(/([1-9]\d*)\s*만원\s*이상/g)].map(
    (match) => Number(match[1])
  );
  if (!amounts.length) return "";

  const uniqueAmounts = [...new Set(amounts)];
  if (uniqueAmounts.includes(5)) return "5만원 이상";

  const minimum = Math.min(...uniqueAmounts);
  return uniqueAmounts.length > 1
    ? `${minimum}만원 이상 등 조건별 상이`
    : `${minimum}만원 이상`;
}

function normalizeMonthRange(value) {
  return compact(value)
    .replace(/\s*~\s*/g, "~")
    .replace(/\s*-\s*/g, "~")
    .replace(/\s*·\s*/g, ", ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+개월/g, "개월")
    .replace(/개월\s*개월/g, "개월");
}

function findNoInterestMonths(text) {
  const matches = [];
  const patterns = [
    /무이자\s*할부\s*([0-9,\s~\-·]+개월?)/g,
    /([2-9]\s*[~\-]\s*\d{1,2}\s*개월)\s*무이자\s*할부/g,
    /([2-9]\s*[~\-]\s*\d{1,2}\s*개월)\s*무이자/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      matches.push(normalizeMonthRange(match[1]));
    }
  }

  return uniq(matches)
    .filter((value) => /^[23]/.test(value))
    .slice(0, 6);
}

function findPartialMonths(text) {
  const matches = [];
  const patterns = [
    /부분\s*무이자\s*할부\s*([0-9,\s~\-·]+개월?)/g,
    /슬림\s*할부\s*([0-9,\s~\-·]+개월?)/g,
    /([4-9]\s*[~\-]\s*\d{1,2}\s*개월|1[0-9]\s*개월|2[0-4]\s*개월)\s*부분\s*무이자/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      matches.push(normalizeMonthRange(match[1]));
    }
  }

  return uniq(matches).slice(0, 8);
}

function issuerWindow(text, issuer) {
  const aliases = {
    KB국민카드: ["KB국민", "국민카드"],
    BC카드: ["비씨", "BC"],
    NH농협카드: ["NH농협", "농협카드"],
    우리카드: ["우리"],
    IBK기업은행: ["IBK", "기업은행", "IBK카드"],
    신한카드: ["신한"],
    삼성카드: ["삼성"],
    현대카드: ["현대"],
    롯데카드: ["롯데"],
    하나카드: ["하나"]
  }[issuer] || [issuer];

  for (const alias of aliases) {
    const index = text.indexOf(alias);
    if (index >= 0) {
      return text.slice(Math.max(0, index - 400), index + 1800);
    }
  }
  return text.slice(0, 2400);
}

function extractKbEvents(html) {
  if (!html) return [];

  const eventRegex =
    /goDetail\('([^']+)'[\s\S]*?<span class="subject">([\s\S]*?)<\/span>\s*<span class="date">([^<]+)<\/span>/g;
  const keywordRegex = /무이자|할부|개월/;

  return [...html.matchAll(eventRegex)]
    .map((match) => ({
      id: match[1],
      title: stripTags(match[2]),
      period: match[3].trim()
    }))
    .filter((event) => keywordRegex.test(event.title))
    .slice(0, 8);
}

function findHanaCurrentMonthDetail(html) {
  const month = getCurrentKstMonth();
  const title = `${month}월, 무이자할부 & 부분 무이자할부 혜택`;
  const normalizedHtml = html.replace(/&amp;/g, "&");
  const titleIndex = normalizedHtml.indexOf(title);
  if (titleIndex < 0) return null;

  const windowText = normalizedHtml.slice(
    Math.max(0, titleIndex - 2000),
    titleIndex + 2000
  );
  const detailPath = windowText.match(/OPP35250001D\.web[^"'<>\\\s)]*AN_NO[=&#37;3D]+(\d+)/i);
  const detailId =
    detailPath?.[1] ||
    windowText.match(/AN_NO['"]?\s*[:=]\s*['"]?(\d+)/i)?.[1] ||
    windowText.match(/AN_NO=(\d+)/i)?.[1];

  if (!detailId) return null;

  return {
    title,
    url: `https://www.hanacard.co.kr/OPP35250001D.web?AN_NO=${detailId}&mID=OPP35250000D&schID=ncd`
  };
}

const HANA_CATEGORY_LABELS = [
  "온라인쇼핑",
  "백화점",
  "손해보험",
  "종합병원",
  "일반병원",
  "한방병원",
  "치과병원",
  "약국",
  "대형마트",
  "항공",
  "면세점",
  "여행사",
  "SSM",
  "대형쇼핑센터/아울렛",
  "차량정비",
  "가전",
  "가구",
  "의류/스포츠/레저용품",
  "세금(국세/지방세)",
  "4대보험",
  "동물병원",
  "학원"
];

function findHanaCategoryWindow(text, label) {
  const start = text.indexOf(label);
  if (start < 0) return "";

  const end = HANA_CATEGORY_LABELS.reduce((nearest, nextLabel) => {
    if (nextLabel === label) return nearest;
    const index = text.indexOf(nextLabel, start + label.length);
    return index > start && index < nearest ? index : nearest;
  }, text.length);

  return text.slice(start, end);
}

function parseHanaMonths(section) {
  const noInterestMonths = [];
  const partialMonths = [];

  for (const match of section.matchAll(/무이자할부\s*([0-9]{1,2}\s*[~\-]\s*[0-9]{1,2})\s*개월/g)) {
    noInterestMonths.push(`${match[1].replace(/\s+/g, "")}개월`);
  }

  for (const match of section.matchAll(/부분\s*무이자할부\s*([0-9/,\s]+)\s*개월/g)) {
    for (const month of match[1].split(/[\/,\s]+/)) {
      if (month) partialMonths.push(`${month}개월`);
    }
  }

  return {
    noInterestMonths: uniq(noInterestMonths),
    partialMonths: uniq(partialMonths)
  };
}

function formatWooriNoInterest(value) {
  const compactValue = value.replace(/\s+/g, "");
  return compactValue ? [`${compactValue}개월`] : [];
}

function formatWooriPartial(value) {
  return value
    .split(/[\/,\s]+/)
    .filter(Boolean)
    .map((month) => `${month}개월`);
}

function extractWooriIndustryPolicies(text, sourceUrl) {
  const pharmacyIndex = text.indexOf("약국");
  if (pharmacyIndex < 0) return [];

  const beforePharmacy = text.slice(0, pharmacyIndex);
  const benefitMatches = [
    ...beforePharmacy.matchAll(/(부분무이자|무이자)\s*\(([^)]+)\)/g)
  ];
  const noInterest = [...benefitMatches]
    .reverse()
    .find((match) => match[1] === "무이자")?.[2];
  const partial = [...benefitMatches]
    .reverse()
    .find((match) => match[1] === "부분무이자")?.[2];
  const noInterestMonths = noInterest ? formatWooriNoInterest(noInterest) : [];
  const partialMonths = partial ? formatWooriPartial(partial) : [];
  const hasPharmacyBenefit = noInterestMonths.length || partialMonths.length;

  return [
    {
      id: "pharmacy",
      label: "약국",
      noInterestMonths,
      partialMonths,
      minimumAmount: hasPharmacyBenefit ? "5만원 이상" : "없음",
      notes: [
        hasPharmacyBenefit
          ? "우리카드 공식 할부 종합 안내에서 약국 업종의 허용개월수를 자동 확인했습니다."
          : "우리카드 공식 할부 종합 안내에서 약국 업종을 확인했지만 무이자/부분무이자 허용개월수는 검색결과 없음으로 확인했습니다."
      ]
    }
  ];
}

function findWooriInstallmentDetail(searchHtml, searchText) {
  const normalizedHtml = searchHtml.replace(/&amp;/g, "&");
  const detailMatches = [
    ...normalizedHtml.matchAll(
      /(?:href=["']([^"']*movePrgEvntDtl\.do\?[^"']*evntSrno=\d+[^"']*)["']|movePrgEvntDtl\.do\?[^"'<>\\\s)]*evntSrno[=&#37;3D]+(\d+))/gi
    )
  ];
  const seen = new Set();
  const candidates = detailMatches
    .map((match) => {
      const rawUrl =
        match[1] ||
        `/dcpc/yh1/bnf/bnf02/prgevnt/movePrgEvntDtl.do?evntSrno=${match[2]}`;
      const context = normalizedHtml.slice(
        Math.max(0, match.index - 500),
        match.index + 500
      );
      try {
        return {
          url: new URL(rawUrl, "https://pc.wooricard.com").href,
          score: /할부\s*종합\s*안내/.test(stripTags(context)) ? 10 : 0
        };
      } catch {
        return null;
      }
    })
    .filter((candidate) => {
      if (!candidate?.url || seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    });

  if (candidates.length) {
    return candidates.sort((a, b) => b.score - a.score)[0].url;
  }

  const eventNumber = searchText.match(/evntSrno\s*[:=]\s*(\d+)/i)?.[1];
  return eventNumber
    ? `https://pc.wooricard.com/dcpc/yh1/bnf/bnf02/prgevnt/movePrgEvntDtl.do?evntSrno=${eventNumber}`
    : null;
}

function hasIbkInstallmentKeyword(text, keywords = []) {
  const normalizedText = text.replace(/\s+/g, "");
  return keywords.some((keyword) => normalizedText.includes(keyword.replace(/\s+/g, "")));
}

function findIbkDetailUrl(html, keywords = []) {
  const normalizedHtml = html.replace(/&amp;/g, "&");
  const normalizedKeywords = keywords.map((keyword) => keyword.replace(/\s+/g, ""));
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of normalizedHtml.matchAll(anchorRegex)) {
    const label = stripTags(match[2]).replace(/\s+/g, "");
    if (!normalizedKeywords.some((keyword) => label.includes(keyword))) continue;

    try {
      return new URL(match[1], "https://www.ibk.co.kr").href;
    } catch {
      return null;
    }
  }

  return null;
}

function extractIbkIndustryPolicies(text, sourceUrl) {
  const pharmacyIndex = text.indexOf("약국");
  if (pharmacyIndex < 0) {
    return [
      {
        id: "pharmacy",
        label: "약국",
        noInterestMonths: [],
        partialMonths: [],
        minimumAmount: "없음",
        notes: [
          "IBK기업은행 공식 이벤트 게시글에서 약국 관련 무이자할부 조건을 찾지 못했습니다."
        ]
      }
    ];
  }

  const windowText = text.slice(Math.max(0, pharmacyIndex - 800), pharmacyIndex + 800);
  const noInterestMonths = uniq(
    [...windowText.matchAll(/(?:무이자(?:할부)?|허용개월수)\s*\(?\s*([2-9]\s*[~\-]\s*\d{1,2})\s*\)?\s*개월?/g)].map(
      (match) => `${match[1].replace(/\s+/g, "")}개월`
    )
  );
  const partialMonths = uniq(
    [...windowText.matchAll(/부분\s*무이자(?:할부)?\s*\(?\s*([0-9/,\s]+)\s*\)?\s*개월?/g)]
      .flatMap((match) => match[1].split(/[\/,\s]+/))
      .filter(Boolean)
      .map((month) => `${month}개월`)
  );
  const hasPharmacyBenefit = noInterestMonths.length || partialMonths.length;

  return [
    {
      id: "pharmacy",
      label: "약국",
      noInterestMonths,
      partialMonths,
      minimumAmount: hasPharmacyBenefit ? "5만원 이상" : "없음",
      notes: [
        hasPharmacyBenefit
          ? "IBK기업은행 공식 이벤트 게시글에서 약국 관련 무이자할부 조건을 자동 확인했습니다."
          : "IBK기업은행 공식 이벤트 게시글에서 약국 업종을 확인했지만 무이자/부분무이자 조건은 검색결과 없음으로 확인했습니다."
      ]
    }
  ];
}

function extractHyundaiIndustryPolicies(text, sourceUrl) {
  if (!/가맹점\s*업종별\s*무이자/.test(text)) return [];

  const hasPharmacy = text.includes("약국");
  if (hasPharmacy) {
    return [];
  }

  return [
    {
      id: "pharmacy",
      label: "약국",
      noInterestMonths: [],
      partialMonths: [],
      minimumAmount: "없음",
      notes: [
        "현대카드 공식 가맹점 업종별 무이자/부분 무이자 할부 상세 페이지에서 약국 관련 조건을 찾지 못했습니다."
      ]
    }
  ];
}

function extractHanaIndustryPolicies(text, sourceUrl) {
  const minimumAmount = /5\s*만원\s*이상/.test(text) ? "5만원 이상" : "원문 확인 필요";
  const pharmacySection = findHanaCategoryWindow(text, "약국");
  if (!pharmacySection) return [];

  let pharmacyMonths = parseHanaMonths(pharmacySection);
  if (!pharmacyMonths.noInterestMonths.length && !pharmacyMonths.partialMonths.length) {
    const pharmacyIndex = text.indexOf("약국");
    const noticeIndex = text.indexOf("유의사항", pharmacyIndex);
    const broadSection = text.slice(
      pharmacyIndex,
      noticeIndex > pharmacyIndex ? noticeIndex : pharmacyIndex + 2000
    );
    pharmacyMonths = parseHanaMonths(broadSection);
  }
  const hasPharmacyBenefit =
    pharmacyMonths.noInterestMonths.length || pharmacyMonths.partialMonths.length;

  return [
    {
      id: "pharmacy",
      label: "약국",
      noInterestMonths: pharmacyMonths.noInterestMonths,
      partialMonths: pharmacyMonths.partialMonths,
      minimumAmount: hasPharmacyBenefit ? minimumAmount : "없음",
      notes: [
        hasPharmacyBenefit
          ? "하나카드 공식 월간 무이자할부 혜택 글에서 약국 업종 조건을 자동 확인했습니다."
          : "하나카드 공식 월간 무이자할부 혜택 글에서 약국 업종을 확인했지만 무이자/부분무이자 조건은 검색결과 없음으로 확인했습니다."
      ]
    }
  ];
}

function findDetectedEvents(source, html) {
  if (source.id === "kb") return extractKbEvents(html);
  return [];
}

function buildPolicyFromText(source, pageText, html = "") {
  const scopedText =
    source.urls.length > 1 || source.urls[0]?.priority === "secondary"
      ? issuerWindow(pageText, source.issuer)
      : pageText;
  const fallback = source.fallback;
  const noInterestMonths = findNoInterestMonths(scopedText);
  const partialMonths = findPartialMonths(scopedText);
  const detectedEvents = findDetectedEvents(source, html);
  const eventNotes = detectedEvents.length
    ? [
        `공식 페이지에서 확인된 이벤트: ${detectedEvents
          .map((event) => event.title)
          .join(", ")}`
      ]
    : [];

  return {
    id: source.id,
    issuer: source.issuer,
    brandColor: source.brandColor,
    period: findPeriod(scopedText) || findPeriod(pageText) || fallback.period,
    noInterestMonths: noInterestMonths.length
      ? noInterestMonths
      : fallback.noInterestMonths,
    partialMonths: partialMonths.length ? partialMonths : fallback.partialMonths,
    minimumAmount:
      findMinimumAmount(scopedText) ||
      findMinimumAmount(pageText) ||
      fallback.minimumAmount,
    notes: [...eventNotes, ...fallback.notes],
    industryPolicies: getIndustryPolicies(source.id, {
      noInterestMonths: noInterestMonths.length
        ? noInterestMonths
        : fallback.noInterestMonths,
      partialMonths: partialMonths.length ? partialMonths : fallback.partialMonths,
      minimumAmount:
        findMinimumAmount(scopedText) ||
        findMinimumAmount(pageText) ||
        fallback.minimumAmount
    }, source.industryOverrides || []),
    detectedEvents,
    status: noInterestMonths.length || detectedEvents.length ? "collected" : "fallback",
    sourceLabel: "",
    sourceUrl: "",
    updatedAt: new Date().toISOString()
  };
}

function buildPolicyFromPage(source, page, sourceInfo, overrides = [], extra = {}) {
  const policy = buildPolicyFromText(
    {
      ...source,
      industryOverrides: overrides
    },
    page.text,
    page.html
  );

  return {
    ...policy,
    period: sourceInfo.period || policy.period,
    sourceLabel: sourceInfo.label,
    sourceUrl: sourceInfo.url,
    ...extra
  };
}

async function fetchSource(url) {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "";
  let html = new TextDecoder("utf-8").decode(buffer);
  const headerCharset = contentType.match(/charset=([^;]+)/i)?.[1]?.toLowerCase();
  const htmlCharset = html.match(/charset=["']?([^"'\s/>]+)/i)?.[1]?.toLowerCase();
  const charset = headerCharset || htmlCharset || "";

  if (/euc-kr|ks_c_5601|cp949/.test(charset)) {
    html = new TextDecoder("euc-kr").decode(buffer);
  }

  return {
    html,
    text: htmlToText(html)
  };
}

async function collectCandidateUrls(source, errors = []) {
  for (const candidate of source.urls) {
    try {
      const page = await fetchSource(candidate.url);
      return buildPolicyFromPage(source, page, candidate, [], { errors });
    } catch (error) {
      errors.push(`${candidate.label}: ${error.message}`);
    }
  }

  return null;
}

function unavailablePolicy(source, errors = []) {
  return {
    id: source.id,
    issuer: source.issuer,
    brandColor: source.brandColor,
    ...source.fallback,
    status: "unavailable",
    sourceLabel: source.urls[0]?.label || "원문",
    sourceUrl: source.urls[0]?.url || "",
    errors,
    industryPolicies: getIndustryPolicies(source.id, source.fallback),
    updatedAt: new Date().toISOString()
  };
}

async function collectHana(source, errors = []) {
  const currentMonth = getCurrentKstMonth();
  const detailSource = source.urls.find(
    (candidate) =>
      candidate.currentMonthDetail &&
      (!candidate.validMonth || candidate.validMonth === currentMonth)
  );
  const listSource =
    source.urls.find((candidate) => candidate.url.includes("OPP35250000D.web")) ||
    source.urls[0];

  try {
    if (detailSource) {
      const detailPage = await fetchSource(detailSource.url);
      return buildPolicyFromPage(
        source,
        detailPage,
        detailSource,
        extractHanaIndustryPolicies(detailPage.text, detailSource.url)
      );
    }

    const listPage = await fetchSource(listSource.url);
    const detail = findHanaCurrentMonthDetail(listPage.html);

    if (detail) {
      const detailPage = await fetchSource(detail.url);
      return buildPolicyFromPage(
        source,
        detailPage,
        { label: detail.title, url: detail.url },
        extractHanaIndustryPolicies(detailPage.text, detail.url)
      );
    }

    errors.push("현재 월 무이자할부 혜택 글을 목록에서 찾지 못했습니다.");
  } catch (error) {
    errors.push(`${listSource.label}: ${error.message}`);
  }

  return collectCandidateUrls(source, errors);
}

async function collectWoori(source, errors = []) {
  const searchSource =
    source.urls.find((candidate) => candidate.searchKeyword) || source.urls[0];
  const fallbackDetailSource = source.urls.find(
    (candidate) => candidate.priority === "fallback-detail"
  );

  try {
    const searchPage = await fetchSource(searchSource.url);
    const detailUrl =
      findWooriInstallmentDetail(searchPage.html, searchPage.text) ||
      fallbackDetailSource?.url;
    const targetPage = detailUrl ? await fetchSource(detailUrl) : searchPage;
    const targetUrl = detailUrl || searchSource.url;
    const overrides = extractWooriIndustryPolicies(targetPage.text, targetUrl);
    return buildPolicyFromPage(
      source,
      targetPage,
      {
        label: overrides.length
        ? "공식 할부 종합 안내"
        : detailUrl && fallbackDetailSource?.url === detailUrl
          ? fallbackDetailSource.label
          : searchSource.label,
        url: targetUrl,
        period:
          detailUrl && fallbackDetailSource?.url === detailUrl
            ? fallbackDetailSource.period
            : undefined
      },
      overrides
    );
  } catch (error) {
    errors.push(`${searchSource.label}: ${error.message}`);
  }

  return collectCandidateUrls(source, errors);
}

async function collectIbk(source, errors = []) {
  const listSource = source.urls[0];

  try {
    const listPage = await fetchSource(listSource.url);
    const keywords = listSource.searchKeywords || [];
    const hasKeyword = hasIbkInstallmentKeyword(listPage.text, keywords);
    let targetPage = listPage;
    let targetUrl = listSource.url;
    let targetLabel = listSource.label;

    if (hasKeyword) {
      const detailUrl = findIbkDetailUrl(listPage.html, keywords);
      if (detailUrl) {
        targetPage = await fetchSource(detailUrl);
        targetUrl = detailUrl;
        targetLabel = "공식 생활편의/무이자할부 이벤트";
      }
    }

    const overrides = hasKeyword
      ? extractIbkIndustryPolicies(targetPage.text, targetUrl)
      : [];
    return buildPolicyFromPage(
      source,
      targetPage,
      {
        label: hasKeyword ? targetLabel : "공식 진행중 이벤트 검색결과 없음",
        url: targetUrl
      },
      overrides,
      hasKeyword ? {} : { period: "검색결과 없음" }
    );
  } catch (error) {
    errors.push(`${listSource.label}: ${error.message}`);
  }

  return unavailablePolicy(source, errors);
}

async function collectHyundai(source, errors = []) {

  for (const candidate of source.urls) {
    try {
      const page = await fetchSource(candidate.url);
      return buildPolicyFromPage(
        source,
        page,
        candidate,
        extractHyundaiIndustryPolicies(page.text, candidate.url)
      );
    } catch (error) {
      errors.push(`${candidate.label}: ${error.message}`);
    }
  }

  return null;
}

const CARD_COLLECTORS = {
  hana: collectHana,
  hyundai: collectHyundai,
  ibk: collectIbk,
  woori: collectWoori
};

async function collectOne(source) {
  const collector = CARD_COLLECTORS[source.id] || collectCandidateUrls;
  const errors = [];
  return (await collector(source, errors)) || unavailablePolicy(source, errors);
}

export async function collectPolicies() {
  const policies = await Promise.all(CARD_SOURCES.map(collectOne));
  const collectedCount = policies.filter(
    (policy) => policy.status === "collected"
  ).length;

  return {
    generatedAt: getCurrentKstMidnightIso(),
    collectedCount,
    totalCount: policies.length,
    policies
  };
}
