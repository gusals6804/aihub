# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(및 다른 AI 에이전트)를 위한 지침입니다.

## 서비스 목적

증권사 임직원이 **에이전트를 실행하고, 만들고, 동료와 공유**하는 사내 플랫폼(Agent Hub).
기본 에이전트는 정확히 7개: 업무 5(뉴스·ETF·번역요약·환율금리·잠재고객 탐색) + 개인 2(야장맵·웨딩홀).
처음 방문한 직원이 설명 없이 3분 안에 첫 실행을 끝내는 것이 성공 기준입니다.

## 절대 어기면 안 되는 제약

1. **API 키를 클라이언트에 노출하지 않는다.** 키를 읽는 모듈은 반드시 `import "server-only"`로 시작합니다. 외부 API 호출은 Route Handler에서만. 연동 상태 화면은 boolean만 반환(값·길이·마스킹 전부 금지).
   - **BYOK**: 사용자가 자기 키를 헤더로 보내는 건 허용(`src/lib/request-context.ts`). 그 키는 요청 수명 동안만 `AsyncLocalStorage`에 있고 **DB·로그·응답 어디에도 남기지 않습니다.**
2. **샘플을 실데이터로 표시하지 않는다.** 샘플 결과는 항상 `dataStatus: "sample"` + "예시 데이터" 경고 문구. 데이터 키가 없으면 샘플로 조용히 대체하지 말고 `MISSING_MARKET_KEY` 실패("설정 필요")를 반환합니다. 예시는 사용자가 "예시 결과 보기"를 눌렀을 때만.
3. **없는 데이터를 만들지 않는다.** 검색 안 되는 장소·가격·기업정보·이동시간을 생성 금지. 야장 검색 결과에는 "야외 좌석 운영 여부 확인 필요", 장소 검색만으로 발견된 기업에는 "법인 여부 미확인"을 항상 표시. FRED는 "관측일 기준"이라고 명시(실시간 아님).
4. **투자 권유를 생성하지 않는다.** "매수/매도", 목표주가, 수익 보장 금지. "최근 데이터에서는 ~로 관찰됨" 형태만.
5. **민감한 원문을 서버에 저장하지 않는다.** 입력 원문·생성 결과·URL 본문·자격증명을 DB에 쓰지 않습니다. `AgentExecution`은 메타데이터 전용. 로그도 마찬가지(`safeLog`). 예외는 사용자가 명시적으로 공유를 선택한 것들(HtmlAsset 내용, SharedResult — 공개 데이터 에이전트 한정 허용 목록 `share-config.ts`).
6. **업로드 HTML은 절대 앱 DOM에 렌더링하지 않는다.** `/api/html/[id]/raw`·`/api/share/[token]/raw`가 `htmlAssetHeaders()`의 sandbox CSP로만 서빙하고, 뷰어는 `sandbox` iframe으로만 보여줍니다. **`allow-same-origin`은 어떤 경우에도 추가 금지.**
7. **접근 제어는 서버에서.** 가시성(org/link/private)·소유권 검사는 모든 라우트에서 수행(`canView`/`canEdit`). 공유 토큰은 매 요청 `resolveShareToken`으로 검증(중단·만료 즉시 차단). 기본은 **오픈 모드**: 세션이 없으면 공용 `guest` 사용자(member)로 동작해 로그인 없이 열람·실행·만들기·공유가 가능하고, `REQUIRE_LOGIN=1`일 때만 프록시가 로그인으로 보냅니다. 관리자 화면과 "실제 계정이 소유한 콘텐츠"의 수정·삭제는 오픈 모드에서도 로그인 필요 — 이 경계를 임의로 없애지 마세요.
8. **사용자 작성 에이전트는 코드가 아니라 프롬프트.** 작성자 지침은 구분 블록에 넣고 우리 규칙을 항상 그 뒤에(`buildCustomPrompt`). 작성자가 호출 호스트를 정할 수 없고, URL은 SSRF 게이트를 통과해야 합니다.

## 기술 스택

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind v4 · Radix UI · Zod 4 · Prisma 7 + SQLite · Leaflet(OSM) · Anthropic SDK · Vitest · Playwright

