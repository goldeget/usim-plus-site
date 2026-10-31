# 클라임유심 공식 정보·전 페이지 문단 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 사용자의 별도 지시 없이 구현을 시작하거나 하위 에이전트를 생성하지 않는다.

**Goal:** 푸터 연결 페이지부터 메인·관리자·오류 화면까지 서비스 사실과 한국어 문단을 일치시킨다.

**Architecture:** 고정 운영 사실과 기존 CMS 지급 조건을 공통 로더로 결합한다. 같은 데이터를 최초 HTML·메타데이터·JSON-LD·공개 JSON·llms.txt에 사용하며, 기존 copy-typography.css를 공통 문단 기준으로 정리한다. 계약/정산 시스템 또는 신규 정책 DB는 만들지 않는다.

**Tech Stack:** Cloudflare Pages Functions, D1 기존 site_content, HTML/CSS/JavaScript ES modules, Node >=22 내장 테스트, 기존 로컬 Wrangler D1/R2. 시각 검증은 사용 가능한 브라우저 도구로 수행한다.

**Spec:** [최종 아키텍처](../specs/2026-11-01-platform-facts-typography-design.md)

## Global Constraints

- 이용 비용은 0원, 별도 계약서 작성 없음, 이용자의 별도 통신요금 납부 없음.
- 적용 대상·진행 희망·조건 충족·지급 확정은 별도 단계다.
- 생성 후기·활동 수치 내용/데이터/로직 유지. 신규 실적 근거·평가 스키마로 사용하지 않는다.
- 기존 CMS schemaVersion 4와 API 호환성 유지. 기존 사용자 수정값·금액·개인정보·인증 흐름 보존.
- 공통 줄바꿈 breakpoint 760px. 문장마다 무조건 강제 개행하지 않는다.
- 문서에 시크릿·개인정보·운영 데이터 원본을 남기지 않는다.
- 실제 외부 채널 수정·메시지 발송·remote migration·main push·사이트/환경 게시 없음.
- 기존 체크아웃 사용. 사용자의 요청 없이 worktree 생성 안 함.
- 아래 실행 체크박스는 모두 미실행이다. 이 문서 작성은 구현 완료가 아니다.

## Review Focus

1. 구 CMS/열린 편집기가 필수 비용 안내를 없애거나 운영자가 바꾼 링크·금액을 되돌리지 않는가? → Task 2, 6.
2. 일반 개행 정규화가 URL·코드·HTML 안전성을 훼손하지 않는가? → Task 3, 6.
3. 글꼴 fallback·200% 확대·긴 토큰에서 keep-all/nowrap이 화면을 넘치게 하지 않는가? → Task 3, 7.
4. 캐시·DB 실패에서 본문·구조화 데이터·금액이 서로 다른 값을 안내하지 않는가? → Task 2, 6.
5. 공통 CSS 변경이 후기·활동 동작, 관리자 폼/테이블, 호스트 보호를 손상하지 않는가? → Task 1, 5, 7.

## 파일 책임 지도

