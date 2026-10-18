# Agent Hub

업무는 더 효율적으로, 일상은 더 편리하게. 로그인 없이 에이전트를 실행하고 직접 만들어 공유하는 Next.js 서비스입니다.

## 실행

Node.js **24 LTS 권장**(22.12 이상), npm, SQLite 네이티브 모듈을 지원하는 Windows/Linux/macOS가 필요합니다.

```bash
npm run setup
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

개발 모드: `npm run dev:lan`. Windows: `powershell -File scripts/start-windows.ps1` 또는 `-Dev`.

로컬 브라우저에서 포트 3000으로 접속합니다. 모바일은 같은 네트워크에서 `http://노트북의사설IP:3000`으로 접속합니다. Windows 방화벽의 사내 네트워크 TCP 3000 접근 허용이 필요할 수 있습니다. 노트북이 꺼지거나 절전 상태이면 서비스도 중단됩니다. 외부 접속은 회사가 승인한 HTTPS 주소나 VPN을 사용하세요. 기존 임시 터널은 자동 생성·변경하지 않습니다.

`npm run setup`은 lockfile 기반 의존성 설치, Prisma 생성, 마이그레이션을 실행합니다. 수동 실행은 다음과 같습니다.

```bash
npm ci
npm run db:generate
# storage 폴더를 먼저 생성합니다.
npx prisma migrate deploy
npm run db:seed
npm run build
npm run start:lan
```

SQLite 파일은 기본 `storage/agent-hub.db`입니다. 기존 추적 파일 `dev.db`와 그 사용자·콘텐츠는 수정하거나 삭제하지 않습니다. 기존 앱 소스가 저장소에 없어 새 익명 권한 스키마를 분리했습니다. 구 DB 콘텐츠는 자동 이전하지 않습니다. 백업에는 새 DB와 관련 journal/WAL 파일을 함께 포함하거나 서버를 멈춘 상태에서 SQLite 백업을 사용하세요.

## 로그인 없는 권한

- 홈·갤러리·제작·실행·공유·복제·튜토리얼에 계정이 필요하지 않습니다. 로그인·가입·SSO·관리자 계정 생성 경로는 없습니다.
- 최초 API 접근 시 256비트 무작위 브라우저 자격 증명을 HttpOnly·SameSite=Lax 쿠키로 발급합니다. 서버에는 SHA-256 해시만 저장합니다.
- 각 콘텐츠의 **별도 편집 쿠키**와 해시를 발급합니다. 작성자 ID나 공유 토큰만으로 원본을 변경할 수 없습니다.
- 복구 키는 생성·복제 시 한 번 표시합니다. 브라우저 데이터를 삭제하거나 편집 쿠키가 사라지면 `/my`에서 복구할 수 있습니다. 복구 시 이전 편집·복구 키를 회전합니다. 복구 키를 공유하지 마세요.
- HTTPS에서는 Secure 쿠키를 사용합니다. TLS 종료 프록시 뒤에서는 `FORCE_SECURE_COOKIES=1`, 올바른 `APP_BASE_URL`을 설정하세요. 일반 HTTP LAN 환경에는 Secure 쿠키를 강제하지 마세요.
- 공유 기본값은 **링크 공유**입니다. 비공개는 제작 브라우저만, 갤러리 공개는 모든 방문자가 탐색할 수 있습니다. 갤러리 공개는 직접 선택해야 합니다.
- 공유 링크 `/share/<256비트 토큰>`은 열람·실행·복제 권한만 포함합니다. DB에는 공유 토큰의 해시만 저장합니다. 만료 또는 공유 해제는 열기·실행·복제·HTML 서빙 시마다 검증합니다. 복제본은 독립적이므로 원본 공유 해제가 이미 생성된 복제본을 삭제하지는 않습니다.
- 링크를 아는 외부 사용자도 접근할 수 있습니다. 서버가 노출된 범위를 확인하고 승인된 자료만 공유하세요.

## 기본 에이전트: 업무 5개 + 개인 2개

