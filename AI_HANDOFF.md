# DGM AI 작업 인수인계서

최종 갱신: 2026-08-05  
웹 기준 커밋: `d80fd5f` (`Expand non-drug supply quote analysis`)  
운영 브랜치: `main`

## 1. 시스템 목적

DGM은 PB 제품 기획·개발 담당자가 아래 업무를 하나의 의사결정 시스템에서 관리하는 도구다.

- 제품개발 프로젝트와 태스크 일정 관리
- 제조사 공급단가 견적 축적·검색·비교
- 유통 구조, 판매가, 마진, 경쟁제품 분석
- 시장 규모, 성장률, 배치 소진, 금융비용 시뮬레이션
- 모계약과 하위 계약·문서 관리
- 전체 및 탭별 JSON 백업·복원, CSV 보조 백업

사용자는 한국어 UI와 실제 업무용 숫자·산식의 정확성을 특히 중요하게 본다. 기능을 추가할 때 기존 데이터를 깨지 않도록 정규화 기본값과 구버전 백업 호환성을 유지해야 한다.

## 2. 반드시 함께 관리할 두 소스

### 웹 버전

```text
C:\Users\charmacist\Documents\AI Coding Agents\Github\DGM
```

- Git 저장소: `https://github.com/charmacist117/DGM.git`
- 배포: Vercel
- 데이터: Neon/PostgreSQL
- 인증: 서버 환경변수 기반 ADMIN/MANAGER 로그인

### PC 버전

```text
C:\Users\charmacist\Documents\AI Coding Agents\Github\DGM-Desktop
```

- Git 저장소가 아니다.
- 웹과 공통인 화면·업무 로직 파일은 항상 동일하게 동기화한다.
- 데이터: 로컬 JSON 파일 저장
- 로컬 프로그램은 인증 화면 없이 `127.0.0.1`의 임의 포트에서만 실행된다.

### 동시 반영 원칙

사용자가 별도로 제한하지 않는 한 모든 화면·업무 기능 변경은 `DGM`과 `DGM-Desktop`에 동시에 반영한다. 공통 파일을 수정한 뒤 SHA256 또는 `Compare-Object`로 양쪽 파일이 같은지 확인한다.

주로 동기화되는 경로:

```text
app/
components/
lib/pms/
```

서버 저장소와 데스크톱 저장소는 구현이 다르므로 아래 파일은 무조건 덮어쓰지 말고 각각의 구조를 확인한다.

```text
DGM/lib/server/db.js
DGM/lib/server/projectStore.js
DGM-Desktop/lib/server/localProjectStore.js
DGM-Desktop/lib/server/projectRepository.js
DGM-Desktop/desktop/main.cjs
```

## 3. PC 실행 정책

고정 실행파일:

```text
C:\Users\charmacist\Documents\AI Coding Agents\Github\PB-Product-Development-Portable.exe
```

- 일반 UI·업무 로직 업데이트 때 실행파일을 다시 만들지 않는다.
- 위 실행파일은 설정된 `DGM-Desktop` 소스 폴더를 직접 읽는다.
- 코드 반영 후 프로그램을 완전히 종료하고 기존 바탕화면 바로가기로 다시 실행하면 최신 코드가 적용된다.
- `desktop/main.cjs`나 실행기 자체 동작·아이콘이 바뀔 때만 portable 실행파일을 재생성하고 같은 파일명으로 교체한다.
- 실행기 설정: `%LOCALAPPDATA%\PB-Product-Development-Launcher\launcher-config.json`
- 실행 로그: `%LOCALAPPDATA%\PB-Product-Development-Launcher\launcher.log`
- 운영 데이터: `%APPDATA%\pharmadev-pms-desktop\data\pms-data.json`
- 직전 백업: `%APPDATA%\pharmadev-pms-desktop\data\pms-data.backup.json`

`DGM-Desktop/data/pms-data.json`은 개발 참고 파일일 뿐 실제 설치 사용자 운영 데이터 경로와 혼동하지 않는다.

## 4. 기술 구성

- Next.js App Router 15.5.21
- React 19
- 웹 DB 드라이버: `pg`
- PC 셸: Electron 43
- 패키지 관리자: pnpm
- 주요 화면 통합 컴포넌트: `components/PmsApp.jsx`

주요 컴포넌트:

```text
components/PmsApp.jsx                    전체 앱, 제품개발, 공급단가, 홈, 데이터 이전
components/DistributionStructureTab.jsx 유통 구조 설정
components/MarketSizeAnalysisTab.jsx     시장 규모 분석
components/ContractManagementTab.jsx     계약 관리
```

