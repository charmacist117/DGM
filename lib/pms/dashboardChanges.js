export const DASHBOARD_CHANGE_NOTICE_TYPE = "dashboard_change_notice";

export const DASHBOARD_CHANGE_SEEDS = [
  {
    key: "pharmadev_dashboard_changelog_seed_20260724_1", id: "dashboard_change_initial",
    initialOnly: true,
    changes: [
      "공급단가 견적의 채택 예상·채택 재고 표시와 ADMIN 전용 삭제 권한을 적용했습니다.",
      "유통 구조 설정의 허가사 수수료 표기와 경쟁제품 비교 항목을 개선했습니다.",
      "온라인 및 PC용 화면에 동일한 변경사항을 반영했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260724_2", id: "dashboard_change_20260724_pricing_tabs",
    changes: [
      "유통 구조 설정에 물량 구간별 판매가·마진 가격대 탭을 추가했습니다.",
      "가격대별 적용 최소 물량, 참약사 마진율, 약국 판매가를 독립적으로 저장하도록 개선했습니다.",
      "유통 구조 공급단가 건 목록에 성분 함량을 함께 표시했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260724_3", id: "dashboard_change_20260724_module_backup",
    changes: [
      "제품개발·공급단가·유통 구조 설정 탭별 JSON 데이터 다운로드와 복원 기능을 추가했습니다.",
      "각 탭의 전체 내용을 한 파일로 확인할 수 있는 통합 CSV 보조 백업을 추가했습니다.",
      "유통 구조 설정에서 연결된 공급단가 건으로 돌아가는 양방향 이동 기능을 추가했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260724_4", id: "dashboard_change_20260724_project_backup_removal",
    changes: [
      "개별 프로젝트의 백업/복원 미니탭을 제거했습니다.",
      "제품개발 전체 백업·복원과 통합 CSV 기능을 최상단 데이터 이전 탭으로 일원화했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260724_5", id: "dashboard_change_20260724_home_split",
    changes: [
      "최상단에 독립적인 홈 탭을 추가하고 제품개발 대시보드 변경사항을 홈으로 이동했습니다.",
      "제품개발 탭은 프로젝트 진행 현황과 단계 리마인드만 표시하도록 정리했습니다.",
      "왼쪽 홈 버튼이 새 홈 탭으로 이동하도록 변경했습니다.",
      "변경사항 기록에 년·월·일과 시·분을 함께 표시하도록 개선했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260724_6", id: "dashboard_change_20260724_home_button_style",
    changes: [
      "상단 홈 탭과 왼쪽 홈 버튼의 크기를 줄였습니다.",
      "홈 진입 버튼을 하늘색 계열로 구분해 검정 내비게이션에서 쉽게 찾을 수 있도록 개선했습니다.",
      "유통 구조 설정의 공급단가 목록에 포장단위와 포장형태를 표시하도록 개선했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260724_7", id: "dashboard_change_20260724_distribution_reset",
    changes: [
      "유통 구조 설정에 전체 초기화 버튼을 추가했습니다.",
      "판매가·마진 설정과 경쟁제품 비교를 초기화한 뒤 유통 구조 미설정 상태로 되돌릴 수 있도록 개선했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260727_8", id: "dashboard_change_20260727_security_hardening",
    changes: [
      "웹·PC용 시스템의 인증, API 요청, 첨부파일 및 백업 데이터 보안을 강화했습니다.",
      "로그인 반복 시도 차단, 외부 출처 변경 요청 차단, 보안 헤더와 요청 용량 제한을 적용했습니다.",
      "Next.js와 하위 패키지를 보안 패치 버전으로 업데이트했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260727_9", id: "dashboard_change_20260727_market_analysis",
    changes: [
      "공급단가 품목과 연결되는 시장 규모 분석 탭을 추가했습니다.",
      "최근 5개년 생산·수입실적, 환율, 약국 점유율과 가맹약국 침투율 분석을 지원합니다.",
      "연간 소진수량, 필요 배치, 금융 기회비용과 공급단가 조정 기댓값을 자동 계산합니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260727_10", id: "dashboard_change_20260727_market_search_fix",
    changes: [
      "시장 규모 분석의 공급단가 건 검색 중 결과가 0건이 되어도 화면이 종료되지 않도록 수정했습니다.",
      "검색 결과가 없을 때 안내 화면을 표시하고, 다시 일치하는 검색어를 입력하면 품목 분석 화면이 복구됩니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260727_11", id: "dashboard_change_20260727_supply_scroll_fix",
    changes: [
      "유통 구조에서 공급단가로 돌아온 뒤 신규 건을 추가할 때 목록이 기존 품목을 따라 움직이던 현상을 수정했습니다.",
      "연결 품목 위치 이동은 최초 진입 시 한 번만 적용되고 이후 입력·정렬 중에는 자동 스크롤하지 않습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260727_12", id: "dashboard_change_20260727_supply_duplicate",
    changes: [
      "저장된 공급단가 건을 복사해 새로운 입력 건으로 만드는 기능을 추가했습니다.",
      "복합 성분과 견적 정보는 유지하고 포장단위 등을 바로 수정할 수 있으며, 유통 구조와 시장 분석은 새 건으로 초기화됩니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260727_13", id: "dashboard_change_20260727_market_growth_cost",
    changes: [
      "시장 규모 분석에서 5개년·3개년 연평균 성장률을 전환해 확인할 수 있도록 구분했습니다.",
      "조정 공급 원가를 직접 입력하고 공급수량, 배치 자금, 금융비용과 기대값 전체에 반영할 수 있습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260727_14", id: "dashboard_change_20260727_market_defaults_forecast",
    changes: [
      "시장 규모 분석 전역 기본값과 개별 품목 기본값 초기화·차이 확인 기능을 추가했습니다.",
      "참약사·제조사 판매가 조정률을 분리하고 최소 주문 배치 수를 소진기간·필요자금·금융비용에 반영했습니다.",
      "선택한 성장률에 따른 Year 1~3 예상 소진수량과 Year 1 YTD 전환 기능을 추가했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260727_15", id: "dashboard_change_20260727_market_growth_year_filter",
    changes: [
      "시장 규모 분석에서 연도별 실적을 성장률 계산에 포함하거나 제외할 수 있도록 추가했습니다.",
      "불완전한 최근 연도를 제외하면 선택된 4개년과 포함된 최근 3개년 기준으로 성장률·수요 전망을 다시 계산합니다.",
      "Year 1을 YTD로 전환하면 일할 계산된 소진량을 기준으로 Year 2·3에도 선택한 성장률을 순차 적용합니다.",
      "시장 실적의 출처를 식품의약품안전처 의약품안전나라 공개 데이터로 명시했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260727_16", id: "dashboard_change_20260727_market_ytd_proration_fix",
    changes: [
      "시장 규모 분석의 YTD 예상 소진량이 연간 물량 자체를 경과일 비율만큼 축소하던 계산 오류를 수정했습니다.",
      "YTD에서는 Year 1의 성장률 적용 기간만 현재 날짜 기준으로 일할 계산하고, Year 2·3은 각 연도 1월 1일부터 12월 31일까지의 연간 성장률로 계산합니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_17", id: "dashboard_change_20260728_market_result_width",
    changes: [
      "시장 규모 분석 하단에서 배치 소진 및 금융비용 표의 너비를 줄이고 조정 시나리오 기댓값 표를 넓혀 설명 문구의 가독성을 개선했습니다.",
      "연평균 성장률 선택 버튼을 최대 5개년·최근 3개년으로 통일하고, 실제 포함 연도 수는 성장률 지표에서 동적으로 표시하도록 정리했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_18", id: "dashboard_change_20260728_market_distribution_filter",
    changes: [
      "시장 규모 분석의 공급단가 검색창 위에 유통 구조 설정 건만 보기 필터를 추가했습니다.",
      "유통 구조가 완료 저장된 품목만 기존 카테고리·성분명·제조사 검색 조건과 함께 조회할 수 있습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_19", id: "dashboard_change_20260728_market_forecast_calculation",
    changes: [
      "시장 규모 분석의 예상 소진수량 기준 명칭을 연간 기준·YTD 기준으로 명확하게 정리했습니다.",
      "YTD 환산 기준에서 현재 시점까지 일할 반영한 성장률을 기준값으로 삼고 Year 2·3에도 연간 성장률을 순차 누적하도록 계산식을 수정했습니다.",
      "참약사 예상 판매가는 조정 공급원가가 아닌 유통 구조에서 설정한 참약사 판매가를 기준으로 계산하고, 참약사 판매가 조정률만 별도로 반영하도록 수정했습니다.",
      "조정 공급원가는 전국 예상 공급수량 환산에만 사용하고 배치 자금·금융비용·참약사 마진·기대이익은 실제 기준 공급원가로 계산하도록 분리했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_20", id: "dashboard_change_20260728_market_planning_link",
    changes: [
      "최대 5개년·최근 3개년 성장률과 연간·YTD 기준으로 계산한 Year 1 예상 소진수량을 배치 소진 및 금융비용에 연결했습니다.",
      "선택 기준 변경 시 발주 배치, 소진기간, 재고자금, 금융비용, 기대 매출, 매출총이익과 금융비용 차감 기댓값이 함께 재계산됩니다.",
      "연간 기준은 선택 성장률 1년을, YTD 기준은 현재 시점까지의 성장률을 일할 반영하도록 기준을 정리했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_21", id: "dashboard_change_20260728_market_annual_base_date",
    changes: [
      "시장 규모 분석의 연간 기준에 시작일 입력 기능을 추가했습니다.",
      "입력한 날짜부터 12개월씩 Year 1·2·3 기간을 구성하고, 배치 소진·금융비용·기대 매출과 이익 표에도 동일한 연간 기준일을 표시합니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_22", id: "dashboard_change_20260728_market_manufacturer_cost",
    changes: [
      "제조사 판매가 조정률이 기준 공급원가와 배치 자금·금융비용·마진·매출총이익 계산에 반영되도록 수정했습니다.",
      "시장 환산 평균 공급단가는 전국 예상 공급수량 계산에만 사용하도록 분리하고 관련 화면 및 CSV 명칭을 정리했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_23", id: "dashboard_change_20260728_market_expected_margin_rate",
    changes: [
      "조정 시나리오 기댓값에 참약사 예상 마진율을 추가했습니다.",
      "제조사 판매가 조정률에 따른 제조사 조정 공급원가 변화를 예상 마진율과 CSV 백업에 즉시 반영합니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_24", id: "dashboard_change_20260728_market_scenario_grid",
    changes: [
      "조정 시나리오 기댓값 표를 첫째 줄 4개, 둘째 줄 3개 셀 구성으로 정렬했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_25", id: "dashboard_change_20260728_market_total_finance_cost",
    changes: [
      "배치 소진 및 금융비용 표에 주문 물량 전체 소진기간의 총 금융 기회비용을 추가했습니다.",
      "연간 금융 기회비용은 FY 내 주문 수량 소진 예상기간의 월수를 반영하고, 총 금융 기회비용은 완전 소진일까지 재고가 균등하게 감소한다는 가정으로 계산합니다.",
      "총 금융 기회비용을 CSV 백업에도 반영했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260728_26", id: "dashboard_change_20260728_market_yearly_profit",
    changes: [
      "총 금융 기회비용의 근거를 연간 필요배치와 실제 주문배치로 산출한 연간 소진율로 표시하도록 변경했습니다.",
      "조정 시나리오 기댓값에 Year 1·2·3별 기대 매출, 매출총이익, 연간 금융비용 차감값을 구분해 표시합니다.",
      "최초 주문물량 완전 소진 기준 총 매출총이익과 총 금융비용 차감 기댓값을 추가하고 CSV 백업에도 반영했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260729_27", id: "dashboard_change_20260729_market_annual_date_calc",
    changes: [
      "연간 기준 시작일을 변경하면 최신 시장실적 연도부터 해당 날짜까지의 경과기간을 계산해 예상 소진수량에 성장률을 반영하도록 수정했습니다.",
      "YTD Year 1은 현재 날짜까지 일할 계산하고 Year 2·3은 각 연도의 12개월 전망으로 계산하도록 정리했습니다.",
      "변경된 예상 소진수량을 배치·금융비용과 Year별 기대 손익에도 함께 반영합니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260729_28", id: "dashboard_change_20260729_market_formula_tooltips",
    changes: [
      "시장 규모 분석의 계산 결과 옆에 산식 참조 아이콘을 추가했습니다.",
      "시장 환산·성장률 전망·배치 및 금융비용·Year별 손익·완전 소진 총계의 계산식을 정보 아이콘에 마우스를 올려 확인할 수 있습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260729_29", id: "dashboard_change_20260729_distribution_margin_formula",
    changes: [
      "참약사 마진 입력값을 원가 가산율이 아닌 판매가 기준 목표 마진율로 바로잡았습니다.",
      "참약사 판매가는 최종 유통 원가 ÷ (1 - 목표 마진율)로 역산되며 시장 규모 분석과 CSV에도 동일한 산식을 적용합니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260729_30", id: "dashboard_change_20260729_distribution_adoption_filter",
    changes: [
      "유통 구조 설정 목록에 채택 예상 건만 보기 필터를 추가했습니다.",
      "필터는 카테고리와 성분명·제조사 검색 조건에 함께 적용됩니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260729_31", id: "dashboard_change_20260729_daily_changelog_market_order",
    changes: [
      "대시보드 변경사항을 회차별 목록 대신 날짜별 한 건으로 통합하고 같은 날짜의 중복 기록을 방지했습니다.",
      "시장 분석에서 공급단가 최소 주문 수량과 연간 조달 예상 배치를 분리해 공급단가 입력값과 계산 결과를 명확히 구분했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260729_32", id: "dashboard_change_20260729_distribution_structure_filter",
    changes: [
      "유통 구조 설정 검색 영역에 채택 전체·채택 예상·채택 재고 필터와 구조 전체·설정됨·미설정 필터를 추가했습니다.",
      "채택 상태와 구조 상태를 카테고리·검색어 조건과 함께 조합할 수 있습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260729_33", id: "dashboard_change_20260729_distribution_explicit_complete",
    changes: [
      "유통 구조 입력 중 자동 저장과 설정 완료 상태를 분리했습니다.",
      "미설정 품목은 값을 입력해도 목록에 유지되며 판매가 및 마진 설정의 설정 완료 버튼을 눌렀을 때만 설정됨으로 전환됩니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260729_34", id: "dashboard_change_20260729_market_decision_date_input",
    changes: [
      "시장 규모 분석에서 최종 검토결과를 진행·추가검토·중단으로 선택하고 공급단가와 유통 구조 화면에서 함께 확인할 수 있게 했습니다.",
      "날짜 입력은 연도 4자리와 월 2자리 입력 후 다음 칸으로 자동 이동하도록 개선했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260730_35", id: "dashboard_change_20260730_attachment_removal",
    changes: [
      "공급단가의 첨부파일 업로드·다운로드 기능을 제거했습니다.",
      "기존 첨부파일 데이터는 온라인 DB와 PC 데이터 파일에서 제거되며 오래된 백업을 복원해도 다시 저장되지 않도록 정리했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260730_36", id: "dashboard_change_20260730_production_timeline",
    changes: [
      "제품 개발 하단 타임라인에 제품 생산일정을 추가했습니다.",
      "기존 프로젝트는 앞선 하위 일정 종료 후부터 생산일정을 자동 배치하며 수정 모드에서 기간과 위치를 조정할 수 있습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260730_37", id: "dashboard_change_20260730_schedule_history_group",
    changes: [
      "일정 버전 이력에 변경 건수별 버전 상승 기준을 표시했습니다.",
      "일정 변경 기록을 0.1 단위 버전 구간별 접이식 그룹으로 묶어 긴 이력을 간결하게 확인할 수 있도록 개선했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260730_38", id: "dashboard_change_20260730_contract_management",
    changes: [
      "기본계약·포괄계약을 모계약으로 관리하는 계약 관리 시트를 추가했습니다.",
      "모계약 아래에 개별계약, 부대합의서, 발주서와 품목별 조건합의서를 연결하고 NAS 계약서 경로를 관리할 수 있습니다.",
      "계약 관리 데이터도 서버·PC 저장과 전체·탭별 백업 및 CSV에 포함했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260730_39", id: "dashboard_change_20260730_regulatory_direction_check",
    changes: [
      "OTC·ETC 프로젝트의 허가/생산 방향성을 단일 드롭다운에서 복수 체크 방식으로 변경했습니다.",
      "신규 기안과 프로젝트 기본정보 수정 화면에 동일하게 적용하고 기존 단일 선택 데이터도 자동 호환합니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260803_40", id: "dashboard_change_20260803_supply_cost_breakdown",
    changes: [
      "공급단가의 수량 명칭을 배치 당 포장단위 개수로 명확하게 정리했습니다.",
      "비의약품 견적에 부자재비·가공비·노무비·제조비·일반경비·기업이윤 등을 행별로 기록하는 원가 구성표를 추가했습니다.",
      "특정 원료를 검색해 제조사·원산지·규격·kg당 가격대와 견적일자를 한 표에서 비교할 수 있게 했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260805_41", id: "dashboard_change_20260805_project_promotion",
    changes: [
      "시장 규모 분석과 계약 관리 사이에 프로젝트 추진 탭을 추가했습니다.",
      "공급단가·유통 구조·시장 분석 완료 건을 추진 임박으로 모아 제조사·허가사·예상 출시일과 비용을 확인할 수 있습니다.",
      "추진 임박 자료를 새 제품개발 프로젝트 기안으로 전환하고 원본 공급단가 건과 연결할 수 있습니다.",
      "견적 수집부터 출시·운영까지 전 주기 흐름과 프로젝트 추진 전용 JSON·CSV 백업을 추가했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260813_42", id: "dashboard_change_20260813_review_promotion_workflow",
    changes: [
      "시장 규모 분석 검토결과를 마진 설정 부족·시장 규모 미흡·추가 검토·진행 추진으로 재구성하고 결과별 필터를 추가했습니다.",
      "진행 추진으로 검토된 품목만 프로젝트 추진 대상으로 연결되도록 정리했습니다.",
      "프로젝트 추진에 경영진 보고·내용 보완·진행 보류·중단 최종 진행 상태와 상태별 필터를 추가했습니다.",
      "프로젝트 추진을 품목별 페이지로 개편해 공급단가·유통 구조·시장 규모 분석을 한 화면에서 확인할 수 있게 했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260814_45", id: "dashboard_change_20260814_development_overview",
    changes: [
      "기존 제품개발 프로젝트 화면을 제품일정관리 및 간트차트로 분리해 프로젝트 추진 오른편으로 이동했습니다.",
      "공급 성분·함량 조합별 공급단가·유통 구조·시장 분석·프로젝트 추진·제품 일정의 완료 상태와 전체 진척도를 확인하는 제품개발 현황판을 추가했습니다.",
      "프로젝트 추진 품목을 이미 온보딩된 제품개발 프로젝트와 연결·변경·해제할 수 있도록 개선했습니다.",
      "제품개발 현황을 진행 중 고진척순으로 정렬하고 좌측에서 현재 진행 단계별로 모아볼 수 있는 필터를 추가했습니다.",
      "각 시트의 복합 성분명을 성분·함량 단위로 한 줄 정렬하고 길이에 따라 글자 크기와 말줄임 표시가 자동 조정되도록 통일했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260818_54", id: "dashboard_change_20260818_permit_company_filters",
    changes: [
      "공급단가·유통 구조 설정·시장 규모 분석·프로젝트 추진 시트에 허가사별 조회 및 허가사 미입력 필터를 추가했습니다.",
      "유통 구조 설정의 상세 표 최소 너비와 반응형 분기점을 조정해 일반 화면에서 공급 요약과 판매가 설정이 잘리지 않도록 개선했습니다.",
      "유통 구조 설정에 비교 카테고리를 추가해 여러 제조사의 중복 품목 견적과 예상 판매가를 한 표에서 비교할 수 있도록 했습니다.",
      "같은 비교 카테고리는 경쟁제품 목록을 공동 사용하도록 변경해 경쟁제품을 견적별로 반복 입력하지 않아도 됩니다.",
      "견적 채택 예상·재고 변경 기능을 공급단가 입력 영역에서 유통 구조 설정 화면으로 이동했습니다.",
      "긴 성분·함량 제목이 공급 요약 카드 경계를 넘지 않도록 폭 제한과 말줄임 처리를 강화하고 우측 버튼 영역을 고정했습니다.",
      "견적 비교 카테고리의 적용을 해당 견적에서 즉시 해제할 수 있는 버튼을 추가했습니다.",
      "비교 카테고리 제조사 견적 표에 참약사 예상 마진율을 추가했습니다.",
      "제조사 견적 비교표에서 제조사 또는 허가사를 누르면 해당 견적으로 이동해 바로 수정할 수 있도록 연결했습니다.",
      "견적 비교표에서 공급단가 열을 덜어내고 VAT 단가·최종 유통 원가와 참약사 판매가·마진율을 인접 배치했으며 약국 판매가를 추가했습니다."
    ]
  },
  {
    key: "pharmadev_dashboard_changelog_seed_20260825_55", id: "dashboard_change_20260825_access_account_settings",
    changes: [
      "환경설정에 ADMIN 전용 접속 계정 현황과 웹·PC 계정 추가·수정 도움말을 추가했습니다.",
      "인증코드는 기본 마스킹하고 명시적으로 조회한 경우에도 30초 뒤 자동으로 화면에서 제거되도록 보안을 강화했습니다."
    ]
  }
];

export function dashboardRevisionOrder(value) {
  const parsed = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function appendDashboardChangeSeeds(logs, seeds, { changeDate, createdAt }) {
  const notices = logs.filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE);
  // Daily grouping keeps the original release IDs in sourceIds.
  const registeredIds = new Set(notices.flatMap((log) => [log.id, ...(log.sourceIds || [])]));
  let revision = notices.reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0);
  const additions = [];
  for (const seed of seeds) {
    if (registeredIds.has(seed.id) || (seed.initialOnly && notices.length > 0)) continue;
    additions.push({
      id: seed.id,
      type: DASHBOARD_CHANGE_NOTICE_TYPE,
      projectName: "제품개발 대시보드",
      revision: String(++revision),
      changeDate,
      changes: seed.changes,
      actor: "시스템",
      createdAt
    });
    registeredIds.add(seed.id);
  }
  return additions.length ? [...logs, ...additions] : logs;
}
