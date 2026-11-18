# Google Drive 백업 설정 가이드

이 프로젝트는 기본 저장소로 Postgres(예: Neon)를 사용하고, 추가 백업 저장소로 Google Drive를 지원합니다.

## 1) Google Cloud 준비

1. Google Cloud 프로젝트 생성
2. `Google Drive API` 활성화
3. 서비스 계정 생성
4. 서비스 계정 키(JSON) 발급

## 2) Drive 폴더 준비

1. Google Drive에서 백업 전용 폴더 생성
2. 위 서비스 계정 이메일(`...@...iam.gserviceaccount.com`)을 해당 폴더에 `편집자` 권한으로 공유
3. 폴더 URL에서 폴더 ID 복사

예시:
`https://drive.google.com/drive/folders/<FOLDER_ID>`

## 3) Vercel 환경변수 설정

아래 값 중 한 가지 방식으로 서비스 계정 정보를 넣으면 됩니다.

### 권장 방식 A: JSON 통째로 1개 변수

- `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`
  - 서비스 계정 JSON 파일 전체 내용을 문자열로 입력

### 방식 B: 분리 변수

- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`
  - 줄바꿈은 `\n` 형태로 넣어도 됩니다.

### 공통 변수

- `GOOGLE_DRIVE_BACKUP_FOLDER_ID` (권장)
  - 백업 파일 저장 폴더 ID
- `GOOGLE_DRIVE_BACKUP_FILE_PREFIX` (선택)
  - 기본값: `PharmaDev_PMS_Backup`
- `GOOGLE_DRIVE_SHARED_DRIVE_ID` (선택)
  - Shared Drive 사용 시만 설정

## 4) 배포 반영

1. 환경변수 저장
2. 재배포(Redeploy)

## 5) 앱에서 동작 확인

관리자 세션에서 `POST /api/backup/google-drive`에 JSON `{ "action": "upload" }`를 보내면 서버의 전체 데이터가 백업됩니다.
`GET /api/backup/google-drive`로 목록을 조회하고 `action=download`와 `fileId`로 다운로드할 수 있습니다.

## 권한 동작

- `ADMIN`: Drive 백업 생성·조회·다운로드 및 전체 백업 복원 가능

기존 일부 Drive 파일은 프로젝트와 관리자 이력만 담고 있어 전체 복원에 사용할 수 없습니다.