| 에이전트 | 실제 실행 | 필요 연결 |
|---|---|---|
| 시장 뉴스 브리핑 | 네이버 뉴스 조회, 기간 필터, 중복 제목 제거, 기사 원문 | NAVER_CLIENT_ID / NAVER_CLIENT_SECRET. AI 요약은 Anthropic 선택 |
| ETF 비교 분석 | CSV/XLSX 파싱, 숫자 집계·차트·다운로드, 기준일 확인, 가격 시계열의 관측 간 수익률 표준편차 | 키 불필요 |
| 해외 리서치·어닝콜 요약 | PDF/TXT/영문 본문 추출, 한국어 번역·요약·근거 인용 | ANTHROPIC_API_KEY |
| 환율·금리 모니터링 | FRED DEXKOUS·DGS2·DGS10, 관측일별 값·변화·금리차 | FRED_API_KEY |
| 주변 법인·기업 잠재고객 탐색 | 카카오 장소, 기준 좌표·반경·거리순 조회, 공개 기업 CSV/XLSX, 선택적 DART 고유번호 기업개황 | KAKAO_REST_API_KEY, 선택적 DART_API_KEY. 업로드 분석은 키 불필요 |
| 야장맵·야외 식당 탐색 | 실제 카카오 장소·지도 핀·공식 지도 링크, 후보·메모 저장 | KAKAO_REST_API_KEY |
| 웨딩홀 정보 모음 | 장소·지도·비교표, 후보 저장 및 가격·식대·보증 인원·체크리스트 사용자 메모 | KAKAO_REST_API_KEY |

주말 여행 에이전트와 평점·랭킹은 없습니다. 야외 좌석·가격·법인 여부 등 확인되지 않은 정보는 생성하지 않습니다. FRED는 실시간 시세가 아닌 **관측일 기준**입니다. ETF 수익률·보수·분배율은 업로드 값 그대로이며, 변동성에는 `name,date,price` 형식의 종목별 시계열 3행 이상이 필요합니다. 날짜가 다르거나 없으면 경고합니다. 수치를 AI에게 계산시키지 않습니다.

기준일·숫자 열 예시:

```csv
name,return,fee,dividend,date
ETF A,8.2,0.15,2.1,2026-10-16
ETF B,6.4,0.09,3.0,2026-10-16
```

예시값 채우기는 입력을 작성하는 기능입니다. **예시 결과 보기**는 별도로 명시한 샘플 모드입니다. API 키가 없는 실제 실행은 `설정 필요`를 반환하고 샘플로 대체하지 않습니다.

## 제작과 공유

`/make`에서 이름 → 입력 안내 → 실행 방식 → 결과 안내 → 테스트 실행 → 저장 → 공유합니다. 키 없이 입력 구조화나 CSV 분석부터 체험할 수 있습니다. 입력 구조화는 입력 줄을 항목 순서대로 정리하는 결정적 기능으로, AI 분석이나 외부 조회라고 표시하지 않습니다.

AI 문서 요약·번역·공개 URL 요약, 공식 뉴스·환율·장소·기업 조회도 실행 엔진에 연결됩니다. 고급 설정의 프롬프트·항목 정의·결과 안내를 저장하며 수정 시 버전 번호가 증가합니다. AI 출력 스키마는 `{"요약":"string","확인필요":"boolean"}`처럼 최대 20개 항목의 string/number/boolean 타입을 정의하고 실제 응답을 검증합니다. URL 조회는 공개 HTTPS만 지원하며 리디렉션마다 DNS를 재검사하고 검증한 IP에 연결합니다.

HTML은 최대 2MB 단일 파일을 지원합니다. 서버에서 위험한 태그·링크·외부 리소스를 정제하고, `sandbox` iframe과 CSP로 표시합니다. **임의 JavaScript·폼·팝업·부모 접근·네트워크 호출은 차단합니다.** 스크립트가 필수인 앱은 회사가 승인한 별도 HTTPS 웹사이트로 배포하고 웹사이트 공유로 등록하세요. 웹사이트는 공개 HTTPS 주소만 등록하고 새 탭에서 엽니다. 서버가 임의 사이트의 실행 코드나 iframe을 신뢰하지 않습니다.

튜토리얼은 첫 실행 / 실데이터 연결 / 만들기·공유의 세 가지이며 브라우저별 진행을 DB에 저장합니다. 장소 후보와 사용자 메모도 해당 브라우저만 조회합니다. 실행 입력·업로드 문서·결과 원문을 DB에 자동 저장하거나 공유하지 않습니다.