| 영역 | 파일 |
| --- | --- |
| 공식 정보 신규 | `functions/_lib/service-facts.js`, `functions/_lib/public-information.js` |
| 문단·공개 HTML 신규 | `functions/_lib/copy-renderer.js`, `functions/_lib/public-page-renderer.js` |
| 구조화 데이터 신규 | `functions/_lib/structured-data.js` |
| 신규 공개 화면/API | `public/service-facts/index.html`, `functions/service-facts/index.js`, `functions/api/service-facts.js`, `functions/llms.txt.js` |
| 기존 서버 통합 | `functions/index.js`, `functions/guide/index.js`, `functions/api/content.js` |
| 푸터 페이지 서버 라우트 신규 | `functions/about/index.js`, `functions/structure/index.js`, `functions/disclosures/index.js`, `functions/disclosures/service/index.js`, `functions/disclosures/safety/index.js`, `functions/disclosures/privacy/index.js` |
| 공통 CSS | `public/copy-typography.css`, `public/topics/topics.css`, `public/user-flow.css`, `public/premium.css` |
| 주요 HTML | `public/index.html`, `public/about/index.html`, `public/structure/index.html`, `public/guide/index.html`, `public/disclosures/index.html` 및 고지 하위 3 HTML |
| 나머지 화면 | `public/links/index.html`, `public/reviews/index.html`, `public/admin/*.html`, `public/admin/admin-shell.css`, `public/admin/applications.css`, `public/404.html`, `functions/_lib/retired-investment.js`의 HTML 템플릿 |
| CMS 클라이언트 | `public/admin/content-editor.js`, 기존 홈 inline renderer 및 실제 동적 UI 작성 코드 |
| SEO | `public/sitemap.xml`, `public/llms.txt`, `functions/robots.txt.js` 필요한 부분만 |
| 문서 | README 및 이번 두 문서의 실행 기록; 이전 문서에는 후속 문서 링크로 역사 구분 |

## Task 1: 기준선과 보호 목록 확정

**선행 게이트:** [AI 검색 근거 조사](../../ai-search-evidence-2026-11-01.md)의 미완료 항목을 먼저 수행한다. 네트워크 차단·실제 AI 접근·사업자 등록 확인·비교 범위 검증 상태를 기록하고, 조사 결과 없이 검색 효과를 가정해 구현하지 않는다.

**Files:** 신규 `docs/validation/2026-11-01-platform-patch-baseline.md` (실행 시 작성).

**Interfaces:** 이후 작업은 git 기준선·테스트 결과·보호 대상 SHA-256 목록을 소비한다.

- [ ] `git status --short`와 실제 HEAD를 기록하고 기존 변경과 이번 변경을 구분한다.
- [ ] `node --version`, `npm test`를 실행하고 실제 개별 테스트 수·실패·skip을 기록한다. 과거의 202개 통과를 새 실행 결과로 쓰지 않는다.
- [ ] 푸터 링크 및 실제 제공되는 공개·관리자 화면을 목록화하고 리다이렉트/410/인증 화면을 구분한다.
- [ ] `public/reviews/data/**`, `public/reviews/review-corpus.js`, `public/live-activity.js`, `scripts/generate-review-rows.mjs` 및 실제 연결된 리뷰 생성·새로고침 코드의 SHA-256을 저장한다.
- [ ] `public/live-activity.css`는 기본 보존. 활동 영역의 타이포그래피는 공통 CSS로 처리하며 업무 동작 변경 없음.
- [ ] 로컬 D1 마이그레이션·Pages 서버를 실행하고 홈/guide/content/reviews, 업로드 410의 실제 응답 기준선을 기록한다. 운영 DB는 접근하지 않는다.
- [ ] 원본 페이지 스크린샷을 확보한다. 시각 검사 도구가 없으면 설치/사용 가능한 공식 도구를 확인하고, 불가능한 항목은 미검증으로 명시한다.

## Task 2: 공식 사실과 기존 CMS의 공통 원본

**Files:** 신규 `service-facts.js`, `public-information.js`, `test/service-facts.test.js`; 수정 `functions/api/content.js`.

**Interfaces:** `SERVICE_FACTS`; `loadPublicInformation(env): Promise<PublicInformation>`. 반환 구조는 설계 4절을 따른다. `payout`은 기존 CMS 값 그대로이며 최대액은 계산한다.