주요 업무 모듈:

```text
lib/pms/defaults.js              프로젝트·태스크 기본값과 정규화
lib/pms/schedule.js              일정·버전 계산
lib/pms/marketAnalysis.js        판매가·마진·시장 분석 산식
lib/pms/marketDecision.js        진행/추가검토/중단 상태
lib/pms/contracts.js             계약 레코드 정규화
lib/pms/supplyCostBreakdown.js   비의약품 견적 원가 구성 계산
lib/pms/fullBackup.js            전체 JSON 백업 스키마
lib/pms/moduleBackup.js          탭별 JSON 백업 스키마
lib/pms/moduleCsv.js             탭별 CSV 보조 백업
lib/pms/exporters.js             제품개발 CSV 및 레거시 백업 처리
```

## 5. 최상단 탭 구조

현재 순서:

1. 홈
2. 제품개발
3. 공급단가
4. 유통 구조 설정
5. 시장 규모 분석
6. 프로젝트 추진
7. 계약 관리
8. 데이터 이전

홈에는 하루 단위로 묶은 제품개발 대시보드 변경사항을 표시한다. 자잘한 수정마다 새 회차를 만들지 말고 같은 날짜 변경은 한 항목에 정리한다.

## 6. 현재 구현된 핵심 기능

### 제품개발

- 진행·보류·완료 프로젝트 구분과 드래그앤드롭
- 프로젝트 기안, OTC/ETC 방향성 복수 체크, 독점/비독점
- 태스크 보기/수정 모드 분리, 상태 드롭다운, 태스크 순서 드래그앤드롭
- 일정 변경 완료 시 버전 기록 및 0.1 단위 그룹화
- 제품개발 하단 타임라인에 제품 생산일정 포함
- 제품개발 전체 단위 백업·복원과 CSV

### 공급단가

- 카테고리: OTC, 건강기능식품, 일반식품, 의약외품, 기타
- 제조사, 허가사(OTC 수수료 해당 시 활성화), 다중 성분/함량
- 포장단위, 포장형태, `배치 당 포장단위 개수`, 최소 주문 배치 수량
- 배치 당 공급단가, VAT, VAT 포함 가격, 허가사 수수료율 또는 알 수 없음
- 견적일자, 사용기한, 비고, 채택 예상/채택 재고, 최종 검토결과
- 날짜·카테고리·성분 검색, 최근 3개월/6개월/전체 필터
- 오래된 견적 경고, 오래된 순 정렬, 빈 견적 최상단 정렬
- 기존 견적 복사 후 포장단위 등만 수정 가능
- CSV 다운로드
- 삭제는 ADMIN만 가능
- 첨부파일 기능과 기존 첨부파일 DB 데이터는 제거된 상태

비의약품 추가 기능:

- 원료별 원산지, 브랜드/공급사, kg 가격대 비교
- `특정 원료로 검색` 모드
- 견적 원가 구성(VAT 별도): 원재료비, 부자재비, 부재료비, 가공비, 노무비, 제조비, 일반경비, 기업이윤, 기타
- 원가 구성 행별 배치 금액, 포장단위당 계산값, 비고
- `별도청구` 같은 텍스트 금액은 보존하고 숫자 합계에서 제외

### 유통 구조 설정

- 공급단가 건과 1:1 연결, 양방향 바로가기
- 공급단가·VAT·허가사 수수료를 반영한 최종 유통 원가
- 참약사 목표 마진율은 `마진금액 / 참약사 판매가`의 비율이다.
- 참약사 판매가는 `최종 유통 원가 / (1 - 목표 마진율)`로 역산한다. 공급가에 단순히 `1 + 마진율`을 곱하면 안 된다.
- 참약사 판매가와 약국 판매가는 VAT 포함 기준
- 물량별 여러 가격대 시나리오 탭
- 경쟁제품: 기준일, 제품명, 판매처, 포장단위, 구간별 판매단가, 비고
- 경쟁제품은 수정/완료 모드로 일괄 편집
- 채택 전체/예상/재고 및 구조 전체/설정됨/미설정 필터
- 입력만 했다고 설정 완료가 되지 않으며 사용자가 `설정 완료`를 눌러야 한다.
- 유통 구조 설정 초기화 가능

### 시장 규모 분석

