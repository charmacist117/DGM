const FALLBACK_INDUSTRIES = [
  { id: "all", label: "전체/일반" },
  { id: "tax", label: "국세/지방세" },
  { id: "hospital", label: "병원/의원/치과/한의원" },
  { id: "pharmacy", label: "약국" },
  { id: "education", label: "학원/교육" },
  { id: "auto", label: "자동차/보험" },
  { id: "shopping", label: "쇼핑/생활편의" }
];

const SOURCE_NOTE =
  "공식 업종별 세부 조건을 자동 확인하지 못했습니다. 원문 확인이 필요합니다.";

const UNCONFIRMED = {
  noInterestMonths: [],
  partialMonths: [],
  minimumAmount: "원문 확인 필요",
  notes: [SOURCE_NOTE]
};

const NOT_FOUND_PHARMACY = {
  noInterestMonths: [],
  partialMonths: [],
  minimumAmount: "없음",
  notes: ["공식 페이지에 접속해 확인했지만 약국 관련 무이자할부 조건을 찾지 못했습니다."]
};

const VERIFIED_INDUSTRIES = {
  kb: [
    {
      id: "all",
      label: "전체/일반",
      noInterestMonths: ["2~5개월", "2~3개월"],
      partialMonths: ["6개월", "10개월", "12개월", "18개월", "24개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "KB국민카드 공식 생활편의업종 무이자할부 상세 페이지에서 업종별 2~5개월 또는 2~3개월 무이자할부와 부분무이자 조건을 확인했습니다."
      ]
    },
    {
      id: "tax",
      label: "국세/지방세",
      noInterestMonths: [],
      partialMonths: ["국세·지방세 부분 무이자할부"],
      minimumAmount: "원문 확인 필요",
      notes: [
        "KB국민카드 공식 이벤트 목록에서 '국세·지방세 부분 무이자할부!' 이벤트가 확인되었습니다."
      ]
    },
    {
      id: "hospital",
      label: "병원/의원/치과/한의원",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["6개월", "10개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "KB국민카드 생활편의업종 상세 페이지에서 종합병원, 일반·치과·한방병원/한의원, 건강진단센터, 산후조리원이 2~5개월 무이자 및 6/10개월 부분무이자 대상임을 확인했습니다."
      ]
    },
    {
      id: "pharmacy",
      label: "약국",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["6개월", "10개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "KB국민카드 생활편의업종 상세 페이지에서 기타의료 업종의 약국이 2~3개월 무이자할부 대상임을 확인했습니다."
      ]
    },
    {
      id: "education",
      label: "학원/교육",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["6개월", "10개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "KB국민카드 생활편의업종 상세 페이지에서 학원, 학습지 업종이 2~3개월 무이자할부 대상임을 확인했습니다. 문화센터는 제외됩니다."
      ]
    },
    {
      id: "auto",
      label: "자동차/보험",
      noInterestMonths: ["2~5개월", "2~3개월"],
      partialMonths: ["6개월", "10개월", "12개월", "18개월", "24개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "KB국민카드 생활편의업종 상세 페이지에서 손해보험은 2~5개월 무이자 및 6/10/12/18/24개월 부분무이자, 차량정비·부품·인테리어는 2~3개월 무이자 대상임을 확인했습니다."
      ]
    },
    {
      id: "shopping",
      label: "쇼핑/생활편의",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["6개월", "10개월", "12개월", "18개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "KB국민카드 생활편의업종 상세 페이지에서 온라인 쇼핑, 백화점/대형쇼핑센터/일반잡화판매점, 할인점, 여행, 가전, 의류, 안경점, 의료기기 및 용품 등이 2~3개월 무이자할부 대상임을 확인했습니다."
      ]
    }
  ],

  hyundai: [
    {
      id: "all",
      label: "전체/일반",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["10개월", "12개월", "18개월", "24개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "현대카드 공식 가맹점 업종별 무이자/부분 무이자 할부 상세 페이지에서 5만원 이상 결제 시 대상 업종별 최대 3개월 무이자 및 최대 24개월 부분무이자 조건을 확인했습니다."
      ]
    },
    { id: "tax", label: "국세/지방세", ...UNCONFIRMED },
    {
      id: "hospital",
      label: "병원/의원/치과/한의원",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "현대카드 공식 상세 페이지에서 병원(종합/일반/동물/한의원)이 2~3개월 무이자 및 10/12개월 부분무이자 대상 업종으로 확인됐습니다. 약국은 해당 병원 업종 표기에 포함되지 않았습니다."
      ]
    },
    {
      id: "pharmacy",
      label: "약국",
      noInterestMonths: [],
      partialMonths: [],
      minimumAmount: "없음",
      notes: [
        "현대카드 공식 가맹점 업종별 무이자/부분 무이자 할부 상세 페이지에 접속해 확인했지만 약국 관련 무이자할부 조건을 찾지 못했습니다."
      ]
    },
    {
      id: "education",
      label: "학원/교육",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "현대카드 공식 상세 페이지에서 학원 업종이 2~3개월 무이자 및 10/12개월 부분무이자 대상 업종으로 확인됐습니다."
      ]
    },
    {
      id: "auto",
      label: "자동차/보험",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["10개월", "12개월", "18개월", "24개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "현대카드 공식 상세 페이지에서 손해보험은 2~3개월 무이자 및 10/12/18/24개월 부분무이자, 자동차 정비는 2~3개월 무이자 및 10/12개월 부분무이자 대상 업종으로 확인됐습니다."
      ]
    },
    {
      id: "shopping",
      label: "쇼핑/생활편의",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "현대카드 공식 상세 페이지에서 온라인, 항공/면세점/여행, 백화점, 의류, 가전, 대형마트 등이 업종별 2~3개월 무이자 대상 업종으로 확인됐습니다. 일부 온라인몰은 1만원 이상 결제 시 적용됩니다."
      ]
    }
  ],

  shinhan: [
    {
      id: "all",
      label: "전체/일반",
      noInterestMonths: ["2~7개월", "2~5개월", "2~3개월"],
      partialMonths: [
        "7개월",
        "9개월",
        "10개월",
        "11개월",
        "12개월",
        "18개월",
        "23개월",
        "24개월"
      ],
      minimumAmount: "5만원 이상",
      notes: ["공식 무이자할부 안내 페이지에서 확인된 대표 조건입니다."]
    },
    {
      id: "tax",
      label: "국세/지방세",
      noInterestMonths: ["2~7개월"],
      partialMonths: ["10개월", "12개월", "18개월", "24개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "국세는 10/12/18/24개월 슬림할부, 지방세는 10/12개월 슬림할부가 표시됩니다."
      ]
    },
    {
      id: "hospital",
      label: "병원/의원/치과/한의원",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["7개월", "9개월", "11개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "공식 페이지에서 종합병원과 일반병원 모두 2~3개월 무이자 및 7/9/11개월 슬림할부가 확인되었습니다. 일반병원에는 개인병원, 치과병원, 한의원 등이 포함됩니다."
      ]
    },
    {
      id: "pharmacy",
      label: "약국",
      noInterestMonths: ["2~3개월"],
      partialMonths: [],
      minimumAmount: "5만원 이상",
      notes: ["신한카드 공식 페이지에서 약국 2~3개월 무이자할부가 확인되었습니다."]
    },
    {
      id: "education",
      label: "학원/교육",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "학원은 2~3개월, 대학등록금은 2~3개월 및 10/12개월 슬림할부가 표시됩니다."
      ]
    },
    {
      id: "auto",
      label: "자동차/보험",
      noInterestMonths: ["2~5개월", "2~3개월"],
      partialMonths: ["7개월", "9개월", "10개월", "11개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "손해보험은 2~5개월 및 7/9/11개월 슬림할부, 차량정비는 2~3개월 및 10개월 슬림할부가 표시됩니다."
      ]
    },
    {
      id: "shopping",
      label: "쇼핑/생활편의",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["7개월", "9개월", "11개월", "23개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "온라인 쇼핑은 2~3개월 무이자 및 7/9/11/23개월 슬림할부가 확인되었습니다."
      ]
    }
  ],

  samsung: [
    {
      id: "all",
      label: "전체/일반",
      noInterestMonths: ["2~5개월", "2~3개월"],
      partialMonths: [
        "6개월",
        "7개월",
        "10개월",
        "11개월",
        "12개월",
        "18개월",
        "23개월",
        "24개월"
      ],
      minimumAmount: "5만원 이상",
      notes: ["공식 무이자할부 가맹점 페이지에서 확인된 대표 조건입니다."]
    },
    {
      id: "tax",
      label: "국세/지방세",
      noInterestMonths: [],
      partialMonths: [],
      minimumAmount: "원문 확인 필요",
      notes: [
        "삼성카드 공식 업종표에는 국세/지방세 조건이 확인되지 않았습니다."
      ]
    },
    {
      id: "hospital",
      label: "병원/의원/치과/한의원",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["7개월", "11개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "공식 페이지에서 병원 2~5개월 무이자할부가 확인되었습니다. 병원이 포함된 묶음 업종에는 7/11개월 다이어트 할부가 표시됩니다."
      ]
    },
    {
      id: "pharmacy",
      label: "약국",
      noInterestMonths: ["2~3개월"],
      partialMonths: [],
      minimumAmount: "5만원 이상",
      notes: ["삼성카드 공식 페이지에서 약국 2~3개월 무이자할부가 확인되었습니다."]
    },
    {
      id: "education",
      label: "학원/교육",
      noInterestMonths: ["2~3개월"],
      partialMonths: ["6개월", "10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "학원은 2~3개월, 대학등록금은 2~3개월 및 6/10/12개월 다이어트 할부가 표시됩니다."
      ]
    },
    {
      id: "auto",
      label: "자동차/보험",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["7개월", "11개월", "18개월", "24개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "자동차보험은 2~5개월 무이자 및 7/11/18/24개월 다이어트 할부가 표시됩니다."
      ]
    },
    {
      id: "shopping",
      label: "쇼핑/생활편의",
      noInterestMonths: ["2~5개월", "2~3개월", "10개월"],
      partialMonths: ["7개월", "11개월", "23개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "아울렛, 백화점, 대형마트, 온라인쇼핑몰 등은 업종별로 2~5개월 또는 2~3개월 무이자가 표시됩니다. 백화점 10개월은 100만원 이상 조건입니다."
      ]
    }
  ],

  lotte: [
    {
      id: "all",
      label: "전체/일반",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "롯데카드 진행이벤트 목록에서 '생활 플러스 업종' 키워드로 확인되는 공식 상세 페이지 기준입니다. 2026.04.01~2026.06.30 기간 동안 5만원 이상 이용 시 대상 업종 2~5개월 무이자할부가 확인되었습니다."
      ]
    },
    { id: "tax", label: "국세/지방세", ...UNCONFIRMED },
    {
      id: "hospital",
      label: "병원/의원/치과/한의원",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "롯데카드 생활 플러스 업종 상세 페이지에서 종합병원 업종이 2~5개월 무이자할부 대상에 포함된 것으로 확인되었습니다."
      ]
    },
    {
      id: "pharmacy",
      label: "약국",
      noInterestMonths: [],
      partialMonths: [],
      minimumAmount: "없음",
      notes: [
        "롯데카드 공식 페이지에 접속해 확인했지만 약국 관련 무이자할부 조건을 찾지 못했습니다."
      ]
    },
    {
      id: "education",
      label: "학원/교육",
      noInterestMonths: [],
      partialMonths: [],
      minimumAmount: "없음",
      notes: [
        "롯데카드 생활 플러스 업종 상세 페이지에 접속해 확인했지만 학원/교육 관련 무이자할부 조건을 찾지 못했습니다."
      ]
    },
    {
      id: "auto",
      label: "자동차/보험",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "롯데카드 생활 플러스 업종 상세 페이지에서 여행사·항공사 및 손해보험 업종이 2~5개월 무이자할부 대상에 포함된 것으로 확인되었습니다. 차량정비/자동차부품 업종은 해당 페이지에서 확인되지 않았습니다."
      ]
    },
    {
      id: "shopping",
      label: "쇼핑/생활편의",
      noInterestMonths: ["2~5개월"],
      partialMonths: ["10개월", "12개월"],
      minimumAmount: "5만원 이상",
      notes: [
        "롯데카드 생활 플러스 업종 상세 페이지에서 전자상거래 업종이 2~5개월 무이자할부 대상에 포함된 것으로 확인되었습니다. 유니클로, 자라 매장 결제 및 도시가스 결제는 제외됩니다."
      ]
    }
  ]
};

