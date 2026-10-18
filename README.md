# Agent Hub — 증권사 임직원용 업무·생활 에이전트 플랫폼

증권사 직원이 **에이전트를 실행하고, 직접 만들고, 동료에게 공유**하는 사내 웹서비스입니다.
AI·API·코딩을 몰라도 3분 안에 첫 실행을 끝내는 것이 목표입니다.

- **기본 에이전트 7개** — 업무 5개 + 개인 2개, 전부 실제 데이터 조회·분석·출력이 가능
- **만들기** — 질문 5개에 답하면 실행 가능한 에이전트가 생성 (초보 모드 / 고급 모드)
- **공유 갤러리** — 에이전트뿐 아니라 **단일 HTML 파일, 외부 웹사이트 링크**도 등록·미리보기·공유
- **공유 링크** — 링크 하나로 동료가 열람·실행·복제. 만료 설정과 즉시 공유 중단 지원
- PC·모바일 반응형 · **로그인 없이 바로 사용(게스트 모드)** · 선택적 계정 로그인 · 관리자 화면

> 투자 판단용 서비스가 아니며, 모든 결과는 업무 보조용으로 담당자 검토가 필요합니다.

---

## 1. 빠른 시작 (Windows 노트북)

```powershell
# 1) 저장소 폴더에서
copy .env.example .env     # 키는 나중에 채워도 됩니다

# 2) 전부 자동으로 (설치→마이그레이션→시드→빌드→실행)
.\scripts\start-windows.ps1

# 개발 모드로 띄우려면
.\scripts\start-windows.ps1 -Dev
```

수동으로 하려면:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

개발 실행:

```bash
npm run dev -- --hostname 0.0.0.0
```

- 이 노트북: **http://localhost:3000**
- 같은 네트워크의 동료 PC·모바일: **http://노트북의_사설IP:3000**
  (IP 확인: `ipconfig` → IPv4 주소)

### 접속과 계정

기본은 **오픈 모드** — 로그인 없이 누구나 열람·실행·만들기·공유가 가능합니다(공용
게스트 신원으로 동작). 계정은 선택: `/setup`에서 관리자 계정을 만들면 관리자
화면을 쓸 수 있고, 직원은 로그인 화면에서 직접 가입해 자기 이름으로 콘텐츠를
관리할 수 있습니다. 로그인한 계정이 만든 콘텐츠는 그 소유자(와 관리자)만
수정·삭제할 수 있습니다. 전 기능 로그인 강제로 되돌리려면 `.env`에서
`REQUIRE_LOGIN="1"`.

### 동료가 접속이 안 될 때

1. **Windows 방화벽** — 인바운드 규칙에서 TCP 3000 허용
   (관리자 PowerShell): `New-NetFirewallRule -DisplayName "Agent Hub" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow`
2. **사내 네트워크 정책** — 무선 AP 격리(클라이언트 간 통신 차단)가 켜져 있으면 같은 Wi‑Fi여도 접속이 안 됩니다. 네트워크 관리자에게 확인하세요.
3. **노트북 절전** — 노트북이 꺼지거나 절전 상태면 서비스도 중단됩니다. 전원 옵션에서 절전을 꺼두세요.
4. **외부 인터넷에서 접속**하려면 회사 승인 HTTPS 경로, VPN 또는 승인된 배포 인프라가 필요합니다. 보안 우회 목적의 비인가 터널은 사용하지 마세요.

---

## 2. 기본 에이전트 7개

### 업무 (5)

| 에이전트 | 데이터 | 필요한 키 |
|---|---|---|
| 시장 뉴스 브리핑 | 네이버 뉴스 검색 API | NAVER (요약에 Claude) |
| ETF 비교 분석 | 사용자 업로드 CSV | 없음 (설명에 Claude) |
| 해외 리서치·어닝콜 번역 요약 | 영문 본문·공개 URL | Claude |
| 환율·금리 모니터링 | FRED (DEXKOUS·DGS2·DGS10, **관측일 기준**) | FRED (해설에 Claude) |
| 주변 법인·기업 잠재고객 탐색 | 카카오 로컬 + OpenDART + 공공 기업명단 CSV | KAKAO (+DART) |

### 개인 (2)

| 에이전트 | 데이터 | 필요한 키 |
|---|---|---|
| 야장맵 · 야외 식당 탐색 | 카카오 로컬 | KAKAO |
| 웨딩홀 정보 모음 | 카카오 로컬 | KAKAO |

**정직한 데이터 원칙**: 키가 없으면 "설정 필요"를 표시하고, 예시 결과에는 항상
**샘플 데이터** 배지가 붙습니다. 샘플을 실데이터처럼 보여주지 않으며, 검색되지 않는
장소·가격·기업정보를 만들어내지 않습니다. 수치 계산(환율 변화·금리 스프레드·거리·동선)은
코드가 수행하고, AI는 확보된 결과의 해석만 담당합니다.

---

## 3. API 키 발급 가이드

설정(→ `/settings`)에서 각 연동의 **발급 안내·연결 테스트**를 제공합니다.
키는 서버 `.env`(운영자) 또는 **각자 브라우저**(BYOK)에 둘 수 있고, 개인 키가 우선합니다.
개인 키는 서버 DB·로그에 저장되지 않습니다.

