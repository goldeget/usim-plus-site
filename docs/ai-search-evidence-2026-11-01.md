# AI 검색 답변 근거 조사 — 공식 문서 확인 및 남은 검증

확인일: 2026-11-01 (Asia/Seoul), 실행 환경 UTC 2026-10-31. 이 문서는 공식 문서 조사 결과이며 실제 AI 답변 대조 완료 보고서는 아니다. HTTPS 프록시와 TLS 검증을 유지했다. 런타임 정책은 `enforced`, 관찰은 `observations_current: true`였다. 원본 요청 상태는 [fetch-observations-2026-11-01.json](research/fetch-observations-2026-11-01.json)에 기록했다.

## 공식 문서에서 직접 확인한 범위

| 제품·출처 | 관찰한 문구와 의미 | 적용 한계 |
| --- | --- | --- |
| [Google Search AI features](https://developers.google.com/search/docs/appearance/ai-features), HTTP 200 | “There are no additional requirements to appear in AI Overviews or AI Mode”; 지원 링크가 되려면 페이지가 색인되고 검색 스니펫 표시 대상이어야 한다. robots/CDN 접근, 내부 링크, 중요 정보의 텍스트 제공, 보이는 텍스트와 구조화 데이터의 일치를 권한다. | Google Search AI Overviews/AI Mode에 관한 설명이다. Gemini 앱의 내부 검색·순위 규칙으로 일반화하지 않는다. 크롤·색인·노출은 보장하지 않는다. |
| 같은 Google 문서 | “You don't need to create new machine readable files, AI text files, or markup”; 특별한 schema.org 데이터도 필요하지 않다. | llms.txt 또는 전용 AI 마크업을 노출의 필수 조건이나 답변 교정 장치로 제안할 근거가 없다. |
| [Google 구조화 데이터 소개](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data), HTTP 200 | “don't add structured data about information that is not visible to the user, even if the information is accurate.” JSON-LD 지원을 설명한다. | 숨겨진 사업 검증 주장, 비교 기능, 보장 내용을 JSON-LD에만 추가하지 않는다. 구조화 데이터는 특정 답변을 보장하지 않는다. |
| [Gemini Apps 관련 출처](https://support.google.com/gemini/answer/14143489?hl=en), HTTP 200 | “Not all responses include related links or sources.” 출처 버튼이나 본문 링크에 관련 출처가 표시될 수 있다. 웹사이트 외에 업로드 파일·연결된 Workspace 자료도 가능하다. | 이 페이지는 출처 표시 안내다. 모든 답변의 웹 검색 실행, 인용의 완전성, 인용된 모든 문장이 정확함을 보증하지 않는다. 현재 문서 본문에는 double-check 동작 설명이 없어 이를 이 URL의 확인 사실로 적지 않는다. |
| [xAI Web Search](https://docs.x.ai/developers/tools/web-search), HTTP 200 | API의 `web_search` 도구가 실시간 웹 검색·페이지 탐색을 수행한다고 설명한다. `allowed_domains`/`excluded_domains`는 각각 최대 5개이며 동시에 설정할 수 없다. | 개발자 API 도구 문서다. 소비자 Grok 앱의 기본 검색 여부·내부 순위·동일 답변은 확인하지 못했다. 사이트 소유자가 이 필터를 제어한다는 뜻도 아니다. |
| [xAI Citations](https://docs.x.ai/developers/tools/citations), HTTP 200 | `citations`는 검색 과정에서 만난 출처 URL 목록, inline citations는 본문 참조 링크다. “Enabling inline citations does not guarantee that the model will cite sources on every answer.” | 만난 URL 목록과 특정 주장의 직접 근거를 구분해야 한다. API 인용을 소비자 앱에서 관찰한 인용으로 보고하지 않는다. |

## 접근 결과와 확인하지 못한 사실

- [ChatGPT Search 안내](https://help.openai.com/en/articles/9237897-chatgpt-search): HTTP 403, 본문 `error code: 1010`. 허용 목록 추가 후에도 본문을 읽지 못했다. 따라서 검색 공급자·자동 검색 조건·인용 방식에 관해 이 세션에서 직접 확인했다고 주장하지 않는다.
- [OpenAI bots](https://platform.openai.com/docs/bots): 원 주소는 HTTP 301로 `https://developers.openai.com/api/docs/bots`에 이동한다. 최종 호스트에서 프록시 CONNECT 403이 발생했다. `developers.openai.com` 허용이 추가로 필요하다. GPTBot/OAI-SearchBot/ChatGPT-User 구분은 이번 조사에서 원문 확인 미완료다.
- `https://climekr.com/`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`: 모두 HTTP 403. `https://www.climekr.com/`도 HTTP 403, 본문 `error code: 1010`. 이 응답은 실제 HTML·CMS·JSON-LD·robots 내용을 보여주지 않는다. 원 서버 전체 장애, 검색 로봇 차단, 파일 부재라고 결론 내릴 수 없다. 사용자 브라우저나 검색 크롤러가 동일 응답을 받는지도 미확인이다.
- 사용자 제공 Gemini 답변에 climekr.com 및 Instagram 인용이 있다는 기존 기록은 유지한다. 해당 답변 전체·외부 게시물 원문·실제 검색 과정은 이번에 재현하거나 독립 검증하지 못했다.
- 저장소의 서울평가정보㈜ / 사업자등록번호 114-81-47958 표시는 사이트 자체 주장이다. 공적 등록, 사업 상태, 운영사 동일성 검증은 미완료다. 사업자등록을 인허가·무위험·보상금 지급 보장으로 확장하지 않는다.
- 홈 조회 및 CMS 기본 URL은 `https://www.credit.or.kr/credit/search`라는 기존 코드 관찰이 있다. 외부 조회의 실제 기능·혜택 비교 범위·현재 운영 CMS 값은 미확인이다. 확인한 코드 범위에서 복수 혜택 비교 엔진·목록을 찾지 못했다는 기존 기록을 유지한다.

## 구현에 사용할 수 있는 결론

1. 서비스 정의·운영 주체·제공 범위·진행 절차·비용 조건을 이용자가 읽을 수 있는 본문에 명료하게 제공한다. 표시되는 사실과 title/description/Organization/Service 등 구조화 데이터를 일치시킨다. 이는 Google의 확인된 권고와 맞지만 AI 답변 교정·검색 노출 보장은 아니다.
2. 비교 대상·기준·갱신 주체가 확인되기 전에는 ‘혜택 비교 플랫폼’, ‘모든 혜택 비교’ 또는 비교 엔진 보유를 구현 사실로 쓰지 않는다. 현재 확인 가능한 범위의 ‘혜택 확인·조건 안내·희망 시 진행 지원’ 표현을 우선 검토한다. 구체적 서비스 사실은 운영 측 확인을 반영해야 한다.
3. 회사명·사업자번호는 공개 표기 정보로 안내할 수 있으나 ‘공적 검증 완료’ 배지나 등록 검증 결과를 새로 만들지 않는다. 무료 범위·별도 비용·지급 조건은 확인한 약관/운영 정책 범위만 적는다.
4. AI용 숨김 문장·특별 schema·llms.txt를 우선 해결책으로 추가하지 않는다. 먼저 읽을 수 있는 본문, 의미 있는 내부 링크, 검색 가능성 및 실제 배포 응답을 확인한다. 운영 403은 배포/호스팅 측에서 실제 크롤러 접근 결과와 함께 조사할 사안이다.
5. 생성 후기·활동 수치는 사용자 보존 요구대로 유지한다. 사업자등록·실제 지급·실제 고객 수의 검증 근거로 재사용하거나 구조화 데이터로 신뢰 근거를 확대하지 않는다.

## 실제 답변 대조 — 미실행

Google Search AI Overviews/AI Mode, Gemini 앱, ChatGPT Search, 소비자 Grok 앱 모두 이번 세션에서 동일 질문을 실행하지 못했다. 연결된 소비자 검색 도구·계정이 없고 런타임의 사용 가능한 API 자격 증명도 확인되지 않았다. 공식 문서 접근 성공을 AI 검색 결과 재현으로 취급하지 않는다. API 호출 역시 수행하지 않았다.

향후 각 제품에서 다음 네 질문과 CLIME/climekr 명칭 변형을 실행하고 제품·모델 표시·검색 활성 여부·시각·정확한 질문·답변·인용 URL을 함께 기록한다: ‘클라임유심은 어떤 서비스인가?’, ‘운영사와 사업자등록 근거는?’, ‘무엇을 비교하거나 확인하며 어떻게 진행하는가?’, ‘이용 비용과 별도 요금은?’ 한 번의 결과를 모든 이용자의 답변으로 일반화하지 않는다. 오류는 인용 원문 사실 오류/과거 정보/자사 누락/모델 추가 해석으로 구분하되 직접 관찰 근거가 없으면 미확인으로 남긴다.

남은 외부 의존성은 OpenAI 최종 문서 호스트 허용, 403 접근 문제 해소, 공식 사업자 확인 자료, 서비스/비교/비용 정책 확인, 실제 소비자 AI 검색 결과 수집이다. 외부 계정 게시물 수정이나 자격 증명 제출을 요구하지 않았다.