- 공급단가·유통 구조 건과 연결
- 최근 최대 5개년 생산·수입 실적 직접 입력
- 생산실적은 천원 단위, 수입실적은 USD와 환율로 원화 환산
- 연도별 성장률 포함 체크, 최대 5개년/최근 3개년 CAGR 전환
- 전국 약국 수, 참약사 약국 수, 침투율
- 시장 환산 평균 공급단가는 전국 예상 공급수량 계산용일 뿐 참약사 마진 원가를 바꾸지 않는다.
- 제조사 판매가 조정률은 기준 공급원가를 조정한다.
- 참약사 판매가 조정률은 유통 구조의 참약사 판매가를 조정한다.
- 연간/YTD, 연간 기준 시작일, Year 1~3 예상 소진량
- 배치 소진 기간, 연간 및 총 금융 기회비용
- Year 1~3 매출총이익과 금융비용 차감 기댓값
- 주요 계산값 옆 산식 툴팁
- 진행/추가검토/중단 최종 판단을 공급단가·유통 구조에도 표시

중요한 YTD 규칙:

- Year 1만 현재 시점까지의 경과기간을 반영한다.
- Year 2와 Year 3은 각각 1월 1일~12월 31일의 완전한 연도다.
- 연간 기준 시작일을 바꾸면 Year 1 기간과 예상 소진량, 배치·금융비용·기대이익이 연쇄적으로 바뀌어야 한다.

### 계약 관리

- 기본계약·포괄계약은 모계약
- 제품 공급계약, 부대합의서, 발주서 등은 하위 계약·문서
- NAS 계약서 경로 저장
- 모계약은 왼쪽 어두운 사이드바에서 별도 검색
- 모계약 선택 시 연결된 하위 계약만 표시
- `전체 계약 보기`로 전체 범위 복귀
- 각 계약 카드에서 모계약인지, 어느 모계약의 하위 문서인지 표시
- 계약 검토자/결재자 필드는 없음

### 프로젝트 추진

- 공급단가 핵심값, 유통 구조 설정 완료, 시장 규모 분석 저장이 모두 충족된 건을 `추진 임박`으로 자동 분류
- 제조사와 허가사를 함께 표시하고 성분명·제조사·허가사 검색 지원
- 예상 출시일, 추가 예상비용, 비용 메모 저장
- 최소 주문 배치 기준 생산비와 총 예상비용 자동 계산
- 추진 임박 건을 새 제품개발 프로젝트 기안으로 전환
- 성분·제조사·허가사·포장·물량·출시일·비용 근거를 기안 화면에 미리 입력하고 원본 공급단가 ID와 생성 프로젝트 ID를 상호 연결
- `견적 수집 → 유통 설계 → 시장 검증 → 추진 결정 → 제품개발 → 계약·생산 → 출시·운영` 전 주기 흐름 표시
- 프로젝트 추진 전용 JSON 백업·복원과 CSV 지원

### 데이터 이전

- 전체 JSON: 프로젝트, 이력, 공급단가, 유통 구조, 시장 분석, 계약, 시장 분석 기본값
- 탭별 JSON: 제품개발, 공급단가, 유통 구조, 시장 규모 분석, 계약 관리
- 탭별 CSV 보조 백업 지원
- 유통 구조와 시장 분석은 공급단가 ID에 연결되므로 복원 순서는 공급단가가 먼저다.
- 백업 스키마를 변경할 때 레거시 입력을 정규화해 기존 백업이 계속 복원되도록 한다.

## 7. 데이터 저장과 인증

### 웹

필수 Vercel 환경변수:

```text
AUTH_SECRET=<충분히 긴 무작위 값>
APP_ADMIN_PASSWORD=<관리자 인증코드>
APP_USER_PASSWORD=<매니저 인증코드>
DATABASE_URL=<Neon PostgreSQL 연결 문자열>
PGSSL_REJECT_UNAUTHORIZED=true
```

- 로그인 실패 제한, HMAC 세션, HttpOnly 쿠키, CSRF 성격의 동일 출처 확인이 적용되어 있다.
- 실제 암호·DB URL·백업 파일은 절대 Git에 커밋하지 않는다.
- 웹에서 `서버 인증 설정을 확인해주세요`가 나오면 Vercel Production 환경변수와 재배포 여부를 먼저 확인한다.

### PC

- 외부 네트워크에 노출하지 않고 `127.0.0.1`만 사용한다.
- `APP_ADMIN_PASSWORD`와 `APP_USER_PASSWORD`는 비워 로컬 인증을 생략한다.
- Host 헤더 제한, 외부 이동 차단, Electron sandbox가 적용되어 있다.