| 연동 | 비용 | 발급 |
|---|---|---|
| 네이버 뉴스 검색 | 무료 | https://developers.naver.com/apps/#/register → 앱 등록 → 검색 API 추가 → Client ID/Secret |
| 카카오 로컬 | 무료 | https://developers.kakao.com/console/app → 앱 추가 → **REST API 키** |
| OpenDART | 무료 | https://opendart.fss.or.kr/ → 가입 → 인증키 신청 |
| FRED | 무료 | https://fredaccount.stlouisfed.org/apikeys |
| Claude API | 유료 | https://console.anthropic.com/settings/keys |

---

## 4. 공유하기

| 콘텐츠 | 등록 | 열람 |
|---|---|---|
| 에이전트 | 만들기에서 저장 | 설명 확인 → 입력 변경 → 실제 실행 → 내 계정으로 복제 |
| 단일 HTML | 공유 갤러리 → HTML 업로드 (≤2MB) | **격리 샌드박스** 미리보기 (기본 스크립트 차단) |
| 웹사이트 | 공유 갤러리 → 웹사이트 등록 | 임베드 허용 시 미리보기, 아니면 새 탭 열기 |

- 공유 범위: **사내 전체 공개 / 링크를 받은 사람만 / 나만 보기**
- 공유 링크(`/s/토큰`)는 만료일 설정·즉시 중단 가능. 접근 검증은 **매 요청 서버에서** 수행
- 업로드 HTML은 서버에서 실행되지 않고, `sandbox` CSP(불투명 출처·네트워크 차단·same-origin 금지)로만 서빙됩니다. 스크립트 허용 옵션을 켜도 부모 앱의 쿠키·세션·스토리지에 접근할 수 없습니다.
- 웹사이트 URL은 SSRF 게이트(스킴·포트·자격증명·사설망 DNS 검사)를 통과해야 등록됩니다.

---

## 5. 스크립트

```bash
npm run dev          # 개발 서버
npm run dev:lan      # 개발 서버 (사내망 공개)
npm run build        # 프로덕션 빌드
npm run start:lan    # 프로덕션 서버 (0.0.0.0:3000)
npm run lint         # ESLint
npm run typecheck    # next typegen + tsc
npm test             # Vitest (단위·통합, 외부 API 전부 mock)
npm run test:e2e     # Playwright (실제 브라우저, 키 없이 샘플 경로)
npm run db:migrate   # 마이그레이션 (개발)
npm run db:seed      # 기본 에이전트 7개 설치
```

## 6. 기술 스택 / 구조

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Prisma 7 + SQLite ·
Leaflet(OSM 지도, 키 불필요) · Anthropic SDK · Zod · Vitest · Playwright

```
src/
  app/              라우트 (api/*는 전부 Node 런타임)
    s/[token]/      공유 링크 공개 뷰어 (토큰 = 자격증명)
    gallery/        공유 갤러리 (+HTML·웹사이트 뷰어)
    my/             내 에이전트·공유 관리
    admin/          관리자 대시보드
  lib/
    agents/         registry + *.agent.ts  ← 에이전트 추가 지점
    integrations/   naver-news · kakao-local · opendart · fred · anthropic
    auth/           로컬 계정·세션 (SSO로 교체 가능하도록 분리)
    share/          공유 링크·가시성 규칙·HTML 샌드박스 헤더
    security/       url-safety(SSRF) · rate-limit · redaction
storage/cache/      DART 기업 고유번호 캐시 (주 1회 갱신)
```

## 7. 보안 요약

- 기본 오픈 모드: 로그인 없이 게스트로 사용, `REQUIRE_LOGIN=1`이면 전 기능 로그인 필수. 관리자 화면과 실제 계정 소유 콘텐츠의 수정·삭제는 항상 로그인 필요
- API 키는 서버 환경변수 보관, 상태 화면은 **boolean만** 반환 (값·길이·마스킹 금지)
- BYOK 키는 요청 수명 동안만 메모리에 존재, DB·로그·응답에 남지 않음
- 실행 원문·생성 결과는 서버에 저장하지 않음 (실행 기록은 메타데이터만)
- 업로드 검증(확장자·크기·바이너리 스니핑) + HTML 샌드박스 격리
- SSRF·사설망 차단, 요청 속도 제한, 감사 로그(비밀값·원문 미기록)
- 소유권 검사: 남의 에이전트·HTML·웹사이트는 수정·삭제 불가 (서버 강제)

## 8. 알려진 제약

- 노트북 서버는 노트북이 켜져 있는 동안만 동작합니다.
- FRED 데이터는 **관측일 기준**이며 실시간 시세가 아닙니다 (1영업일 이상 지연 가능).
- 네이버 뉴스 검색은 발행일 필터가 없어 조회 후 기간 필터링하며, 국내 매체 중심입니다.
- 카카오 장소 검색 결과만으로는 야외 좌석 운영·법인 여부가 확인되지 않습니다. 화면에 해당 주의 문구를 항상 표시합니다.
- 실연동 검증은 각 API 키를 등록한 뒤 설정 화면의 "연결 테스트"로 수행하세요. 자동 테스트는 모의 응답 기반 회귀 테스트입니다.