- [ ] `test/service-facts.test.js`에 비용 `0`, 계약서 `false`, 별도 요금 `false`, 참여 흐름 순서·정의 문구 테스트를 추가한다.
- [ ] CMS에 다른 금액/채널을 넣은 fixture가 그대로 유지되는지, 손상 JSON/DB 오류에서 `contentSource='default'`가 되는지 테스트한다.
- [ ] `node --test test/service-facts.test.js`를 실행해 신규 기능이 없어 실패함을 확인한다.
- [ ] 기존 콘텐츠 정규화/검증을 공통 읽기 경로로 추출한다. 인증·쓰기 코드는 이동하지 않는다. 기존 API 응답 키는 바꾸지 않는다.
- [ ] `SERVICE_FACTS`와 공통 로더를 구현한다. 코드 버전 외에 근거 없는 정책 시행일·지급 기한을 생성하지 않는다.
- [ ] `node --test test/service-facts.test.js test/content-api.test.js` 통과를 확인한다.
- [ ] 독립 리뷰 가능한 diff를 확인하고, 커밋은 구현 세션의 허용 범위에서 수행한다. push는 하지 않는다.

## Task 3: 공통 문단·줄바꿈 기반

**Files:** 신규 `copy-renderer.js`, `test/copy-renderer.test.js`; 수정 `public/copy-typography.css`.

**Interfaces:** `normalizeCopy(text: string): string`, `renderParagraphs(text: string): string` (HTML escape 후 신뢰된 마크업만 생성). 문단 wrapper는 호출자가 제공한다.

- [ ] LF/CRLF, 빈 줄, 카피의 리터럴 개행, `<script>`/인용부호/앰퍼샌드, 장문 fixture로 정확한 문단·escape 결과 테스트를 작성한다.
- [ ] `node --test test/copy-renderer.test.js` 신규 실패를 확인한다.
- [ ] 카피 전용 정규화·문단 렌더러를 구현한다. URL/설정/JSON 전체에 정규식을 전역 적용하지 않는다.
- [ ] 기존 760px 기준을 유지하며 문장/의미 구간 span·본문 너비·행간·간격·긴 토큰 클래스를 정리한다.
- [ ] `min-width:0`, 모바일 1열, 버튼 높이 자동 확장, 텍스트 clamp 예외를 공통 컴포넌트에 적용한다. 전체 overflow 숨김 금지.
- [ ] 고정 카피의 숫자·단위를 짧게 묶고 긴 문장에 nowrap을 사용하지 않는다.
- [ ] `node --test test/copy-renderer.test.js` 통과 및 320/760/761/1440px 샘플의 실제 렌더링을 확인한다. CSS 문자열 존재만으로 줄바꿈 완료 판정하지 않는다.

## Task 4: 푸터 연결 페이지부터 구현

**Files:** 파일 지도 내 푸터 7 HTML, 페이지별 신규 Functions, `public-page-renderer.js`, 신규 `test/footer-information.test.js`.

**Interfaces:** `renderPublicPage(context, pageKey): Promise<Response>`; `pageKey`는 `about|structure|guide|disclosures|service|safety|privacy|facts`. GET HTML만 변환하고 비HTML·오류·다른 메서드는 기존 응답 유지. 필요한 경우 guide 기존 코드를 이 래퍼에 위임한다.

