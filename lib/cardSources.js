export const CURRENT_YEAR = 2026;

export const CARD_SOURCES = [
  {
    id: "shinhan",
    issuer: "신한카드",
    brandColor: "#176BFF",
    urls: [
      {
        label: "공식 무이자할부 안내",
        url: "https://www.shinhancard.com/pconts/html/benefit/franchise/MOBFM04030/MOBFM04030C01.html?crustMenuId=ms126",
        priority: "primary",
        period: "2026년 6월 1일 ~ 2026년 6월 30일"
      }
    ],
    fallback: {
      period: "2026년 6월 1일 ~ 2026년 6월 30일",
      noInterestMonths: ["2~3개월", "2~5개월"],
      partialMonths: ["7개월", "9개월", "11개월", "23개월"],
      minimumAmount: "5만원 이상",
      notes: ["업종 및 대상 업체별로 적용 개월이 다릅니다."]
    }
  },
  {
    id: "kb",
    issuer: "KB국민카드",
    brandColor: "#64513D",
    urls: [
      {
        label: "공식 생활편의업종 무이자할부",
        url: "https://card.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001?mainCC=a&eventNum=1001152",
        priority: "primary",
        period: "2026년 6월 1일 ~ 2026년 6월 30일"
      },
      {
        label: "공식 혜택가맹점 안내",
        url: "https://card.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001",
        priority: "secondary"
      }
    ],
    fallback: {
      period: "2026년 6월 1일 ~ 2026년 6월 30일",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["6개월"],
      minimumAmount: "5만원 이상 또는 가맹점별 상이",
      notes: ["혜택가맹점별 조건이 달라 원문 확인을 권장합니다."]
    }
  },
  {
    id: "hyundai",
    issuer: "현대카드",
    brandColor: "#111111",
    urls: [
      {
        label: "공식 가맹점 업종별 무이자/부분무이자",
        url: "https://www.hyundaicard.com/cpb/ev/CPBEV0101_06.hc?bnftWebEvntCd=XJO693&searchWord=",
        priority: "primary",
        period: "2026년 6월 1일 ~ 2026년 12월 31일"
      },
      {
        label: "공식 무이자할부 이벤트",
        url: "https://www.hyundaicard.com/cpb/ev/CPBEV0101_01.hc?evntCtgrVl=02&searchWord=",
        priority: "secondary"
      }
    ],
    fallback: {
      period: "2026년 6월 1일 ~ 2026년 12월 31일",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["10개월", "12개월", "18개월", "24개월"],
      minimumAmount: "5만원 이상",
      notes: ["가맹점 업종별 무이자/부분무이자 상세 페이지 기준으로 적용됩니다."]
    }
  },
  {
    id: "samsung",
    issuer: "삼성카드",
    brandColor: "#0B67D1",
    urls: [
      {
        label: "공식 무이자할부 안내",
        url: "https://www.samsungcard.com/personal/services/merchant/free-install/UHPPBE0701M0.jsp?click=gnb_benefit_free",
        priority: "primary",
        period: "2026년 6월 1일 ~ 2026년 6월 30일"
      }
    ],
    fallback: {
      period: "2026년 6월 1일 ~ 2026년 6월 30일",
      noInterestMonths: ["2~5개월"],
      partialMonths: [],
      minimumAmount: "5만원 이상",
      notes: ["홈쇼핑, 세금, 병원 등 일부 업종 제외 가능성이 있습니다."]
    }
  },
  {
    id: "lotte",
    issuer: "롯데카드",
    brandColor: "#D71920",
    urls: [
      {
        label: "공식 생활 플러스 업종 무이자할부",
        url: "https://www.lottecard.co.kr/app/LPBNFDA_V300.lc?evnBultSeq=8392&evnCtgSeq=2&bigTabGubun=2",
        priority: "primary",
        period: "2026년 4월 1일 ~ 2026년 6월 30일"
      },
      {
        label: "공식 진행이벤트 목록",
        url: "https://www.lottecard.co.kr/app/LPBNFDA_V100.lc",
        priority: "secondary",
        searchKeyword: "생활 플러스 업종"
      }
    ],
    fallback: {
      period: "2026년 4월 1일 ~ 2026년 6월 30일",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: ["생활 플러스 업종은 롯데카드에 등록된 가맹점 업종 기준으로 적용됩니다."]
    }
  },
  {
    id: "hana",
    issuer: "하나카드",
    brandColor: "#008C8C",
    urls: [
      {
        label: "공식 6월 무이자할부 혜택",
        url: "https://www.hanacard.co.kr/OPP35250001D.web?schID=mcd&mID=OPP35250000D&AN_NO=14434",
        priority: "primary",
        currentMonthDetail: true,
        validMonth: 6,
        period: "2026년 6월 1일 ~ 2026년 6월 30일"
      },
      {
        label: "공식 무이자할부 안내",
        url: "https://www.hanacard.co.kr/OPP35250000D.web?schID=mcd&mID=OPP35250000D",
        priority: "secondary"
      }
    ],
    fallback: {
      period: "2026년 6월 1일 ~ 2026년 6월 30일",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["6개월", "10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: ["일부 업종은 제외되며 부분무이자 고객 부담 회차가 있습니다."]
    }
  },
  {
    id: "bc",
    issuer: "BC카드",
    brandColor: "#D8193F",
    urls: [
      {
        label: "페이북 업종별 무이자할부 상세",
        url: "https://web.paybooc.co.kr/web/evnt/evnt-dts?pybcUnifEvntNo=2026030035&evntMrktTypCd=06&ordering=RECENT&ingPositionTop=700",
        priority: "primary",
        imagePolicy: true,
        period: "2026년 4월 1일 ~ 2026년 6월 30일"
      },
      {
        label: "페이북 이벤트 안내",
        url: "https://web.paybooc.co.kr/web/evnt/main#link",
        priority: "secondary",
        searchKeywords: ["무이자", "무이자할부", "업종별 무이자할부"]
      }
    ],
    fallback: {
      period: "2026년 4월 1일 ~ 2026년 6월 30일",
      noInterestMonths: ["2~6개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: ["은행/브랜드 제휴카드별 예외가 있을 수 있습니다."]
    }
  },
  {
    id: "woori",
    issuer: "우리카드",
    brandColor: "#0067B1",
    urls: [
      {
        label: "공식 통합검색 할부 종합 안내",
        url: "https://pc.wooricard.com/dcpc/totSearch.do?gubn=01&mGubn=W&searchTerm=%ED%95%A0%EB%B6%80%20%EC%A2%85%ED%95%A9%20%EC%95%88%EB%82%B4",
        priority: "primary",
        searchKeyword: "우리카드 할부 종합 안내"
      },
      {
        label: "공식 할부 종합 안내 상세",
        url: "https://pc.wooricard.com/dcpc/yh1/bnf/bnf02/prgevnt/movePrgEvntDtl.do?evntSrno=30005624",
        priority: "fallback-detail",
        period: "2026년 4월 1일 ~ 2026년 6월 30일"
      },
      {
        label: "공식 이벤트 안내",
        url: "https://pc.wooricard.com/dcpc/yh1/bnf/bnf02/prgevnt/H1BNF202S00.do",
        priority: "fallback-list"
      }
    ],
    fallback: {
      period: "2026년 4월 1일 ~ 2026년 6월 30일",
      noInterestMonths: ["2~6개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: ["자동차, 세금, 4대보험 등 일부 업종 제외 가능성이 있습니다."]
    }
  },
  {
    id: "ibk",
    issuer: "IBK기업은행",
    brandColor: "#0066B3",
    urls: [
      {
        label: "공식 진행중 이벤트",
        url: "https://www.ibk.co.kr/event/ingListEvent.ibk?pageId=CM01060100&evnt_dsc",
        priority: "primary",
        searchKeywords: ["생활편의", "생활 편의", "무이자 할부", "무이자할부"]
      }
    ],
    fallback: {
      period: "검색결과 없음",
      noInterestMonths: [],
      partialMonths: [],
      minimumAmount: "없음",
      notes: ["공식 진행중 이벤트에서 생활편의/무이자할부 관련 검색결과가 없으면 혜택 없음으로 표시합니다."]
    }
  }
];
