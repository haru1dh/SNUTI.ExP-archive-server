# 관심 강좌 · 키워드 강좌 기능

이 기능은 같은 서버 API를 웹·모바일 앱에서 함께 쓰도록 만들었습니다. Android/iOS 앱 코드는 이 저장소에 없지만, `docs/dashboard/index.html`은 휴대폰 크기로 표시되는 실제 API 연동 웹 앱입니다.

## 사용자가 보는 흐름

1. 로그인 후 **내 정보**를 엽니다.
2. **관심 강좌 설정**을 누릅니다.
3. `#신약개발`, `#바이오` 같은 키워드를 선택하고 저장합니다.
4. 하단 **관심** 탭에서 선택 키워드와 하나라도 일치하는 공개 강좌를 추천받습니다.
5. **검색** 탭에서는 키워드 칩을 눌러 그 키워드의 모든 공개 강좌를 따로 볼 수 있습니다.

키워드 탐색은 관심 설정을 바꾸지 않습니다. 예를 들어 `#AI`를 눌러 구경해도 내 관심 키워드에는 자동 저장되지 않습니다.

## 관리자가 강좌를 게시하는 흐름

관리자 계정으로 로그인하면 **내 정보 → 새 강좌 게시**가 표시됩니다.

- 제목과 일시는 필수입니다.
- 공개 상태를 **바로 공개** 또는 **초안으로 저장** 중 선택합니다.
- 키워드는 기존 칩을 누르거나 입력칸에 직접 입력합니다.
- 쉼표로 여러 키워드를 한 번에 추가할 수 있습니다.
- 새 키워드는 서버에 등록된 뒤 강좌와 연결됩니다.
- 초안(`DRAFT`)은 일반 사용자의 목록·추천·키워드 탐색에 보이지 않습니다.

화면에서 관리자 버튼을 숨기는 것은 편의 기능일 뿐입니다. 실제 권한은 서버의 `/admin/**` 관리자 검사로 보호됩니다.

## 서버 구조

```text
강좌(Lecture) ──< LectureTag >── 태그(Tag)
사용자(User) ──< UserInterestTag >── 태그(Tag)
```

- `V8__create_user_interest_tags.sql`: 사용자별 관심 태그 테이블
- `LectureCreateRequest.tags`: 강좌 생성 시 키워드 이름 목록
- `LectureAdminService`: 빈 값·중복을 제거하고 기존 태그를 재사용하거나 새 태그 생성
- `UserInterestService`: 로그인한 사용자 자신의 관심 키워드만 교체 저장

## API 계약

| 목적 | API | 요청 / 동작 |
| --- | --- | --- |
| 선택 가능한 키워드 | `GET /tags` | 로그인 필요 |
| 내 관심 키워드 읽기 | `GET /users/me/interests` | 로그인 필요 |
| 내 관심 키워드 저장 | `PUT /users/me/interests` | `{"tagIds":[3,7]}`; 전체 교체, 빈 배열은 모두 해제 |
| 관심 기반 추천 | `GET /lectures/recommended?page=0&size=20` | 저장한 키워드 중 하나와 일치하는 공개 강좌 |
| 키워드별 탐색 | `GET /lectures/by-tag?tagId=3&page=0&size=20` | 그 키워드의 공개 강좌만 반환 |
| 강좌 생성 | `POST /admin/lectures` | 관리자만, 아래 JSON 참고 |
| 키워드 생성 | `POST /admin/tags` | 관리자만, `{"name":"신약개발"}` |

강좌 생성 JSON 예시:

```json
{
  "title": "신약개발 최신 동향",
  "lectureDate": "2026-10-01T14:00:00",
  "location": "302동 105호",
  "lectureSummary": "신약 개발 과정과 최신 기술을 다룹니다.",
  "lecturerName": "홍길동 교수",
  "topic": "바이오·의약",
  "status": "PUBLISHED",
  "tags": ["신약개발", "바이오"]
}
```

수정 API `PATCH /admin/lectures/{lectureId}`에서는 `tags`를 생략하면 기존 키워드를 유지하고, `"tags":[]`를 보내면 모두 제거합니다.