## 서버 설정과 실제 API

`.env.example`을 참고하세요. 기존 `.env`를 덮어쓰지 마세요. 키는 운영자가 서버 환경변수 또는 승인된 환경 설정에만 등록하고 서버를 재시작합니다. 익명 UI에는 키 변경·서버 관리 API가 없습니다. `/settings`는 키의 존재 여부만 반환하며 키 값·길이·마스킹을 노출하지 않습니다. 연결 검증은 해당 에이전트를 실제 실행해 제공처 결과와 출처를 확인하세요.

필요 도메인: `openapi.naver.com`, `dapi.kakao.com`, `opendart.fss.or.kr`, `api.stlouisfed.org`, `api.anthropic.com`. 지도 타일은 `tile.openstreetmap.org`를 사용합니다. 설치에는 npm 레지스트리와 `binaries.prisma.sh`가 필요합니다. Pretendard 폰트와 일러스트는 로컬 파일로 제공됩니다.

| 설정 | 의미 |
|---|---|
| HUB_DATABASE_URL | 새 SQLite URL. 예: `file:/absolute/path/agent-hub.db` |
| APP_BASE_URL | 승인된 실제 접속 origin |
| FORCE_SECURE_COOKIES | HTTPS 종료 프록시에서 `1` |
| TRUST_PROXY | 신뢰하는 프록시가 외부 전달 헤더를 제거·재설정할 때만 `1` |
| RUN_SESSION_LIMIT | 기본 브라우저별 15분에 30회 |
| RUN_IP_LIMIT | 기본 IP별 15분에 60회 |
| ANTHROPIC_MODEL | 운영자가 사용할 승인된 Anthropic 모델 ID |

프로덕션 `npm run start`는 소켓 IP를 주입하는 서버를 사용하고 클라이언트의 같은 이름 헤더를 덮어씁니다. 개발용 `next dev`에서는 IP를 신뢰할 수 없어 네트워크 공통 버킷을 보수적으로 사용합니다. 브라우저·IP별 쓰기 제한, 최대 3개 동시 실행, 12초 외부 데이터 타임아웃, AI 30초 타임아웃, 2MB 업로드·3MB JSON 본문 제한이 적용됩니다. XLSX는 5,000행·50열과 압축 해제 크기도 제한합니다. 외부 HTTP/TLS 검증을 끄지 않습니다. 실행 오류 기록에는 오류 코드·처리 시간만 남깁니다. 단일 노트북 프로세스 운영이 기본이며 다중 인스턴스 확장에는 공유 동시 실행 제한과 저장소 설계가 필요합니다.

## 검증

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:restart
```

Playwright는 Linux의 `/usr/bin/chromium` 또는 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`를 사용합니다. 없으면 `npx playwright install chromium`으로 설치합니다. E2E와 재시작 검증은 임시 DB를 사용하여 사용자 DB를 건드리지 않습니다. 테스트 제공처 응답은 mock이며 실제 API 연결 성공과 구분해야 합니다. 화면 캡처는 `artifacts/`에 저장됩니다. 현재 검증 결과와 한계는 `VALIDATION.md`를 참고하세요.

현재 클라우드에서는 시스템 DNS 조회가 `EAI_AGAIN`으로 실패할 수 있어 일반 도메인의 웹사이트 등록·공개 URL 요약이 차단됩니다. DNS 검사를 우회하지 않습니다. 공개 IP의 HTTPS 웹사이트 공유는 검증했으며, 노트북에서는 정상 작동하는 시스템 DNS가 필요합니다. 서버 DNS가 복구되면 도메인 등록 테스트를 다시 실행하세요.

IP 헤더 위조·새 세션으로 호출 제한을 우회할 수 없는지 별도 검증하려면 `node scripts/limits-check.mjs`를 실행합니다.

## 임시 HTTPS 공유 주소

아까 사용한 trycloudflare 형태로 노트북을 공유하려면 공식 cloudflared 설치 후 `npm run share`를 실행하세요. 의존성·DB·빌드를 준비하고 서버와 터널을 함께 실행해 실제 발급 주소를 출력합니다. 자세한 Windows 설치·실행 절차는 [LOCAL-SHARE.md](./LOCAL-SHARE.md)에 있습니다.
