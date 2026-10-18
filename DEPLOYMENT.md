# 노트북 서버 운영

간편 실행: `npm run local` 또는 Windows `local-windows.cmd`. 기본 포트는 5000이며 실행 후 같은 네트워크용 주소를 표시합니다.

1. Node.js 24 LTS를 설치합니다.
2. 저장소에서 `npm run setup`, `npm run build`를 실행합니다.
3. `npm run start -- --hostname 0.0.0.0 --port 5000`으로 서버를 시작합니다.
4. 같은 네트워크의 PC·모바일에서 `http://노트북의사설IP:5000`으로 접속합니다. 네트워크 프로필에 맞게 방화벽 접근을 허용하세요.

Windows에서는 `powershell -File scripts/start-windows.ps1`을 사용할 수 있습니다. 개발 모드는 `-Dev`입니다. 노트북 절전·전원 종료 시 서버도 중단됩니다.

계정이 없으므로 접속 가능한 모든 사람이 제작·실행할 수 있으며, 공유 링크를 가진 외부인도 콘텐츠에 접근할 수 있습니다. 승인된 네트워크·HTTPS 주소·VPN 범위에서 운영하세요. 임시 터널을 자동 생성하지 않습니다. 공용 API 키 변경과 서버 관리는 OS/환경 설정에서 운영자만 수행합니다.

HTTPS 역방향 프록시 뒤에서는 `APP_BASE_URL`을 실제 주소로 설정하고 `FORCE_SECURE_COOKIES=1`을 지정합니다. `TRUST_PROXY=1`은 프록시가 외부 `X-Forwarded-For`를 제거하고 검증한 접속 IP로 재설정할 때만 사용하세요. 직접 HTTP로 접근하는 LAN에서는 Secure 쿠키를 강제하면 편집 쿠키가 전송되지 않습니다.

새 DB는 `storage/agent-hub.db`이며 기존 `dev.db`는 보존합니다. 서버 중지 후 SQLite DB를 백업하세요. 쿠키와 복구 키를 잃으면 제작 권한을 자동 복원할 수 없습니다. 복구 키는 사용자 본인이 안전한 곳에 보관해야 합니다.

SQLite·실행 동시 제한은 단일 프로세스 노트북 운영을 기준으로 합니다. 서버리스나 다중 서버 전환 시 공유 저장소·공유 실행 제한 설계가 필요합니다.
