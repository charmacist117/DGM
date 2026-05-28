# PharmaDev PMS (Vercel Persistent Edition)

이 프로젝트는 기존 단일 HTML 기반 PMS를 운영형 구조로 전환한 버전입니다.

## 변경 포인트

- `localStorage only` 저장에서 `서버 DB + 로컬 캐시` 이중 저장으로 변경
- Vercel 배포 시 `새로고침/브라우저 재실행/다른 관리자 접속`에서도 데이터 유지
- 프로젝트별 `업체 소통 기록` 및 `대표/부대표 의사결정 기록` 관리
- `JSON 전체 백업`, `JSON 복원`, `CSV 내보내기` 제공
- 유지보수를 위해 화면/일정엔진/저장소를 모듈 분리

## 기술 구조

- Frontend: Next.js App Router (`app/`, `components/`)
- API: `app/api/projects/route.js`
- Database: PostgreSQL (`lib/server/db.js`, `lib/server/projectStore.js`)
- Backup: JSON/CSV export-import (`lib/pms/exporters.js`)

## 로컬 실행

```bash
npm install
npm run dev
```

## 필수 환경변수

`.env.local` 파일에 아래 중 하나 방식으로 설정

### 방식 A) 단일 URL

```bash
DATABASE_URL=postgres://...
POSTGRES_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...
POSTGRES_PRISMA_URL=postgres://...
```

### 방식 B) 개별 PG 변수

```bash
PGHOST=
PGPORT=
PGUSER=
PGPASSWORD=
PGDATABASE=
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DATABASE=
```

## Vercel 배포 가이드

1. Vercel 프로젝트에 Git 연결
2. Vercel Marketplace에서 Postgres(예: Neon) 연동
3. 환경변수(`DATABASE_URL` 또는 `PG*`)가 주입됐는지 확인
4. 배포

첫 실행 시 `pms_state` 테이블이 자동 생성되고 초기 프로젝트가 시드됩니다.

## 운영 참고

- 서버 저장 실패 시에도 로컬 캐시에 임시 저장됩니다.
- 동기화 상태는 화면 우상단 배지에서 확인할 수 있습니다.
- 장기 보관이 필요하면 정기적으로 `전체 JSON 백업` 파일을 외부 저장소에 보관하세요.
- `서버 저장 실패: 로컬 캐시에만 저장됨`이 보이면 Vercel 환경변수 적용 범위(Production/Preview)와 재배포 여부를 먼저 확인하세요.

## 최근 UI 변경사항

- `제품 개발` 하위 부수 일정(제품명 선정/포장 단위 선정/관능도 테스트/패키지 디자인)을 **태스크 관리 표의 제품 개발 라인 바로 아래**에서 직접 편집하도록 통합
- 프로젝트 `담당자`, `카테고리`를 상시 수정 가능하도록 추가
- 담당자/카테고리 저장 시 변경 이력(`changeLog`) 자동 기록
- 기본 샘플 프로젝트(김개발/이기획/박출시) 제거
- 프로젝트 삭제 기능 추가(삭제 시 확인창 표시)
