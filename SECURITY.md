# Security

## 운영 필수 설정

- `AUTH_SECRET`은 32바이트 이상이어야 하며 48바이트 이상의 무작위 값을 권장합니다.
- `APP_ADMIN_PASSWORD`와 `APP_USER_PASSWORD`는 서로 다르고 충분히 긴 값으로 설정합니다.
- 실제 비밀값과 데이터 백업 파일은 Git에 커밋하지 않습니다.
- PostgreSQL TLS 인증서 검증은 기본 활성화 상태를 유지합니다.
- Vercel Production과 Preview 환경변수를 분리하고, Preview에는 운영 DB 비밀값을 넣지 않습니다.

## 적용된 방어

- HMAC 서명 세션, 역할·발급시각·만료시각 검증, HttpOnly 쿠키
- 로그인 실패 횟수 제한 및 일시 차단
- 변경 요청의 동일 출처 확인
- JSON 요청 및 첨부파일 용량 제한
- 첨부파일 확장자·MIME·Data URL 검증
- 관리자 전용 전체 백업 및 Google Drive 백업
- CSP, 클릭재킹 방지, MIME 스니핑 방지, HSTS 등 기본 보안 헤더
- API 내부 오류 상세정보 비공개

## 운영 점검

정기적으로 아래 명령을 실행하고 High 이상 취약점은 배포 전에 해결합니다.

```bash
pnpm audit --prod
pnpm build
```

인증 비밀값 노출이 의심되면 `AUTH_SECRET`과 로그인 비밀번호를 모두 교체합니다. `AUTH_SECRET` 교체 시 기존 로그인 세션은 즉시 무효화됩니다.