## 8. 작업 절차

1. 시작 전에 `DGM`에서 `git status --short`와 최근 커밋을 확인한다.
2. 관련 컴포넌트와 정규화·백업 모듈을 함께 읽는다.
3. 수정 전 사용자에게 짧은 진행 상황을 알린다.
4. 수동 편집은 `apply_patch`를 사용한다.
5. 웹 소스를 먼저 수정하고 관련 공통 파일을 PC 소스에 동기화한다.
6. 기존 사용자 데이터가 없는 필드도 안전하게 열리도록 정규화 기본값을 추가한다.
7. JSON 전체·탭별 백업과 CSV에 새 필드가 필요한지 반드시 확인한다.
8. 양쪽 production build를 실행한다.
9. 계산 로직은 작은 독립 입력값으로 산식을 검증한다.
10. UI 변경은 가능하면 브라우저에서 실제 저장·검색·복원까지 smoke test한다.
11. 웹 저장소만 커밋하고 `main`에 push한다.
12. Vercel 배포 성공을 확인한다.
13. PC 프로그램은 실행파일을 재생성하지 않고 완전히 종료 후 기존 바로가기로 재실행하도록 안내한다.

검증 명령 예시:

```powershell
cd "C:\Users\charmacist\Documents\AI Coding Agents\Github\DGM"
pnpm run build

cd "C:\Users\charmacist\Documents\AI Coding Agents\Github\DGM-Desktop"
pnpm run build
```

웹 반영 예시:

```powershell
cd "C:\Users\charmacist\Documents\AI Coding Agents\Github\DGM"
git status --short
git add <변경 파일>
git commit -m "명확한 변경 요약"
git push origin main
```

## 9. 최근 완료 작업

최근 웹 커밋:

```text
d80fd5f Expand non-drug supply quote analysis
b0aac6b Improve parent and child contract navigation
3fce126 Add contract management and improve project planning
a488035 Remove supply attachments and purge stored data
f84c25d Add market decisions and segmented date inputs
```

`d80fd5f`에서 완료한 내용:

- 공급단가 수량 명칭을 `배치 당 포장단위 개수`로 통일
- 비의약품 견적 원가 구성 입력·합계·포장단위당 계산
- 특정 원료 검색 및 제조사·원산지·브랜드·함량·kg 가격 비교
- 전체/탭별 CSV 반영
- 웹과 PC 공통 파일 동기화 및 양쪽 production build 확인

## 10. 다음 AI가 특히 조심할 점

- 사용자가 만든 기존 변경이나 운영 데이터를 되돌리지 않는다.
- `DGM-Desktop`을 Git 저장소라고 가정하지 않는다.
- 일반 기능 수정 때 portable 실행파일을 새로 만들지 않는다.
- 공급단가 ID는 유통 구조·시장 분석·계약 연결의 기준이므로 복사 시 새 ID를 만들고 연결 데이터는 초기화한다.
- 숫자 입력은 빈 문자열과 0을 구분한다. 미입력값을 임의로 0으로 저장하면 UI와 산식이 왜곡된다.
- 원화 반올림, VAT 1.1, 허가사 수수료, 목표 마진율 산식의 적용 순서를 화면 설명과 CSV에서 동일하게 유지한다.
- `알 수 없음` 허가사 수수료는 공급단가에 이미 수수료가 포함된 것으로 처리한다.
- 시장 환산 평균 공급단가는 전국 물량 추정 전용이다. 유통 구조의 기준 원가나 참약사 마진을 대체하지 않는다.
- 날짜와 YTD 계산은 한국 시간과 실제 기간 일수를 사용하고, Year 2·3을 현재 날짜 비율로 축소하지 않는다.
- UI는 중첩 카드, 과도한 장식, 좌우 스크롤을 피하고 업무용 표의 가독성을 우선한다.
- 변경사항 공지는 날짜별 한 건으로 묶는다.

## 11. 완료 보고 기준

완료라고 보고하기 전에 아래를 모두 확인한다.

- 웹 build 성공
- PC build 성공
- 양쪽 공통 변경 파일 내용 일치
- 저장·재로딩 후 새 데이터 유지
- 기존 데이터 정규화 오류 없음
- 전체 및 관련 탭 백업·CSV 반영
- 웹 Git 커밋·push 완료
- Vercel 배포 성공
- `git status --short`에 의도하지 않은 파일 없음
