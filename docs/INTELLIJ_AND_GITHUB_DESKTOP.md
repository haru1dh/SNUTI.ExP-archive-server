# IntelliJ IDEA와 GitHub Desktop으로 서버 작업하기

이 프로젝트는 Kotlin + Spring Boot + Gradle 서버입니다. GitHub Pages 대시보드는 정적 HTML/CSS/JavaScript이고, 서버와 별도로 배포됩니다.

## 1. 준비물

| 항목 | 이 저장소의 기준 |
| --- | --- |
| JDK | 17 |
| 빌드 도구 | Gradle Wrapper 9.2.1 |
| 언어 | Kotlin 2.2.21 |
| 프레임워크 | Spring Boot 4.0.1 |
| 로컬 DB | Docker Compose의 MySQL 8 |
| 서버 시작점 | `src/main/kotlin/com/snuti/exparchiveserver/Application.kt` |

GitHub Desktop에서 저장소를 clone한 뒤, **작업 전용 브랜치**에서 변경하세요. 이 저장소의 `main`은 직접 수정하기보다 PR을 거쳐 병합하는 흐름이 안전합니다.

## 2. GitHub Desktop → IntelliJ 연결

1. GitHub Desktop에서 `haru1dh` 계정으로 로그인합니다.
2. **File → Clone repository**에서 `haru1dh/SNUTI.ExP-archive-server`를 선택합니다.
3. **File → Options → Integrations → External Editor**를 열어 **IntelliJ IDEA**를 기본 편집기로 지정합니다.
4. **Current Branch → New Branch**에서 예를 들어 `feature/dashboard` 또는 `fix/local-run` 브랜치를 만듭니다.
5. **Repository → Open in default editor**를 누릅니다.

GitHub Desktop에서는 아래 흐름을 반복하면 됩니다.

1. **Fetch origin**으로 원격 변경을 확인합니다.
2. 변경사항은 **Changes** 탭에서 diff를 확인하고 필요한 파일만 체크합니다.
3. 한 가지 목적 단위로 커밋합니다. 예: `feat: add archive dashboard`
4. **Push origin** 또는 **Publish branch**로 브랜치를 원격에 올립니다.
5. **Preview Pull Request → Create Pull Request**로 `main`에 대한 PR을 만듭니다.
6. CI가 통과한 뒤 GitHub에서 리뷰·병합합니다.

공식 안내: [GitHub Desktop으로 clone](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-a-repository-from-github-to-github-desktop), [기본 편집기 지정](https://docs.github.com/en/desktop/configuring-and-customizing-github-desktop/configuring-a-default-editor-in-github-desktop), [브랜치 관리](https://docs.github.com/en/desktop/making-changes-in-a-branch/managing-branches-in-github-desktop), [원격 브랜치 동기화](https://docs.github.com/en/desktop/working-with-your-remote-repository-on-github-or-github-enterprise/syncing-your-branch-in-github-desktop).

## 3. IntelliJ 프로젝트 열기

1. IntelliJ에서 저장소 루트의 `build.gradle` 또는 폴더를 엽니다.
2. 신뢰 여부를 묻는 창에서 **Trust Project**를 선택합니다.
3. Gradle import가 끝날 때까지 기다립니다.
4. **File → Project Structure**에서 **Project SDK = JDK 17**인지 확인합니다.
5. **Settings → Build, Execution, Deployment → Build Tools → Gradle**에서 Gradle JVM도 **JDK 17**, Gradle은 **Wrapper** 사용으로 둡니다.
6. `Application.kt`의 gutter 실행 버튼을 누르면 IntelliJ가 Spring Boot run configuration을 생성합니다.

## 4. 로컬 실행

Docker Compose는 앱 전체가 아니라 **MySQL만** 실행합니다.

```bash
docker compose up -d mysql
```

IntelliJ의 **Run → Edit Configurations**에서 만든 Spring Boot/Application 실행 구성의 **Environment variables**에 아래 이름을 추가합니다. 실제 운영 값은 넣지 말고, 개인 개발 DB와 개인 JWT secret만 사용하세요.

```text
PORT=8080
DB_URL=jdbc:mysql://localhost:3306/lecture_archive
DB_USER=root
DB_PASSWORD=<로컬 MySQL 비밀번호>
JWT_SECRET=<32자 이상인 로컬 전용 secret>
CORS_ALLOWED_ORIGINS=https://haru1dh.github.io,http://localhost:5173,http://localhost:63342
```

- 이메일 발송 API를 시험할 때만 `GMAIL_USERNAME`, `GMAIL_APP_PASSWORD`를 추가합니다.
- S3 이미지 업로드를 실제로 시험할 때만 AWS 기본 자격증명 체인에 맞춰 AWS 자격증명을 별도로 설정합니다.
- `.env.example`은 이름 목록용 템플릿입니다. IntelliJ는 별도 플러그인 없이 `.env`를 자동 읽지 않으므로, 실제 값은 **Run Configuration 환경변수**에 넣는 편이 명확합니다.
- `.env`, `application-local.yml`, IntelliJ의 `.idea`는 gitignore되어야 하며 커밋하면 안 됩니다.

실행 후 다음 URL을 확인합니다.

```text
http://localhost:8080/swagger-ui/index.html
http://localhost:8080/actuator/health
```

## 5. IntelliJ에서 할 수 있는 작업

- **실행·디버깅:** controller/service에 breakpoint를 걸고 Swagger 또는 IntelliJ HTTP Client로 요청을 보내면 해당 줄에서 멈춥니다.
- **테스트:** Gradle의 `test` task 또는 각 integration test를 Debug로 실행합니다. 테스트 프로필은 H2 메모리 DB와 가짜 이미지 저장소를 사용합니다.
- **DB 점검:** IntelliJ Database Tools에서 로컬 MySQL 데이터 소스를 추가해 Flyway가 만든 테이블과 데이터를 확인합니다. 운영 원격 DB는 IDE에 직접 연결하지 않는 것이 안전합니다.
- **API 실험:** Swagger UI에서 로그인으로 받은 JWT를 Authorize에 넣고 `/lectures`, `/articles`, `/admin` API를 시험합니다.
- **리팩터링:** Kotlin의 Rename/Find Usages, Spring endpoint 탐색, Gradle dependency 갱신, test coverage를 사용할 수 있습니다.

공식 안내: [IntelliJ Spring Boot 지원](https://www.jetbrains.com/help/idea/spring-boot.html), [IntelliJ MySQL data source](https://www.jetbrains.com/help/idea/mysql.html).

## 6. 자주 발생하는 문제

| 증상 | 우선 확인할 것 |
| --- | --- |
| Gradle sync 실패 | JDK 17, Wrapper 사용, 네트워크에서 Maven Central 접근 가능 여부 |
| 앱 시작 실패 | `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` 환경변수 |
| Dashboard에서 CORS 오류 | Cloud Run의 `CORS_ALLOWED_ORIGINS`에 `https://haru1dh.github.io`가 있는지 |
| Health가 DOWN | Cloud Run 로그와 DB 연결 상태. health 응답은 세부 정보를 공개하지 않습니다. |
| 이미지 업로드 실패 | AWS 자격증명, S3 bucket 권한, 파일 크기 제한(10MB) |
| 테스트만 실패 | H2와 MySQL 8의 차이. Docker MySQL에서도 migration을 확인합니다. |