- [ ] 먼저 `/about/`의 정의와 운영사, `/structure/`의 참여 순서를 검증하는 fixture 기반 테스트를 작성하고 신규 실패를 확인한다.
- [ ] `/about/`를 운영 주체·플랫폼 역할·공식 문의 순서로 정리한다.
- [ ] `/structure/` URL은 유지하고 제목·메뉴를 ‘이용 절차’로 바꾼다. 미확인 가입 유치 재원 설명을 공식 사실로 유지하지 않는다.
- [ ] `/guide/`에서 CMS 금액·조건·최대 건수를 같은 응답 스냅샷으로 렌더링한다. 날짜·기한 미확정 값을 임의 작성하지 않는다.
- [ ] `/disclosures/`에서 비용·참여·문의 요약과 하위 3개 링크를 정리한다.
- [ ] `/disclosures/service/`의 계약·요금·재원 추정 설명을 실제 플랫폼 정의로 정정한다.
- [ ] `/disclosures/safety/`에서 공식 채널 확인·개인정보 최소화 안내를 유지하고, 실제로 내용이 없는 절로 연결하는 링크를 고친다.
- [ ] `/disclosures/privacy/`는 실제 상담 처리와 과거 홈페이지 보관 규칙을 구분한다. 확인 안 된 수집 항목·보관 기간을 생성하지 않는다.
- [ ] 신규 Functions에서 최초 HTML에 핵심 설명을 렌더링하고 공통 data 슬롯의 누락을 검증한다. 정적 fallback도 고정 사실이 맞도록 작성한다.
- [ ] 푸터 링크와 운영사 행을 통일하고 페이지별 단순 광고성 description을 목적에 맞게 변경한다.
- [ ] `node --test test/footer-information.test.js test/marketing-guide.test.js test/guide-edge-render.test.js test/seo.test.js`를 실행한다. 이전 잘못된 카피 기대값은 새 요구로 바꾸되 의미 있는 동작 assertion을 삭제하지 않는다.
- [ ] 7페이지 각각 360/390/1440px 시각 확인 후 단계 완료로 표시한다.

## Task 5: 메인과 나머지 전 화면

**Files:** `public/index.html`, `functions/index.js`, links/reviews HTML, admin HTML/CSS, `public/404.html`, 레거시 410 템플릿. 동적 화면 코드는 실제 발견한 생성 지점만 수정.

**Interfaces:** 기존 DOM id·CTA·CMS 연결 유지. Task 2의 공식 사실과 Task 3의 문단 렌더러 사용.

- [ ] 홈 최초 HTML의 정의·비용·진행 흐름, JS 후 동일성, 조회 버튼 목적·상담 CTA를 기존 `public-page.test.js`, `public-content-metadata.test.js`에 검증한다. 요구에 맞는 실패를 확인한다.
- [ ] 히어로를 ‘유심 혜택 확인’, 보조 문단을 ‘희망 시 진행 지원·조건 충족 시 지급’으로 정리한다. 비용 0원과 별도 요금 없음을 독립된 안내로 배치한다.
- [ ] 기존 HTML/CMS/inline JS가 이 문구를 덮는 모든 경로를 맞춘다. 토큰·금액을 하드코딩하지 않는다.
- [ ] 후기·활동 DOM 데이터/이벤트 연결은 유지하고 바깥 레이아웃·CSS로만 줄바꿈을 조정한다.
- [ ] `/links/`, `/reviews/`의 제목·버튼·카드·푸터, 후기 상세/빈 상태/오류 상태를 확인한다. 후기 본문 텍스트와 표시값은 바꾸지 않는다.
- [ ] 관리자 `index`, `login`, `content`, `review`, `reviews`, `applications`, `duplicates`를 각각 점검한다. 로그인 실패·권한 없음·폼 오류·표·모달도 포함한다.
- [ ] 관리자 공통 CSS가 공개 페이지에 영향을 주지 않도록 범위를 제한한다. 공개 typography 로딩 시 기존 관리자 스타일과 충돌을 제거한다.
- [ ] 404와 레거시 410 HTML에 공통 문단 규칙을 적용하고 실제 상태 코드를 유지한다. JSON API 응답을 HTML로 바꾸지 않는다.
- [ ] `node --test test/public-page.test.js test/public-content-metadata.test.js test/admin-auth.test.js test/admin-middleware.test.js test/retired-investment-paths.test.js test/not-found-page.test.js` 통과를 확인한다.

## Task 6: CMS·검색 출력·공식 정보 요약 일치

**Files:** 기존 CMS API/editor, `structured-data.js`, 신규 facts HTML/Function/API, llms Function, sitemap 및 관련 SEO 테스트.

**Interfaces:** `buildPublicStructuredData(info, page): object`; Task 2 스냅샷 소비. `/api/service-facts`는 공개 정보만 JSON 반환하고 GET 외에는 405.

