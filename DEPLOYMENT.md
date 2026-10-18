# 배포 가이드

이 서비스의 기본 운영 형태는 **개인 노트북 단일 서버**입니다. 실행·접속 방법,
방화벽, 사내망 안내는 [README.md](./README.md)의 "빠른 시작"을 따르세요.

```powershell
.\scripts\start-windows.ps1     # 설치 → 마이그레이션 → 시드 → 빌드 → 0.0.0.0:3000 실행
```

- DB(`dev.db`)와 업로드 콘텐츠(HtmlAsset은 DB에 저장), DART 기업 고유번호 캐시
  (`storage/cache/`)는 프로젝트 폴더에 영속되므로 재시작해도 유지됩니다.
- 노트북이 꺼지거나 절전 상태면 서비스도 중단됩니다.

## 외부 공개 시 주의

외부 인터넷에서 접근하게 하려면 **회사 승인 HTTPS 경로, VPN 또는 승인된 배포
인프라**를 사용하세요. 보안 우회 목적의 비인가 터널·임의 외부 공개를 설정하지
않습니다. HTTPS 뒤에서 운영한다면 `.env`에 `FORCE_SECURE_COOKIES="1"`을 켜고,
`CRON_SECRET`을 설정해 브리핑 잡 엔드포인트를 보호하세요. 익명 사용자는 어떤
관리자·편집 기능에도 접근할 수 없습니다(전 라우트 서버 검증).

## 서버리스(예: Vercel)로 옮길 때

SQLite는 파일 쓰기가 막힌 서버리스 환경에서 동작하지 않으므로 **Postgres 전환**이
필요합니다. 요지:

1. Neon/Supabase 등에서 Postgres를 만들고 connection string을 확보합니다.
2. `npm i @prisma/adapter-pg pg` 후 `src/lib/db/client.ts`와 `prisma.config.ts`의
   어댑터를 `PrismaBetterSqlite3` → `PrismaPg`로 교체하고,
   `prisma/schema.prisma`의 `provider`를 `postgresql`로 바꿉니다.
3. `DATABASE_URL`을 Postgres 주소로 바꾸고 `npx prisma migrate deploy` + `npm run db:seed`.
4. DART 기업 고유번호 캐시는 파일 대신 메모리 캐시로만 동작하게 되며(재시작 시
   재다운로드), 필요하면 DB 테이블로 옮기세요.

사내 정식 배포 시에는 로컬 계정 인증을 회사 SSO로 교체하는 것을 권장합니다 —
인증 로직은 `src/lib/auth/*`에 격리되어 있습니다.