VERIFIED_INDUSTRIES.hana = [
  {
    id: "all",
    label: "전체/일반",
    noInterestMonths: ["2~3개월"],
    partialMonths: ["6개월", "10개월", "12개월", "18개월"],
    minimumAmount: "5만원 이상",
    notes: [
      "하나카드 공식 이벤트/납부 안내에서 확인 가능한 대표 조건입니다. 업종별 적용 여부는 원문 확인이 필요합니다."
    ]
  },
  {
    id: "tax",
    label: "국세/지방세",
    noInterestMonths: [],
    partialMonths: ["6개월", "10개월", "12개월"],
    minimumAmount: "원문 확인 필요",
    notes: [
      "하나카드 공식 이벤트 상세에서 국세/지방세 6/10/12개월 부분 무이자할부가 확인되었습니다."
    ]
  },
  { id: "hospital", label: "병원/의원/치과/한의원", ...UNCONFIRMED },
  { id: "pharmacy", label: "약국", ...UNCONFIRMED },
  {
    id: "education",
    label: "학원/교육",
    noInterestMonths: ["2~3개월"],
    partialMonths: ["6개월", "10개월", "15개월"],
    minimumAmount: "5만원 이상",
    notes: [
      "하나카드 공식 대학등록금 납부 안내에서 2~3개월 전액 무이자 또는 6/10/15개월 부분 무이자가 확인되었습니다. 일반 학원 업종은 원문 확인이 필요합니다."
    ]
  },
  { id: "auto", label: "자동차/보험", ...UNCONFIRMED },
  { id: "shopping", label: "쇼핑/생활편의", ...UNCONFIRMED }
];