- [ ] 새 `test/public-information-consistency.test.js`에 CMS 금액/링크 변경 후 홈·가이드·facts·JSON-LD·llms가 같은 값을 내는지 검증한다.
- [ ] 구버전 editor payload와 사용자 수정 카피 fixture로 저장 후 값 보존을 검증하고, 필수 사실 슬롯이 사라지지 않음을 확인한다.
- [ ] DB 장애 시 응답 내 fallback 금액 일치, source 구분, 캐시 hit/miss와 발행 후 무효화를 검증하는 테스트를 추가한다.
- [ ] `node --test test/public-information-consistency.test.js`에서 실패를 먼저 확인한다.
- [ ] 신규 `/service-facts/`를 의미 있는 요약·상세 링크로 구현한다. API·llms 응답도 같은 정보에서 생성한다.
- [ ] 고정 사실과 자유 편집 카피를 분리한다. 정규화는 카피 필드에서만 수행하고 editor 미리보기는 textContent/DOM API로 구성한다.
- [ ] 운영 CMS 값의 변환은 정확히 식별 가능한 과거 기본 문구에 한정한다. 실제 운영 쓰기는 백업과 별도 지시 없이 하지 않는다.
- [ ] Organization/Service ID와 페이지별 title/description/OG를 일치시킨다. 사실 확인 안 된 founder 및 신규 Review/AggregateRating을 추가하지 않는다.
- [ ] facts/고지 하위 페이지의 index 여부·canonical·sitemap을 맞추고 기존 robots/admin/preview/topics 정책을 유지한다.
- [ ] CMS 발행 때 홈뿐 아니라 공통 정보 사용하는 응답의 실제 캐시 키를 모두 무효화한다. 여러 페이지 응답의 변경은 최대 기존 TTL 범위에서 수렴함을 명시한다.
- [ ] `node --test test/public-information-consistency.test.js test/content-api.test.js test/seo.test.js test/public-readable-seo.test.js` 통과를 확인한다.

## Task 7: 전 페이지 완료 판정

**Files:** 신규 `docs/validation/2026-11-01-platform-patch-results.md` 및 외부 또는 ignored 스크린샷 산출물. 재사용 브라우저 자동화가 필요한 경우 `scripts/check-page-layout.mjs`를 추가하고 도구 버전/실행법을 기록한다.

**Interfaces:** Task 1의 보호 해시·기준선과 전 작업의 실제 실행 결과를 소비한다.

- [ ] `npm test` 전체를 실행한다. 실패/skip/미실행을 구분하며 실제 테스트 수를 기록한다.
- [ ] 로컬 D1/R2 Pages 환경을 시작하고 최초 HTML·콘텐츠 API·facts API·llms와 404/410/301/308/preview/admin 동작을 HTTP로 검증한다.
- [ ] 페이지·상태별 검수표에 320/360/390/430/768/1024/1440px 결과를 기록한다. 759/760/761px 경계도 확인한다.
- [ ] Chromium·Firefox·WebKit에서 핵심 푸터·홈·관리자 폼을 확인한다. 사용 불가 브라우저를 통과로 표시하지 않는다.
- [ ] 문서 전체의 scrollWidth가 viewport보다 커지지 않는지 확인한다. 의도된 표 내부 스크롤은 구분한다.
- [ ] 200% 실제 확대·가능한 400% reflow, 대체 글꼴, 가로 모드, 긴 주소/URL, 장문 2~3배 CMS fixture를 확인한다.
- [ ] 버튼 잘림·줄 중간 단위 분리·너무 짧은 강제 개행·여백 과다·모달 겹침·초점 이동을 스크린샷으로 검토한다.
- [ ] 로딩·빈 결과·API 실패·폼 오류·로그아웃 상태도 실제로 표시해 검사한다. 관리자 보안을 완화해서 검사하지 않는다.
- [ ] 보호 대상 해시와 후기·활동 표시 동작이 기준선과 동일함을 확인한다. `build:reviews`, seed 및 원격 refresh는 실행하지 않는다.
- [ ] 실행 기록의 모든 미완료·한계를 명시하고 `git diff --check`, diff·untracked 파일을 확인한다. 무관한 파일은 변경하지 않는다.
- [ ] 구현 완료 요약·변경 파일·운영 CMS 조치·롤백 절차를 준비한다. main push/배포는 하지 않는다.