## IntelliJ에서 바꾸는 위치

| 바꾸려는 것 | 파일 |
| --- | --- |
| 키워드별 강좌 API | `src/main/kotlin/com/snuti/exparchiveserver/lecture/controller/LectureController.kt` |
| 공개 강좌 조회 규칙 | `src/main/kotlin/com/snuti/exparchiveserver/lecture/service/LectureQueryService.kt` |
| 강좌 생성/수정 요청의 `tags` | `src/main/kotlin/com/snuti/exparchiveserver/lecture/dto/LectureDtos.kt` |
| 관리자 강좌·태그 API | `src/main/kotlin/com/snuti/exparchiveserver/lecture/controller/LectureAdminController.kt` |
| 관심 키워드 API | `src/main/kotlin/com/snuti/exparchiveserver/user/controller/UserInterestController.kt` |
| 휴대폰형 앱 화면 | `docs/dashboard/index.html` |
| 앱 API 호출·화면 전환 | `docs/dashboard/assets/app.js` |
| 앱 디자인 | `docs/dashboard/assets/styles.css` |
| 통합 테스트 | `src/test/kotlin/com/snuti/exparchiveserver/InterestLectureIntegrationTest.kt` |

## IntelliJ에서 로컬 테스트하기 (Windows)

1. GitHub Desktop에서 **Current branch**를 `feat/interest-course-app-flow`로 바꾸고 **Fetch origin → Pull origin**을 누릅니다.
2. **Repository → Open in IntelliJ IDEA**로 프로젝트를 엽니다.
3. IntelliJ에서 Gradle 동기화가 끝날 때까지 기다립니다. Project SDK와 Gradle JVM은 JDK 17로 맞춥니다.
4. 백엔드 테스트만 먼저 실행합니다. IntelliJ Terminal에서:

   ```powershell
   .\gradlew.bat test --tests "com.snuti.exparchiveserver.InterestLectureIntegrationTest"
   ```

   이 테스트는 H2 임시 DB를 사용하므로 Docker/MySQL 없이도 실행됩니다.

5. 전체 테스트는 다음 명령입니다.

   ```powershell
   .\gradlew.bat test
   ```

6. 실제 앱 화면을 확인하려면 Docker MySQL을 실행하고 `Application.kt`를 실행합니다. 그 다음 IntelliJ에서 `docs/dashboard/index.html`을 열어 브라우저 미리보기로 실행하고 API 주소에 `http://localhost:8080`을 저장합니다.

7. 관리자 화면까지 확인하려면 **로컬 개발 DB에서만** 테스트 계정의 역할을 `ADMIN`으로 바꿉니다. 운영 DB나 Cloud Run DB에서 이 방법을 쓰지 마세요.

   ```sql
   UPDATE users
   SET role = 'ADMIN'
   WHERE email = '내테스트계정@example.com';
   ```

8. 브라우저 앱에서 관리자 계정으로 다시 로그인해 **내 정보 → 새 강좌 게시**을 열고, 예시 강좌와 `신약개발` 키워드를 저장합니다.
9. 일반 사용자로 다시 로그인해 **내 정보 → 관심 강좌 설정 → #신약개발 저장 → 관심** 순서로 추천 강좌를 확인합니다. **검색** 탭에서 `#신약개발` 칩을 눌러도 같은 공개 강좌가 보여야 합니다.

## GitHub 작업 순서

이 작업 브랜치는 이전 모바일 앱 PR 위에 쌓여 있습니다. 병합 순서는 반드시 다음과 같습니다.

1. PR #1 라이브 대시보드
2. PR #2 관심 키워드 서버
3. PR #3 휴대폰형 앱
4. 이 관심 강좌 앱 흐름 PR

IntelliJ에서 수정한 뒤에는 GitHub Desktop의 **Changes → Commit to feat/interest-course-app-flow → Push origin** 순서로 올립니다. GitHub Actions의 테스트가 모두 통과한 뒤에만 다음 단계로 병합하세요.
