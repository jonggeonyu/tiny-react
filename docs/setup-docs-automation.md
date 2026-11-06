
이 프로젝트에 문서 자동화를 설정해 줘.
대상 폴더는 현재 구현 폴더야.
먼저 폴더의 현재 상태를 확인하고, 이미 있는 파일은 덮어쓰지 말고 필요한 부분만 추가해 줘.

## 목표
- 함수와 클래스의 설명은 JSDoc 주석에서 `docs/api.md`로 자동 생성한다.
- 구조와 설계 이유는 `docs/architecture.md`에 기록한다.

## 작업
1. `package.json`이 없으면 `npm init -y`로 만든다.
2. `jsdoc-to-markdown`을 개발 의존성으로 설치한다.
3. `package.json`의 `scripts`에 다음 명령을 추가한다.
   "docs": "jsdoc2md \"src/**/*.js\" > docs/api.md"
4. `CLAUDE.md` 맨 아래에 다음 내용을 추가한다.

   ## 문서화
   - 내보내는 함수와 클래스에는 JSDoc을 작성한다.
   - `docs/api.md`는 자동 생성 파일이므로 직접 고치지 않는다.
   - 구조나 설계가 바뀌면 `docs/architecture.md`에 변경 내용과 이유를 적는다.

5. `docs/architecture.md`가 없으면 제목과 `모듈 구조`, `설계 결정` 절만 있는 빈 문서로 만든다.
6. `src/`에 `.js` 파일이 있으면 `.claude/settings.json`에 다음 Stop 훅을 등록한다.
   기존 설정이 있으면 지우지 말고 합친다.

   {
     "hooks": {
       "Stop": [
         { "hooks": [{ "type": "command", "command": "npm run docs" }] }
       ]
     }
   }

   `src/`에 `.js` 파일이 없으면 훅은 등록하지 말고, 첫 소스 파일을 만든 뒤 등록을 제안해 줘.

## 검증
- JSDoc이 달린 임시 파일을 `src/`에 만들고 `npm run docs`를 실행한다.
- `docs/api.md`에 함수 설명이 들어갔는지 확인한다.
- 임시 파일을 지우고, 임시 내용이 `docs/api.md`에 남지 않게 정리한다.
- 임시 파일을 만들면서 생긴 빈 `src/` 폴더는 그대로 둬도 된다.

## 지킬 것
- 위에 적은 패키지 외에는 설치하지 않는다.
- 미니 리액트 기능 코드는 작성하지 않는다.
- git 커밋과 push는 하지 않는다.

끝나면 바뀐 파일, 검증 결과, 훅 등록 여부를 알려 줘.


- JSDoc 설명은 한국어로 쓰고, 태그와 타입, 인자 이름은 영어로 둔다.