VERIFIED_INDUSTRIES.bc = [
  {
    id: "all",
    label: "전체/일반",
    noInterestMonths: ["2~5개월", "2~4개월", "2~3개월"],
    partialMonths: [],
    minimumAmount: "5만원 이상",
    notes: [
      "페이북 공식 업종별 무이자할부 이미지 표에서 업종별로 2~5개월, 2~4개월, 2~3개월 무이자 대상이 나뉘어 있음을 확인했습니다."
    ]
  },
  {
    id: "tax",
    label: "국세/지방세",
    noInterestMonths: ["2~3개월"],
    partialMonths: ["6개월", "10개월", "12개월"],
    minimumAmount: "5만원 이상",
    notes: [
      "페이북 공식 세금 업종 이벤트에서 국세/지방세 2~3개월 무이자 및 6/10/12개월 부분 무이자가 확인되었습니다. 일부 발급 은행은 제외될 수 있습니다."
    ]
  },
  {
    id: "hospital",
    label: "병원/의원/치과/한의원",
    noInterestMonths: ["2~5개월"],
    partialMonths: [],
    minimumAmount: "5만원 이상",
    notes: [
      "페이북 공식 업종별 무이자할부 이미지 표에서 종합병원, 병원, 의원, 한의원, 치과의원, 치과병원, 한방병원 등이 2~5개월 대상 업종으로 확인됐습니다."
    ]
  },
  {
    id: "pharmacy",
    label: "약국",
    noInterestMonths: ["2~3개월"],
    partialMonths: [],
    minimumAmount: "5만원 이상",
    notes: [
      "페이북 공식 업종별 무이자할부 이미지 표의 2~3개월 대상 업종에 약국이 포함된 것을 확인했습니다."
    ]
  },
  {
    id: "education",
    label: "학원/교육",
    noInterestMonths: ["2~3개월"],
    partialMonths: [],
    minimumAmount: "5만원 이상",
    notes: [
      "페이북 공식 업종별 무이자할부 이미지 표에서 외국어학원, 기능학원, 컴퓨터학원, 예체능학원, 보습학원, 학습지교육, 초중고교육기관, 유치원, 유아원, 독서실, 유학원 등이 2~3개월 대상 업종으로 확인됐습니다."
    ]
  },
  {
    id: "auto",
    label: "자동차/보험",
    noInterestMonths: ["2~3개월"],
    partialMonths: [],
    minimumAmount: "5만원 이상",
    notes: [
      "페이북 공식 업종별 무이자할부 이미지 표에서 자동차시트/타이어, 자동차부품, 자동차정비, 국산신차직영부품/정비업소, 세차장, 견인서비스 등 차량정비/유지 업종이 2~3개월 대상 업종으로 확인됐습니다."
    ]
  },
  {
    id: "shopping",
    label: "쇼핑/생활편의",
    noInterestMonths: ["2~5개월", "2~3개월"],
    partialMonths: [],
    minimumAmount: "5만원 이상",
    notes: [
      "페이북 공식 업종별 무이자할부 이미지 표에서 온라인PG/온라인MALL/백화점은 2~5개월, 대형마트/슈퍼/가전/가구 등은 2~3개월 대상 업종으로 확인됐습니다."
    ]
  }
];