> Next 16: `params`/`searchParams`는 **Promise**. middleware는 `src/proxy.ts`로 개명됨.
> Prisma 7: 드라이버 어댑터 필수(`PrismaBetterSqlite3`), url은 `prisma.config.ts`.

## 인증

로컬 계정(scrypt 해시) + DB 세션(쿠키에는 토큰, DB에는 SHA-256만). 세션이 없으면 `getSessionUser`/`getUserFromRequest`가 공용 게스트(`isGuest: true`)를 돌려준다(오픈 모드, 사용자 결정 2026-10-18). 게스트 행은 시드가 만들며 로그인 불가.
- 서버 컴포넌트: `getSessionUser()` / Route Handler: `getUserFromRequest(request)` — **라우트에서 `next/headers` cookies()를 쓰지 마세요. 핸들러를 vitest로 직접 못 돌리게 됩니다.**
- 최초 실행 시 `/setup`에서 관리자 부트스트랩(계정 0개일 때만 열림).
- 추후 사내 SSO로 교체 가능하도록 인증 로직은 `src/lib/auth/*`에만 둡니다.

## 두 종류의 에이전트

1. **기본 제공 7개** — `src/lib/agents/*.agent.ts` + registry. 외부 데이터 연동 직접 수행. 시드(`prisma/seed.ts`)의 slug·이름·카테고리가 registry와 정확히 일치해야 합니다.
2. **사용자 작성** — 만들기(초보/고급)에서 생성, DB 저장. 코드 없음. `createCustomAgent()`가 러너 생성. 실행 유형은 `prompt`/`url-summary`/`csv-analysis` 3종뿐 — 임의 API 연동을 만들어주는 척 금지.

실행 경로는 `resolveAgent(slug)` 하나만 사용(레지스트리 → DB). slug 분기 금지.

## 코딩 규칙

- **계산은 코드가, 해석은 모델이.** 변화율·스프레드·거리·동선은 `finance.ts`/`kakao-local.ts`에서 계산. 모델에게 산술 금지.
- **카테고리는 "work" | "personal"** 두 가지뿐입니다.
- 외부 응답은 전부 Zod 검증, 부분 실패는 `partial`로 격하(전체 실패만 `failure`).
- 오류는 `AgentErrorCode` → `errors.ts`의 한국어 안내로. 공급자 원문 노출 금지.
- 모델 출력을 HTML로 렌더링하지 않는다(`dangerouslySetInnerHTML` 금지). `any` 금지.
- 지도는 Leaflet + OSM 타일(키 불필요) + divIcon 핀. 카카오맵은 **링크**로만 연결.

## UI 원칙

- 메뉴 7개 고정: 홈 / 에이전트 둘러보기 / 내 에이전트 / 만들기 / 공유 갤러리 / 튜토리얼 / 설정 (+관리자).
- 한 화면에 핵심 행동 하나만 강조, 복잡한 설정은 "고급 설정"으로.
- 데이터 상태는 색+아이콘+텍스트로. 결과에는 출처·조회시각·주의사항 필수.
- 색상: 네이비 `#0B2447`, 블루 `#2563EB`, 청록 `#0F9D8A`, 배경 `#F7F9FC`. 터치 44px.

## 테스트 완료 기준

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

- 테스트에서 **실제 외부 API를 호출하지 않습니다.** `tests/setup.ts`가 mock되지 않은 fetch를 실패시킵니다.
- 통합 테스트는 실제 dev.db를 씁니다. 세션은 `tests/helpers/auth.ts`의 `createTestSession()`으로 만들고 **반드시 자기 것만 cleanup** (다른 파일과 병렬 실행됨 — `vitest-` 전체 삭제 금지).
- 보안 회귀 테스트(샌드박스 CSP, SSRF, 키 미노출, 공유 중단, 소유권)를 약화시키지 마세요.
- Playwright는 시스템 Chrome 사용. 사내망에서는 `$env:NODE_OPTIONS = "--use-system-ca"`가 필요할 수 있습니다.
