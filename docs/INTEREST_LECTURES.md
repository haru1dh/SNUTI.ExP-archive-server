# 관심 강좌 기능

## 동작

관리자는 강연을 만들거나 수정할 때 tags에 키워드 이름을 넣습니다.

~~~json
{
  "title": "신약개발 특강",
  "tags": ["신약개발", "바이오"]
}
~~~

로그인한 사용자는 이미 생성된 태그 ID를 관심 키워드로 저장합니다. 사용자가
신약개발을 선택하면, 신약개발 태그를 하나 이상 가진 PUBLISHED 강연이
관심 강좌 목록에 나타납니다. 여러 관심 키워드는 OR 조건으로 처리합니다.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | /tags | 선택 가능한 키워드 목록 |
| GET | /users/me/interests | 로그인한 사용자의 관심 키워드 |
| PUT | /users/me/interests | 관심 키워드 전체 저장 또는 초기화 |
| GET | /lectures/recommended | 관심 키워드와 일치하는 공개 강연 |

PUT /users/me/interests body:

~~~json
{ "tagIds": [3, 7, 12] }
~~~

빈 배열은 관심 키워드를 모두 해제합니다. 사용자 ID나 이메일을 요청 body로
받지 않고, JWT의 로그인 사용자만 자신의 설정을 변경할 수 있습니다.

## 데이터 모델

~~~text
users ──< user_interest_tags >── tags ──< lecture_tags >── lectures
~~~

user_interest_tags에는 (user_id, tag_id) unique 제약이 있어 같은 키워드를
중복으로 저장할 수 없습니다.
