# GitHub Pages Dashboard + Cloud Run API 배포

## 아키텍처

```text
GitHub Pages (정적 대시보드)
        │ HTTPS + CORS + JWT
        ▼
Cloud Run (Spring Boot API)
        │
        ├── MySQL + Flyway
        ├── S3 이미지 저장소
        └── SMTP 이메일
```

GitHub Pages는 정적 파일만 호스팅합니다. DB, JWT secret, Gmail password, AWS key는 Pages나 GitHub repository에 넣을 수 없습니다. 이 값들은 Cloud Run/Google Secret Manager에만 둡니다.

## 배포 전 필수 보안 조치

이 저장소의 과거 설정에는 비밀값이 포함되어 있었습니다. 다음을 **먼저** 처리하세요.

1. DB 비밀번호, Gmail app password, JWT signing secret을 모두 회전·폐기합니다.
2. Cloud Run에 새 값을 환경변수 또는 Google Secret Manager secret으로 설정합니다.
3. GitHub에 비밀값이 남지 않도록 `application.yml`은 환경변수 이름만 유지합니다.
4. 이미 공개된 Git history는 별도로 정리합니다. 단순히 최신 커밋에서 지우는 것만으로는 과거 접근 가능성이 사라지지 않습니다.
5. 공개된 고정 관리자 계정/해시가 운영 DB에 남아 있는지 확인하고, 운영에서는 안전한 관리자 provisioning 절차로 교체합니다.

## 1. Cloud Run API 설정

현재 `cloudbuild.yaml`은 다음 Cloud Run 서비스를 대상으로 합니다.

- service: `snuti-exp-archive-server-git`
- region: `asia-northeast3`

실제 URL은 저장소에 없으므로 추측하지 말고 GCP Console 또는 아래 명령으로 확인합니다.

```bash
gcloud run services describe snuti-exp-archive-server-git \
  --region asia-northeast3 \
  --format='value(status.url)'
```

Cloud Run service에 최소한 아래 환경변수를 설정합니다.

| 환경변수 | 용도 |
| --- | --- |
| `DB_URL` | MySQL JDBC URL |
| `DB_USER`, `DB_PASSWORD` | DB 계정 |
| `JWT_SECRET` | 32자 이상 signing secret |
| `GMAIL_USERNAME`, `GMAIL_APP_PASSWORD` | 이메일 발송을 사용할 때 |
| `CORS_ALLOWED_ORIGINS` | `https://haru1dh.github.io`를 포함한 쉼표 구분 origin 목록 |

Cloud Build 명세만으로 GitHub push 배포가 자동 시작되지는 않습니다. Cloud Build trigger를 GCP에서 별도로 연결하거나, 승인된 환경에서 아래처럼 수동 빌드합니다.

```bash
gcloud builds submit --config cloudbuild.yaml .
```

배포 뒤 다음 두 주소를 확인합니다.

```text
https://<Cloud-Run-URL>/actuator/health
https://<Cloud-Run-URL>/swagger-ui/index.html
```

## 2. GitHub Pages 활성화

1. GitHub repository의 **Settings → Pages**에서 source를 **GitHub Actions**로 선택합니다.
2. **Settings → Secrets and variables → Actions → Variables**에서 다음 Repository Variable을 추가합니다.

   ```text
   EXP_ARCHIVE_API_BASE_URL=https://<실제-Cloud-Run-URL>
   ```

   이 URL은 브라우저에 공개되는 값이므로 Variable로 두어도 됩니다. 하지만 password, JWT secret, DB credential은 절대 넣으면 안 됩니다.

3. `main`에 대시보드 변경을 병합합니다. `.github/workflows/deploy-dashboard.yml`이 `docs/dashboard`를 Pages로 배포합니다.
4. 배포 후 예상 주소는 다음과 같습니다.

   ```text
   https://haru1dh.github.io/SNUTI.ExP-archive-server/
   ```

대시보드는 `/actuator/health`를 30초 간격으로 확인하고, 로그인 후 `/lectures`를 새로고칩니다. JWT는 이 탭의 session storage에만 유지되고, 비밀번호는 저장하지 않습니다.

## 3. 안전한 배포 확인 순서

1. Cloud Run의 `/actuator/health`가 `{"status":"UP"}`을 반환하는지 확인
2. Pages 대시보드에서 health가 초록색인지 확인
3. 일반 사용자 계정으로 로그인
4. 최근 강연·검색·상세 화면이 보이는지 확인
5. Cloud Run 로그에서 CORS 오류, DB 오류, auth 오류가 없는지 확인
6. GitHub Actions의 `Verify server` workflow가 통과했는지 확인

## 운영 주의사항

- `main` branch protection에서 Gradle test를 required check로 설정하는 것을 권장합니다.
- Health endpoint는 세부 상태를 숨기며, 서비스 up/down 판정 용도로만 사용합니다.
- Dashboard는 읽기 중심입니다. 관리자 수정 API는 Swagger 또는 별도의 관리자 화면에서 명시적으로 관리하세요.
- 이메일 인증·비밀번호 재설정은 rate limit, 시도 횟수 제한, 계정 열거 방지 응답을 추가한 뒤 운영하는 것이 좋습니다.