for (const cardId of ["hana"]) {
  const industry = VERIFIED_INDUSTRIES[cardId]?.find((item) => item.id === "pharmacy");
  if (industry) {
    Object.assign(industry, NOT_FOUND_PHARMACY);
  }
}

Object.assign(
  VERIFIED_INDUSTRIES.hana.find((industry) => industry.id === "pharmacy"),
  {
    noInterestMonths: ["2~3개월"],
    partialMonths: ["10개월", "12개월"],
    minimumAmount: "5만원 이상",
    notes: [
      "하나카드 공식 6월 무이자할부 & 부분 무이자할부 혜택 상세 글에서 약국 업종이 무이자 2~3개월 및 부분무이자 10/12개월 대상임을 확인했습니다. 매일 00:00 KST 자동 수집 성공 시 최신 월간 게시글 기준으로 갱신됩니다."
    ]
  }
);

for (const cardId of ["woori", "ibk"]) {
  VERIFIED_INDUSTRIES[cardId] = FALLBACK_INDUSTRIES.map((industry) => {
    if (industry.id === "all") {
      return {
        ...industry,
        noInterestMonths: [],
        partialMonths: [],
        minimumAmount: "원문 확인 필요",
        notes: ["카드사 대표 조건 및 업종별 세부 조건은 원문 확인이 필요합니다."]
      };
    }
    if (industry.id === "pharmacy") {
      return { ...industry, ...NOT_FOUND_PHARMACY };
    }
    return { ...industry, ...UNCONFIRMED };
  });
}