## 배포가 별도로 지시된 이후의 체크리스트

- [ ] 배포할 정확한 diff/commit과 배포 트리거를 확인한다. 환경 Publish와 사이트 배포를 혼동하지 않는다.
- [ ] 운영 CMS 변환이 필요하면 원본을 비공개로 백업하고 승인된 대상 문구만 적용한다.
- [ ] 배포 후 실제 public/admin/preview 호스트에서 HTTP 상태·HTML·캐시·링크·핵심 화면을 확인한다.
- [ ] Search Console/네이버 재수집 작업은 해당 접근권한과 실행 지시가 있을 때 수행한다.
- [ ] Gemini 등은 질문·날짜·서비스 정의·금액·비용·인용 URL을 기록한다. 표본 답변을 전체 AI 인식의 보장으로 보고하지 않는다.
- [ ] 외부 채널은 정정 초안까지만 준비하며 실제 수정·발송은 별도 지시 후 수행한다.

## 문서 자체 확인

- [x] 실제 푸터 링크·고지 하위·공통 CSS·서버 렌더링 파일 확인.
- [x] 사용자의 비용·계약서·통신요금 설명과 후기/활동 보존 범위 반영.
- [x] 설계 요구를 Task 1~7에 연결하고 인터페이스 이름·반환값을 대조.
- [x] 코드 구현과 배포를 미실행으로 구분.
- [ ] 코드 작업 실행 및 운영 반영 완료 — 본 문서 작성만으로 체크하지 않음.

## 최종 품질 게이트 — 모두 증거로 확인한 후 완료

- [ ] 모든 실제 제공 URL·상태를 목록화하고 누락 페이지가 없는지 확인한다. 관리자·동적 상세·오류·로딩·빈 상태를 포함한다.
- [ ] 페이지별 사실 대조표를 작성한다: 정의/대상/비용0원/계약서없음/별도요금없음/진행희망/조건/보상금/운영사/채널. 페이지에서 필요 없는 항목은 해당 없음으로 명시한다.
- [ ] 최초 HTML·JS 적용 후·CMS 응답·JSON-LD·llms·공개 JSON 사이의 사실 모순이 0건임을 확인한다.
- [ ] 내구제/불법대출/스미싱/보이스피싱/대포폰 관련 노출을 문맥별 조사하고, 자사 서비스와 잘못 연결하는 설명·메타데이터를 정정한다. 안전 안내·실제 조건은 일괄 삭제하지 않는다.
- [ ] 중복 원본·중복 DOM ID·잘못된 canonical/JSON-LD 중복·상충 CSS를 점검한다. 필수 고지의 일관된 반복은 보존한다.
- [ ] 알려진 미해결 기능 오류·JS 예외·깨진 내부 링크·리소스 실패·정보 표시 오차·레이아웃 잘림이 없음을 검증 기록에 연결한다.
- [ ] ‘통과/실패/미검증/해당 없음’을 구분한다. 필요한 검증이 미실행이면 ‘완벽/오류0’으로 보고하지 않는다.
- [ ] 후기·활동 보호 해시와 데이터 보존을 확인하고, 해당 내용의 진실성을 이번 작업에서 검증했다는 주장 또는 이를 이용한 신규 신뢰 보강이 없는지 확인한다.
- [ ] 배포 후 AI 점검은 실제 운영 방식의 정확성·자사 행위 오단정·인용 출처로 평가한다. 외부 AI 답변의 절대적 보장을 완료 조건으로 제시하지 않는다.
