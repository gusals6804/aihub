# 노트북에서 아까와 같은 임시 공유 링크 만들기

Node.js 24 LTS가 설치된 노트북에서 이 프로젝트를 실행합니다. 이 파일들이 있는 폴더로 이동하세요. Windows는 PowerShell을 사용합니다.

1. Cloudflare 공식 클라이언트를 한 번 설치합니다.

```powershell
winget install --id Cloudflare.cloudflared --exact
```

설치 후 PowerShell 창을 새로 열어 PATH를 적용합니다. macOS는 `brew install cloudflared`, Linux는 Cloudflare 공식 다운로드 안내를 사용하세요: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

2. 프로젝트 폴더에서 실행합니다.

```powershell
npm run share
```

Windows에서는 `share-windows.cmd`를 더블클릭해도 됩니다. 첫 실행은 의존성 설치·DB 준비·빌드 때문에 시간이 걸립니다. 기존 `.env`·DB·터널 설정은 덮어쓰지 않습니다. 기본 3000번 포트가 사용 중이면 다음 빈 로컬 포트를 사용해 새 앱 프로세스를 실행합니다. 다른 포트를 원하면 `npm run share -- --port 3300`처럼 지정합니다.

3. 터미널의 **공유 주소:** 뒤에 실제로 출력되는 `https://…trycloudflare.com` 주소를 복사해 전달합니다. 미리 정해진 주소가 아니며 실행할 때 Cloudflare가 새 주소를 발급합니다.

4. 스마트폰의 Wi-Fi를 잠시 끄고 해당 주소를 열어 외부 접속도 확인하세요. 주소 발급과 로컬 앱 준비만으로 Cloudflare의 외부 연결 성공을 보장할 수는 없습니다.

터미널을 켜 두어야 합니다. Ctrl+C로 앱과 터널을 함께 종료합니다. 노트북 종료·절전·네트워크 차단 시 접속이 중단되며 다시 실행하면 주소가 달라집니다. 앱 내부 콘텐츠 공유 링크도 새 서버 주소에서 다시 복사하세요. 영구 주소가 필요하면 승인된 고정 도메인과 named tunnel을 따로 구성해야 합니다.

공유 주소를 받은 누구나 홈·공개 갤러리·에이전트 실행·제작에 접근할 수 있습니다. 개인 비공개 콘텐츠는 기존 권한 검사를 유지합니다. 회사 정책상 공개가 허용된 자료로 테스트하세요. 공용 API 키는 서버 설정에만 보관하고 공유 URL에 넣지 않습니다. 임시 주소는 HTTPS로 열고, 실행기가 Secure/HttpOnly 쿠키와 해당 HTTPS origin을 자동 설정합니다.

이 실행기는 원본 앱을 loopback에 바인딩하고 프록시 전달 IP 헤더를 신뢰하지 않습니다. 터널 이용자는 브라우저별 실행 제한과 터널 전체 IP 한도를 함께 적용받습니다. 회사 망에서 Cloudflare DNS/API 또는 터널 연결이 막혀 있다면 보안 정책을 우회하지 말고 승인된 네트워크 경로를 사용하세요.

## 이 클라우드에서 확인한 범위

- 실제 cloudflared 2026.10.1 공식 바이너리로 임시 터널 생성을 시도했습니다.
- 현재 클라우드 DNS가 `api.trycloudflare.com`에서 connection refused를 반환해 실제 공개 주소는 발급되지 않았습니다. 사용자 노트북의 로컬 프로세스를 여기서 대신 실행하거나 노트북 주소를 발급할 수는 없습니다.
- 로컬 테스트용 터널 출력을 사용해 실제 앱 시작, HTTPS origin 요청, Secure/HttpOnly 편집 쿠키, 콘텐츠·공유 생성, 종료 시 프로세스 정리를 검증했습니다. 이것은 외부 터널 연결 검증과 구분합니다.
- Windows 실행은 이 Linux 환경에서 직접 검증하지 못했습니다.