Object.assign(
  VERIFIED_INDUSTRIES.woori.find((industry) => industry.id === "pharmacy"),
  {
    noInterestMonths: ["2~3개월"],
    partialMonths: ["10개월", "12개월"],
    minimumAmount: "5만원 이상",
    notes: [
      "우리카드 공식 할부 종합 안내 검색 결과에서 약국 업종의 허용개월수가 무이자(2~3), 부분무이자(10/12)로 확인되었습니다. 매일 00:00 KST 자동 수집 성공 시 최신 공식 본문 기준으로 갱신됩니다."
    ]
  }
);

VERIFIED_INDUSTRIES.ibk = FALLBACK_INDUSTRIES.map((industry) => ({
  ...industry,
  noInterestMonths: [],
  partialMonths: [],
  minimumAmount: "없음",
  notes: [
    "IBK기업은행 공식 진행중 이벤트에서 생활편의/무이자할부 관련 게시글을 찾지 못하면 검색결과 없음으로 표시합니다."
  ]
}));

function applyIndustryOverrides(basePolicies, overrides = []) {
  if (!overrides.length) return basePolicies;

  const overrideMap = new Map(overrides.map((industry) => [industry.id, industry]));
  return basePolicies.map((industry) => ({
    ...industry,
    ...(overrideMap.get(industry.id) || {})
  }));
}

export function getIndustryPolicies(cardId, fallback, overrides = []) {
  if (VERIFIED_INDUSTRIES[cardId]) {
    return applyIndustryOverrides(VERIFIED_INDUSTRIES[cardId], overrides);
  }

  const fallbackPolicies = FALLBACK_INDUSTRIES.map((industry) => {
    if (industry.id === "all") {
      return {
        ...industry,
        noInterestMonths: fallback.noInterestMonths || [],
        partialMonths: fallback.partialMonths || [],
        minimumAmount: fallback.minimumAmount || "원문 확인 필요",
        notes: [
          "카드사 대표 조건입니다. 업종별 세부 조건은 원문 확인이 필요합니다."
        ]
      };
    }

    return {
      ...industry,
      ...UNCONFIRMED
    };
  });

  return applyIndustryOverrides(fallbackPolicies, overrides);
}
