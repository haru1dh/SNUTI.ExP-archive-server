# SNUTI ExP Archive Server 분석 가이드

이 문서는 `haru1dh/SNUTI.ExP-archive-server`의 기본 브랜치를 기준으로 한 구조 분석과 작업 지침입니다.

## 한눈에 보는 구조

```text
HTTP request
  → Controller
  → Service
  → Spring Data JPA Repository
  → MySQL (Flyway schema migration)

파일 이미지
  → ImageStorageService
  → S3ImageStorageService
  → AWS S3 / CDN URL
```

- Kotlin + Spring Boot 4.0.1, Java toolchain 17, Gradle wrapper 9.2.1
- Spring Web, Security, Validation, JPA, Flyway/MySQL, Mail, Swagger/OpenAPI, AWS S3 SDK, JJWT 사용
- 서버 시작점: `Application.kt`
- 이미지 업로드는 multipart, 최대 파일 10MB / 요청 50MB
- Dockerfile은 JDK 17로 bootJar를 만들고 JRE 17에서 8080 포트로 실행

## 패키지별 역할

| 경로 | 역할 |
| --- | --- |
| `auth/` | 회원가입·로그인·이메일 인증·비밀번호 재설정·JWT |
| `lecture/` | 강연, 아티클, 글 블록, 동영상, 태그 도메인 |
| `user/` | 사용자·역할·이메일 인증 entity/repository |
| `common/config/` | Security, CORS, Swagger, AWS 설정 |
| `common/storage/` | 이미지 저장소 interface와 S3 구현 |
| `common/error/` | 전역 예외 처리 |
| `db/migration/` | Flyway V1–V7 schema/history |

## 데이터 모델

- **User**: 이메일, BCrypt password hash, USER/ADMIN 역할, email verified 상태
- **Lecture**: 제목, 일시, 장소, 강연자, 주제, 요약, DRAFT/PUBLISHED 상태, 작성자
- **Article**: Lecture에 연결되며 TEXT/IMAGE 순서 블록을 가짐
- **Video**: Lecture에 연결된 URL/caption
- **Tag / LectureTag**: 강연의 다대다 태그 연결
- **EmailVerification**: 이메일 인증/비밀번호 재설정에 쓰이는 코드 상태

## API 경계

| 범위 | 대표 경로 | 권한 |
| --- | --- | --- |
| 인증 | `POST /auth/register`, `POST /auth/login` | 공개 |
| 이메일/비밀번호 재설정 | `/auth/email/**`, `/auth/password/reset/**` | 공개 |
| 본인 계정 변경 | `PATCH /auth/password`, `DELETE /auth/me` | JWT 필요 |
| 강연 목록·검색·상세 | `GET /lectures`, `/lectures/search`, `/lectures/{id}` | JWT 필요 |
| 아티클 상세 | `GET /articles/{id}` | JWT 필요 |
| 관리자 콘텐츠 작업 | `/admin/lectures/**`, `/admin/articles/**`, `/admin/videos/**`, `/admin/tags` | ADMIN |
| API 탐색 | `/swagger-ui/index.html` | 공개 |
| 운영 상태 | `/actuator/health` | 공개, 상세 비공개 |

로그인 응답의 `accessToken`을 이후 요청의 `Authorization: Bearer <token>` 헤더에 넣습니다. 토큰은 60분 만료로 설정되어 있습니다.

## 배포·실행 흐름

```text
GitHub source
  → Cloud Build (Docker build/push)
  → Artifact Registry
  → Cloud Run (asia-northeast3)
  → MySQL + S3 + SMTP
```

`cloudbuild.yaml`은 Cloud Run service `snuti-exp-archive-server-git`로 배포하도록 작성되어 있습니다. 다만 파일만으로 GitHub push 자동 배포가 생기지는 않으므로, Cloud Build trigger 여부는 GCP에서 확인해야 합니다.

## 테스트

`src/test/kotlin`에 Auth, Lecture, Article, Video integration test가 있습니다.

- `@SpringBootTest` + `@ActiveProfiles("test")`
- H2 메모리 DB를 MySQL mode로 사용
- Flyway migration 적용
- EmailService는 mock, 이미지 저장소는 fake 구현 사용

H2는 실제 MySQL 8과 완전히 같지 않으므로, schema/Flyway 변경은 Docker MySQL에서도 한 번 더 검증해야 합니다.

## 운영 전 우선 개선 항목

1. 이미 노출된 DB/Gmail/JWT 비밀값을 회전하고, 코드·Git history에서 대응합니다.
2. 운영용 고정 admin seed가 남아 있는지 확인하고, 안전한 provisioning으로 교체합니다.
3. 이메일 인증/비밀번호 재설정에 crypto-secure code, rate limit, 시도 횟수 제한, 계정 열거 방지 응답을 추가합니다.
4. 업로드 파일은 MIME/확장자 외 콘텐츠 검증·악성 파일 방어를 추가합니다.
5. S3 삭제와 DB transaction의 실패 보상 전략을 정합니다.
6. lecture/tag 조회 시 N+1 여부와 search/page size 제한을 점검합니다.
