# CLIME 플랫폼 패치 — 최종 아키텍처

기준: 저장소 `F:/usim-plus-site`의 공개 HTML, `functions/`, 네이버 블로그 문서, 사이트맵. 운영 숫자는 CMS 기본값(3일 5만 / 15일 +7만 / 30일 +10만, 건당 22만, 최대 3건, 총 66만)과 `public/llms.txt`를 따른다. 금액이 바뀌면 `functions/api/content.js`의 `payout`과 D1 `site_content`(`id=home`)가 원본이고, 정적 HTML에 박힌 66만원은 함께 고쳐야 한다.

## 현재 상태 스냅샷 (2026-10-28)

조사 범위: 워킹 트리·`git ls-files`·`npm test`(186 통과). `.env` / 시크릿 값은 읽지 않음.

### 배포·인프라 (이미 맞는 것)

| 항목 | 현재 |
| --- | --- |
| 호스팅 | Cloudflare **Pages** 프로젝트 `usim-plus-site` (`README.md`) |
| 빌드 | 없음. `wrangler.toml` → `pages_build_output_dir = "public"` |
| Functions | `functions/` — `_middleware.js`, `index.js`(홈 HTMLRewriter), `robots.txt.js`, `guide/index.js`, `api/*`, `navercb78a18ae519c02b17c8618a7b72822c.html.js` |
| 바인딩 | D1 `CONTENT_DB` → `usim-plus-content`; R2 `APPLICATIONS_BUCKET` → `usim-plus-applications`(비공개) |
| 배포 트리거 | GitHub `goldeget/usim-plus-site` **`main` 푸시** → Pages 자동 배포 (별도 `wrangler pages deploy` 문서 없음) |
| 공개 도메인 | `climekr.com`(canonical), `www.climekr.com` → **308** → apex (`functions/_middleware.js`) |
| 관리 | `admin.climekr.com` — 세션·D1 로그인; 공개 호스트에서 `/admin/*` → **404** |
| 프리뷰 | `*.pages.dev` — `robots.txt`에 Sitemap 없음, 응답에 **`noindex`** (`_middleware.js`, `robots.txt.js`) |
| 보조 Worker | `retention-worker.js` + `wrangler-retention.toml` — D1 메타 60일 정리 Cron (Pages와 **별도** `npx wrangler deploy --config wrangler-retention.toml`) |
| 로컬 | `npm test`; `npx wrangler d1 migrations apply … --local`; `npx wrangler pages dev public --local --port 8788` (`README.md`, `.dev.vars`는 gitignore) |

### 공개 URL·라우트 인벤토리

| 경로 | 역할 | 색인·사이트맵 | 비고 |
| --- | --- | --- | --- |
| `/` | 홈, 상담 CTA, `#contact`, `#payoutConditions` | sitemap O, index | `functions/index.js`가 title/description/첫 JSON-LD·`#homeIntro`를 D1/`DEFAULT_CONTENT`로 덮음 |
| `/about/` | CLIME 소개, `taxID` JSON-LD | sitemap O | **로컬에만 존재, git 미추적** — 배포 전 `git add` 필요 |
| `/guide/` | 혜택·조건 설명 | sitemap O | `functions/guide/index.js`가 지급표를 D1 `payout`으로 주입 |
| `/structure/` | 사업 구조·재원·유심 귀속·FAQ 4 | sitemap O | Organization `@id` = `https://climekr.com/structure/#organization` (**홈 `#organization`과 분리**) |
| `/reviews/` | 정적 코퍼스 후기(≈1만 건, D1 아님) | sitemap O | `public/reviews/data/*`, API는 static fallback |
| `/topics/` + 하위 8 | 급전·대출·직군 situational 클러스터 | **sitemap O**, robots **`Allow: /topics/`** | 아키텍처상 **P0 제거 대상** — 본문에 햇살론·비상금 등 |
| `/topics/usim-benefit/` | 유심 혜택 (제목에 대출·폰테크) | sitemap O | P0에서 `/structure/` 또는 `/guide/`로 301 검토 |
| `/links/` | 바이오·상담 링크 | sitemap X, **`noindex`** | |
| `/admin/*` | 운영 콘솔 | 공개 호스트 404; admin 호스트만 | |
| `/api/*` | content, reviews, applications(410), admin | robots Disallow | `GET /api/content` 공개 |
| `/terms`, `/privacy`, `/legal`, `/trust`, `/faq`, `/blog`, `/company` 등 | 레거시 투자 플랫폼 슬러그 | **410 Gone** | `functions/_lib/retired-investment.js` (**워킹 트리에 있으나 git 미추적** — `main` 배포 전 추적 필요) |
| `/disclosures/*` | (계획) 고지 | **없음** | P1 신규. 410 슬러그와 겹치지 않게 `/disclosures/`만 사용 |

정적 자산: `public/sitemap.xml`, `public/llms.txt`, `public/robots.txt`(동적 대체: `functions/robots.txt.js` on `climekr.com`), IndexNow `public/2cc7263262b5a365ad26c37e214acd2b.txt`, 네이버 HTML·메타 검증(`test/seo.test.js`).

### 콘텐츠·SEO — 이미 맞는 것 vs 갭

**맞는 것**

- 홈·가이드에 **보이지 않는 FAQPage 없음** (`test/public-readable-seo.test.js`, `functions/index.js`에 FAQPage 미생성).
- 홈 JSON-LD 그래프: Organization / WebSite / WebPage / Service 4종.
- `/about/`(로컬) Organization `taxID`, `@id` `https://climekr.com/#organization` 참조.
- canonical `https://climekr.com/…`, 네이버 site verification 메타·HTML 토큰.
- 상담은 홈 업로드 **410**; 신규는 텔레그램·채널톡(`README.md`, `POST /api/applications`).
- `npm test` **186/186 통과**(현재 카피·사이트맵·topics 포함 상태 기준).

**갭·리스크 (패치 전 그대로 노출)**

1. **주제 그래프**: `public/sitemap.xml`에 `/topics/` 9 URL; `public/llms.txt` 「주제별 정보 안내」 동일; 홈 **공감 카드** 3링크 → `/topics/urgent-money/` 등; 푸터 「상황별 안내」→ `/topics/`.
2. **메타·카피**: 홈 `#homeIntro`·`llms.txt`·가이드 H1에 **급전·폰깡·대출 부정** 반복; `test/seo.test.js`·`test/public-readable-seo.test.js`가 그 문장을 **의도적으로 고정**(캐논 전환 시 테스트 동시 수정 필수).
3. **조직 스키마**: 홈 `buildStructuredData` — `legalName`·email만; **taxID·주소·foundingDate·sameAs(블로그)** 없음. `/structure/`는 별도 Organization 노드 + 상세 주소·FAQPage.
4. **`public/live-activity.js`**: 홈에서 로드 중 — 시뮬레이션 상담 수·「지금 N명」·토스트(주석상 백엔드 없음).
5. **`/disclosures/`** 미구현; 약관형 슬러그는 410만 존재.
6. **Git vs 배포**: 다수 **수정(M) 미커밋**; `public/about/`, `retired-investment.js`, `docs/naver-blog-*.md`, `docs/clime-platform-patch-architecture.md` 등 **미추적**. `main` 푸시만으로는 추적·커밋된 파일만 프로덕션 반영.
7. **네이버 블로그**: 원고 `scripts/naver-blog/posts/` 6편; `checklist.md` 기준 **1편 발행 완료**; 카테고리·02/03 글은 아키텍처상 정렬 전; CDP 자동화 산출물은 저장소에 있으나 **운영 필수 아님**.

### 테스트·문서 앵커

| 파일 | 역할 |
| --- | --- |
| `test/seo.test.js` | title/description, sitemap, robots, llms, IndexNow, 네이버 토큰 |
| `test/public-readable-seo.test.js` | 가시 FAQ 부재, 한국어·CSS 줄바꿈, 홈 intro 문장 |
| `test/content-api.test.js` | `DEFAULT_CONTENT`, payout, legacy intro 치환 |
| `test/retired-investment-paths.test.js` | 410 경로 (미추적 파일과 함께 존재) |
| `docs/cloudflare-application-review-setup.md` | D1 마이그ration, R2 lifecycle, Turnstile, admin secret, GSC/네이버 사이트맵 제출 |
| `docs/naver-blog-*.md` | 브랜드·SEO·첫 글 (대부분 **미추적**) |

실행 순서·체크박스는 **`docs/clime-platform-patch-checklist.md`**.


## Executive summary

- 등록 정체는 이미 있다. 법인 **서울평가정보㈜**, 대표 **김중근**, 사업자등록번호 **114-81-47958**, 소재지·법인등록번호·개업일은 `public/structure/index.html`과 `public/llms.txt`에 있다. 홈 Organization JSON-LD(`functions/index.js`의 `buildStructuredData`)에는 법인명·이메일만 있고 주소·사업자번호·블로그/상담 `sameAs`가 없다. `/structure/`는 조직을 `https://climekr.com/structure/#organization`으로 따로 정의해, 검색기가 법인을 두 개로 읽을 수 있다.
- 고객이 크롤하는 그래프는 상품과 어긋나 있다. 홈 공감 카드(`public/index.html`)와 `/topics/` 8페이지, `public/sitemap.xml`, `docs/naver-blog-seo.md` 카테고리가 **급전·소액·대출 거절·햇살론·비상금대출**을 CLIME 도메인 주제로 올려 둔다. `docs/free-entry-points.md`는 같은 제목·URL을 쓰지 말라고 이미 적어 두었는데, 구현이 그 문서를 따르지 않는다.
- 메타·히어로·`llms.txt`가 “폰깡 / 대출 / 급전 / 내구재”를 상품 정의 문장 안에 반복한다. 모델은 부정어보다 **같이 나온 명사**로 주제를 묶는다. 구분 설명은 `/structure/`와 블로그 구분 글 한 편에만 두고, 제목·description·H1·사이트맵에서는 뺀다.
- 홈 FAQ 구조화 데이터는 2026-10-26 점검(`docs/2026-10-26-public-readable-seo-audit.md`)에서 **화면에 없는 FAQPage를 없애기 위해** 제거됐다. 홈에 FAQPage를 다시 넣으려면 보이는 FAQ가 먼저다. 보이는 FAQ는 지금 `/structure/`에만 있다.
- `/terms`, `/privacy`, `/legal`, `/trust`, `/faq`, `/blog`, `/company`는 `functions/_lib/retired-investment.js`가 **410**으로 막는다. 약관·개인정보·사기 예방 페이지는 그 슬러그를 재사용하면 안 된다. 후보 경로는 `/disclosures/`.
- `public/live-activity.js`는 주석 그대로 **백엔드 없는 시뮬레이션**(누적 상담 카운터, “지금 N명”, 마스킹 이름 토스트)이다. 이 숫자는 AI와 이용자 모두에게 과장 영업 신호다. 실측으로 바꾸거나 공개 화면에서 뺀다.

## Design principles (A+B)

**A. 정체 고정.** 검색·AI·푸터가 가리키는 조직은 하나다. `@id`는 `https://climekr.com/#organization`만 쓴다. `legalName`은 **서울평가정보㈜**, `taxID`는 114-81-47958, 주소·대표·개업일은 `/structure/`와 같은 문장이다. 구 상호 `에스씨아이평가정보(주)`는 `functions/api/content.js`의 `LEGACY_PUBLIC_INTROS`로 읽을 때만 바꾸고, 새 카피에 다시 넣지 않는다. 서비스 `@id`는 `https://climekr.com/#service`; **1층** JSON-LD·메타 description은 「유심 혜택」 톤, **2층** `serviceType`은 **「본인 명의 회선(알뜰·선불) 조건부 혜택 안내」**처럼 절차를 풀어 쓴다(1층 title/H1에 알뜰·선불·유심 개통을 선행하지 않음).

**B. 상품 서사만 색인.** 홈, 가이드, 소개, 상담 링크, 블로그 카테고리, 인스타 바이오가 말하는 일은 **유심 혜택 확인** → 상담·조회 → 3·15·30일 **유지 확인** → 단계 지급 대상이다. 재원은 `public/llms.txt`·`/structure/`에 둔다. 통신 회선 가입 유치 수수료·장려금의 일부다. 대출 상황 글·정부 대출 상품 설명·폰깡 패턴 장문은 브랜드 허브에서 분리한다.

## 1층 카피: 유심 혜택

고객이 검색·SNS·AI 요약에서 **처음 읽는 층(1층)** 과, 절차·법인·알뜰/선불·비용을 풀어 쓰는 **2층**을 나눈다. 1층은 「요금제 통신혜택」·「급전·대출」·「폰깡」 클러스터와 섞이지 않게 **유심 혜택**만 전면에 둔다.

| 구분 | 1층 — **쓸 것** | 1층 — **금지** (2층·상담·고지로) |
| --- | --- | --- |
| 핵심 키워드 | **유심 혜택**, **유심 혜택 확인**, **최대 66만원**, **몰랐던 유심 혜택**, **서울평가정보㈜** | **통신혜택**, **통신 혜택** (요금제·결합 할인과 혼동) |
| 히어로·제목 훅 | 혜택·확인·유지 후 지급·공식 법인 | **알뜰폰**, **선불**, **통신비 대납**, **유심 개통**을 히어로/`<title>` 선행어로 |
| 구 클러스터 | (계속 금지) | `급전`, `소액대출`, `비상금`, `대출 거절`, `폰깡`, `폰테크`, `내구재`, `즉시·당일 지급 보장`, `무조건`, 구 상호 `에스씨아이평가정보` |
| CTA | **유심 혜택 확인**, **조건 확인**, **개통 가능 여부 확인** (신용조회 URL 버튼) | 급전형 공감(「30초」, 「지금 무료」, 「혼자 끌어안지 마세요」) |

**2층에 두는 것:** KT·LG유플러스 망 **알뜰폰·선불**, 개통 절차, **통신비·30일 요금** 회사 부담, 유심 귀속, 재원, FAQ — 주로 `public/structure/index.html`, `/disclosures/`, `public/guide/index.html` 본문, 블로그 `05-phone-fraud-vs-clime.md`.

**샘플 1층 (히어로·메타):**

- `<title>`: `클라임유심 | 유심 혜택 · 유심 혜택 확인 · 최대 66만원 | 서울평가정보㈜`
- 히어로: `몰랐던 유심 혜택, **유심 혜택 확인**부터` / `유지 조건 충족 시 **최대 66만원**`
- eyebrow: `서울평가정보㈜ 공식 안내 · 유심 혜택`
- CTA: `유심 혜택 확인`, `개통 가능 여부 확인`

실행 체크리스트: **`docs/clime-platform-patch-checklist.md` 섹션 0-R**.

하이브리드로 남는 것: 이용자가 “유심 넘기면 현금”과 헷갈릴 때를 위해 **구분 문서는 1개**만 색인한다. 지금 그 역할에 가장 가까운 페이지는 `public/structure/index.html`(유심은 고객 보유, 회사는 수거하지 않음, 재원, 비용, 이용 원칙 제1–5조)이다. `public/topics/usim-benefit/`의 H1·제목에 있는 “대출·폰테크”는 구조 페이지로 합치고, 이 주제 URL은 구조 또는 가이드로 301한다. 블로그에서는 `scripts/naver-blog/posts/05-phone-fraud-vs-clime.md` 한 편만 구분 글로 남기고, 제목은 상품명으로 시작한다.

반복 금지: 제목·메타·H1·사이트맵 `<loc>` 주변 앵커 텍스트·블로그 카테고리명에 대출/급전/내구재/폰깡을 넣지 않는다. 본문 한 단락의 사실 구분은 A 레이어에만 둔다.

## Information Architecture

| 층 | 역할 | 현재 경로 | 패치 후 |
| --- | --- | --- | --- |
| Trust | 누가 운영하는가 | `/about/`, `/structure/`, 홈 푸터, `llms.txt` | 조직 스키마를 `/structure/` 사실로 통일. 홈 푸터에 소재지·법인등록번호를 구조 페이지와 같게 |
| Product | 무엇을 안내하는가 | `/`, `/guide/`, `/topics/usim-benefit/` | 홈·가이드·구조. `usim-benefit`은 구조로 합친 뒤 리다이렉트 |
| Process | 어떻게 참여하는가 | 홈 `#contact`, `/links/`, `GET /api/content`의 `checklist` | 유지. 조회 URL은 `lookup.url` = `https://www.credit.or.kr/credit/search`. 버튼 문구는 지금처럼 「개통 가능 여부 확인」 |
| Legal | 무엇을 공개하는가 | 홈 `#privacyNotice`는 **예전 홈페이지 사진 접수**만 설명. 독립 약관 없음 | 신규 `/disclosures/` (410 슬러그 회피). 민감 문안은 변호사 검토 |
| Blog | 네이버 설명 | `blog.naver.com/climeusimguide`, 원고 `scripts/naver-blog/posts/` | 카테고리를 상품 축으로 재명명. 코너 글 02·03은 발행 중단 또는 비공개 |
| Off-site | 상담·소셜 | 텔레그램 `https://t.me/climeusim`, 채널톡 `https://climeusim.channel.io`, `/links/`는 `noindex` | 바이오·고정댓글은 브랜드 문서의 한 블록만 사용. 인스타 캡션 원본은 저장소에 없음 |

사이트맵에 남을 URL: `/`, `/about/`, `/guide/`, `/structure/`, `/reviews/`, `/disclosures/`(추가 후). `/links/`는 계속 사이트맵 밖, `noindex`.

색인에서 내릴 URL (`public/sitemap.xml`에서 제거, `noindex`, 본문은 상품 페이지로 301 또는 짧은 안내 후 홈):

- `/topics/` (제목: 「돈이 급할 때 상황별 안내」)
- `/topics/urgent-money/`
- `/topics/small-loan-alternatives/`
- `/topics/loan-rejected/`
- `/topics/housewife/`
- `/topics/student/`
- `/topics/worker/`
- `/topics/business/`

이 페이지들은 서민금융진흥원·햇살론15·소액생계비·인터넷은행 비상금대출을 CLIME 호스트에서 설명한다. Gemini가 “대출 대안 사이트”로 묶는 직접 근거다. `functions/robots.txt.js`의 `Allow: /topics/`는 제거하거나, 남는 경로만 허용한다.

관리자(`admin.climekr.com`, `public/admin/*`)와 `/api/*`는 지금처럼 비공개. `functions/_middleware.js`가 공개 호스트의 `/admin`을 404로 막고, `www`는 `climekr.com`으로 308한다. 프리뷰 호스트는 `noindex`.

종료된 투자 플랫폼 주소는 410 유지. 새 콘텐츠를 `invest`, `wallet`, `legal` 같은 첫 세그먼트에 두지 않는다.

## Content system

**원본 우선순위**

1. D1 `site_content.home` (스키마 4) — 홈 제목·소개·SEO·FAQ 데이터·운영자·지급액·상담 링크
2. `functions/api/content.js` `DEFAULT_CONTENT` — DB가 비거나 검증 실패 시
3. `functions/index.js` HTMLRewriter — 요청 시 `title`, description, og/twitter, **첫 번째** `application/ld+json`, `#homeIntro`만 덮어씀. 공감 섹션·푸터 문장·가이드·주제 페이지는 정적 HTML이라 CMS만 고쳐서는 안 바뀐다
4. `public/llms.txt` — AI용 평문. 채택을 보장하지 않는다고 점검 문서가 이미 명시

**캐논 블록 (모든 채널이 이 순서 — 1층 SSOT, 「통신혜택」 미사용)**

1. 서비스명: 클라임유심 (CLIME), 도메인 climekr.com
2. 운영: **서울평가정보㈜**, 114-81-47958, help@climekr.com
3. 한 줄(1층): **몰랐던 유심 혜택**을 **서울평가정보㈜** 공식 안내로 **유심 혜택 확인** 후 조건에 따라 안내합니다.
4. 유심·휴대폰: 고객이 계속 보유·사용. 회사는 수거하지 않음. 제3자 양도·대여 없음 — 상세는 `/structure/` 제1·2조
5. 지급: 3일 5만, 15일 추가 7만, 30일 추가 10만. 건당 최대 22만, 최대 3건, **최대 66만원**. **유지 확인 후** 대상 결정. 상담·신청 즉시 지급 아님
6. 비용·망·개통(2층 요약 한 줄): 알뜰·선불·통신비·개통 절차는 **`/structure/`·`/guide/`·`/disclosures/`** 에만 풀어 씀
7. 재원: 가입 유치 수수료·장려금의 일부 (`/structure/`)
8. 상담: 텔레그램 https://t.me/climeusim · 채널톡 https://climeusim.channel.io — 주민번호·인증번호·비밀번호·신분증 전체 금지
9. 광고 표기: `[정보/광고]` 또는 `[운영사 제공 정보·광고 포함]` (`docs/naver-blog-brand.md`)

**톤**

- 절차와 조건. 짧은 문장. **1층**에는 **최대 66만원**·유지 기간을 쓰고, 알뜰·선불·통신비는 2층으로.
- 공감 카피(「혼자 끌어안지 마세요」, 「30초」, 「지금 무료 상담」)는 급전 광고 틀이라 1층에서 뺀다.
- 부정으로 상품을 정의하지 않는다. 1층은 **「유심 혜택」·「유심 혜택 확인」**을 먼저 쓰고, 「대출·폰깡 아님」은 구분 페이지·블로그 05 한 편에만.

**제목·히어로·CTA (1층 — 「1층 카피: 유심 혜택」절과 동일)**

- 제목 틀: `클라임유심 | 유심 혜택 · 유심 혜택 확인 · 최대 {{MAX_TOTAL}} | 서울평가정보㈜`
- 히어로: `몰랐던 유심 혜택, 유심 혜택 확인부터` / `유지 조건 충족 시 최대 {{MAX_TOTAL}}`
- CTA: **유심 혜택 확인**, `개통 가능 여부 확인`, `상담에서 조건 확인`, `조회 사진 보내기`
- 아이브로: `서울평가정보㈜ 공식 안내 · 유심 혜택` (구: `고객 비용 회사 부담 · 유심 개통 혜택` — **1층에서 「유심 개통」 선행 지양**)

**공개 문장에서 뺄 말 (1층: 제목·메타·H1·블로그 카테고리·태그·llms 첫 단락)**

`통신혜택`, `통신 혜택`, `급전`, `소액대출`, `비상금대출`, `당일대출`, `대출 거절`, `대출 대안`, `햇살론`, `내구재`, `폰깡`, `폰테크`, `무심사`, `즉시 현금`, `무조건`, `100% 지급`, `당일 지급 보장`, 구 상호 `에스씨아이평가정보`.  
1층 히어로 훅으로의 `알뜰폰`, `선불`, `통신비 대납`, `유심 개통` 선행도 금지(2층만).

구분 문서 본문에만, 한 단락: 단말기 매입·현금화, 유심·회선 양도, 상환·이자가 있는 금전 대차와의 차이. 정부 대출 상품을 나열해 “대안”으로 붙이지 않는다. 그 안내는 서민금융진흥원 등 해당 기관 사이트의 일이다.

**히어로에서 바꿀 현재 문장**

`functions/api/content.js`의 `intro` / `seo.description`과 `public/index.html` `#homeIntro`, `public/guide/index.html` 리드가 같은 장문이다. 「폰깡이 아니며」「급전이 필요한 이용자」 선행 정의를 **캐논 블록 1–9(유심 혜택 축)** 로 바꾼다. 가이드 H1 「자금이 급할 때…」는 「**유심 혜택 · 유지 기간과 지급 기준**」으로 바꾼다.

홈 공감 블록(`#empathy-title`, 세 개의 `/topics/urgent-money|small-loan-alternatives|loan-rejected` 링크)는 프로세스 3단계(조회 → 사진 → 유지 확인)로 교체하고, 링크 대상은 `/guide/`와 `/structure/`만 둔다.

## Technical patches

**JSON-LD**

- `functions/index.js` `buildStructuredData`: Organization에 `taxID`, `address`(마포구 토정로 144), `founder`/`employee` 대신 구조 페이지와 같이 대표자 표기, `foundingDate` `1992-07-27`, `sameAs`에 `https://blog.naver.com/climeusimguide`만 (상담 URL은 ContactPoint). 전화번호가 없으면 `telephone`을 만들지 않는다.
- 같은 함수의 Service `serviceType`은 2층: `본인 명의 회선(알뜰·선불) 조건부 혜택 안내`. **description**(WebPage·Service·Organization)은 1층 캐논 — **유심 혜택**·**서울평가정보㈜**; `급전`·`폰깡`·`통신혜택` 없음.
- WebSite에 `publisher`만 유지. 검색창이 없으므로 `SearchAction`은 넣지 않는다.
- FAQPage: 홈·가이드에는 넣지 않는다. `test/public-readable-seo.test.js`와 `test/seo.test.js`가 홈 FAQPage 부재를 고정한다. `/structure/`에 이미 보이는 4개 FAQ가 있으므로, 그 페이지의 FAQPage는 유지하되 `mainEntity`의 조직 `@id`를 `https://climekr.com/#organization`으로 맞춘다 (`public/structure/index.html` 27행 근처의 별도 조직 노드를 참조로 교체).
- `/about/` Organization `taxID`는 이미 있다. 주소가 없으니 구조 페이지와 같은 `PostalAddress`를 **한 노드를 복사하지 말고** `#organization` 참조만 남긴다. 페이지마다 조직을 새로 선언하지 않는다.
- 주제 페이지의 Article+FAQPage(대출 FAQ)는 페이지를 내릴 때 같이 사라진다. `public/topics/index.html`의 CollectionPage `about`가 「대출 대안 안내」다.

**페이지 메타**

- 홈 메타는 Rewriter가 D1/DEFAULT로 덮는다. DEFAULT의 `seo.title`·`seo.description`을 캐논 길이(description 150–220자, 상품·법인·유지·상담만)로 줄인다.
- `/about/`, `/guide/`, `/structure/`, `/reviews/`의 `<title>`·description·og는 정적이다. 가이드 description이 홈과 같은 급전 장문이다 (`public/guide/index.html`).
- canonical은 이미 `https://climekr.com/...` 다. 주제 URL을 301하면 canonical도 목적지로 바꾼다. 301과 canonical이 서로 다른 최종 URL을 가리키면 안 된다.
- `public/index.html`의 `naver-site-verification`과 `public/navercb78a18ae519c02b17c8618a7b72822c.html`은 유지.

**`/structure/`에 더할 것**

- 이미 있는 것: 법인·대표·사업자·법인등록번호 110111-0853419·소재지·개업일, 재원, 유심 귀속, 30일 비용, 이용 원칙, FAQ 4개.
- 더할 것: 홈·가이드·소개로 가는 내부 링크(이미 일부 있음), 상담 채널이 **이 페이지와 같은 문장**을 쓴다는 한 줄, 국세청 사업자등록 조회는 “이용자가 직접 대조할 수 있다” 수준만 (조회 결과를 사이트가 보증한다고 쓰지 않음).
- 금액 표를 CMS와 이중으로 하드코딩하지 않으려면 `/guide/`처럼 `functions/guide/index.js`가 `GET` 시 D1 payout을 주입하는 방식을 구조 페이지에도 쓴다. 지금은 구조 HTML에 5만·7만·10만·66만이 고정이다.

**사이트맵·로봇**

- `public/sitemap.xml`: 상품·신뢰·고지 URL만. `lastmod`는 실제 수정일.
- `functions/robots.txt.js`: `Disallow: /admin/`, `/api/` 유지. `/topics/` 전체 허용 문구 삭제. 새 `Disallow`로 주제 경로를 막을 경우, 301이 먼저 동작해야 한다. 410/301이 응답하면 robots disallow는 보조다.
- 점검 테스트 `test/seo.test.js`는 (패치 전) description에 `급전`, `폰깡`을 고정한다. **0-R** 후에는 `유심 혜택`, `서울평가정보㈜`, `최대 66만원`을 기대하고 `급전`/`폰깡`/`통신혜택` assert는 제거한다.

**서치어드바이저·Search Console**

- 절차는 `docs/naver-blog-seo.md`, `docs/cloudflare-application-review-setup.md`에 있다. 소유 확인 후 `https://climekr.com/sitemap.xml` 재제출.
- 주제 URL을 301/noindex한 뒤 네이버 수집 요청은 **새 상품 URL**(`/structure/`, `/guide/`, `/about/`)만. 구 URL 재수집 요청은 하지 않는다.
- 블로그 `https://blog.naver.com/climeusimguide`는 사이트와 별도 등록(문서에 “가능 시”).

**내부 링크 climekr ↔ 블로그**

- 블로그 글 하단은 이미 `climekr.com` + `t.me/climeusim` 규칙 (`docs/naver-blog-seo.md`). 대상 경로를 `/topics/urgent-money/` 등이 아니라 `/`, `/guide/`, `/structure/`로 고정.
- 사이트 푸터(`public/index.html` 832행 근처, 각 주제 푸터)의 「상황별 안내」는 「사업 구조」「혜택 조건」으로 바꾼다.
- 블로그에서 사이트로 올 때는 canonical 1개. 사이트에서 블로그로는 푸터에 공식 블로그 1링크. `sameAs`와 같은 URL.

**콘텐츠 API**

- `supportLinks` 호스트 허용은 페이지 스크립트가 `t.me`, `climeusim.channel.io`만 받는다. 그 검사를 유지한다.
- `copy.consultationSafety`를 채널 고정 안내의 원문으로 쓴다.
- 개인정보 고정 키(`FIXED_PRIVACY_COPY_KEYS`)는 레거시 사진 접수 설명이다. 상담 채널 개인정보와 섞어 편집하지 않는다. 상담용 고지는 `/disclosures/` 정적 페이지로 분리한다.

## Channel alignment matrix

| 표면 | 지금 | 맞출 문장 | 손댈 파일 |
| --- | --- | --- | --- |
| Home | 히어로는 혜택, 메타·소개·공감 카드는 급전/대출 주제. 시뮬레이션 카운터 | 캐논 1–8. 공감 카드 제거. 라이브 위젯 제거 또는 실측만 | `functions/api/content.js`, `public/index.html`, `public/live-activity.js`, `functions/index.js` |
| Structure | 정체·재원·귀속·FAQ가 가장 완전. 조직 `@id`만 분리 | A의 기준 페이지. `@id` 통일. 금액은 CMS 주입 | `public/structure/index.html` |
| About | 상품 3카드+사업자. 주소·법인등록번호 없음 | 구조와 같은 사업자 행. 대출 중개 아님은 본문 한 줄로 충분. H1은 「CLIME 소개」 유지 | `public/about/index.html` |
| Guide | H1이 「자금이 급할 때」. 지급표는 D1 연동 (`functions/guide/index.js`) | 상품 조건 페이지로 제목 변경. 「대출과 무엇이 다른가요?」 섹션은 구조로 링크만 | `public/guide/index.html` |
| Topics | 색인되는 대출·생활비 클러스터 | 비색인+301. 허브 문구 폐기 | `public/topics/**`, `public/sitemap.xml`, `public/llms.txt` |
| Reviews | 제목은 상품. description에 「대출 상품이 아니며」 | 「유지 조건 확인 후 지급 대상」만. 허위 후기 추가 금지(점검 문서와 동일) | `public/reviews/index.html` |
| Links (인스타/바이오 랜딩) | `noindex`. 고지에 「대출·당일대출 상품이 아닙니다」 | 캐논 5–8 + 민감정보 금지. 상품명으로 시작 | `public/links/index.html` |
| 네이버 블로그 카테고리 | `docs/naver-blog-seo.md`가 급전·대출거절에 매핑 | 아래 카테고리. 사이트 주제 구조와 더 이상 1:1로 맞추지 않음 | 문서 + 블로그 관리 화면(저장소 밖) |
| 블로그 원고 | `00` 제목이 「구조·대출·폰깡」. `02` `03`이 급전/거절 대안. `05`가 폰깡 패턴 장문. 태그 `급전대안`, `폰깡` | `00`·`01`·`04`를 상품 축으로 개제. `02`·`03` 비공개. `05`는 구분 1편, 제목에서 폰깡을 뒤로 | `scripts/naver-blog/posts/*.md`, `docs/naver-blog-brand.md`, `docs/naver-blog-official-research.md` 142행(본문에 대출/내구재 비교를 넣으라는 문장) |
| Instagram | 캡션·바이오 원본 없음. `docs/free-entry-points.md`는 Linktree를 선택지로만 적음. `assets/heygen/`는 릴스 배경 이미지·HTML뿐 | 바이오 한 줄은 `docs/naver-blog-brand.md` 소개글과 같게: 법인, 조건부 혜택, climekr.com, `[정보/광고]`. 링크는 `/links/` 하나. 릴스 자막에 급전·즉시지급 없음 | 새 카피 위치 제안: `docs/naver-blog-brand.md`에 「채널 공통」 절. 별도 인스타 전용 문장을 만들지 않음 |
| Telegram / ChannelTalk | 사이트 고지 `consultationSafety`, `/links/` disclosure. 채널 환영 문구는 저장소에 없음 | 고정 메시지 초안(채널에 수동 게시): 법인명, 사업자번호, 구조 페이지 URL, 유지 후 지급, 민감정보 금지, 운영사 광고 표기. 주민번호·인증번호·비밀번호 요구 없음 | 원문만 `functions/api/content.js` `consultationSafety`와 `/disclosures/`에 두고, 채널 툴 설정은 운영자가 붙여 넣음 |

**블로그 카테고리 (개명)**

| 지금 (`docs/naver-blog-seo.md`) | 바꿀 이름 | 연결 |
| --- | --- | --- |
| 유심 개통 혜택 안내 | 유지 | `/structure/`, `/guide/` |
| 급전·생활비 대안 | 삭제 | — |
| 대출 거절·대안 | 삭제 | — |
| 직장인·주부·학생·사업자 | 삭제 | — |
| CLIME 공식 안내 | 운영 정보 | `/about/`, `/structure/` |
| (신규) | 유지 조건과 지급 | `/guide/` |
| (신규, 1개) | 유심은 고객이 사용합니다 | `/structure/`와 블로그 `05`만 |

주제 설정(IT·컴퓨터 / 비즈니스·경제)과 블로그명 `클라임유심 유심 개통·혜택 안내`, 별명 `클라임유심혜택`은 `docs/naver-blog-brand.md` 그대로 둔다.

## Compliance & trust layer

공개해도 되는 사실 (이미 구조 페이지에 있는 범위):

- 법인명, 대표자, 사업자등록번호, 법인등록번호, 소재지, 개업연월일, 이메일
- 혜택은 유지 조건 확인 후 대상이 되고, 금액은 운영사 안내 기준
- 유심·단말·회선 명의는 고객, 회사는 수거·양도·대여를 요구하지 않음
- 상담 창에 보내지 말 정보
- 레거시 홈 접수 사진의 보유(결정 후 30일, 미검토 30일)와 상태 정보 60일 — 이 문장은 홈 `#privacyNotice`와 CMS 고정 키에만

새로 만들 페이지. 슬러그는 `/disclosures/` 아래만. `terms` `privacy` `legal` `trust` `faq`는 410이다.

- `/disclosures/` 목차: 사업자 정보(구조로 링크), 서비스 안내 조건, 상담 개인정보, 금지 행위
- `/disclosures/service/` 참여 조건 요약. `/structure/` 제1–5조를 베끼지 말고 그 페이지로 링크. 숫자 불일치를 막는다
- `/disclosures/privacy/` **상담 채널**(텔레그램·채널톡)에서 사진이 그 사업자 서버에 간다는 점, 홈페이지 어드민에 자동 등록되지 않는다는 점(`llms.txt`에 있음), Cloudflare는 사이트·레거시 사진 보관에 쓰인다는 점. 채널사 처리방침 URL은 운영자가 확인한 뒤에만
- `/disclosures/safety/` 운영 약속: 공식 도메인·공식 계정만, 인증번호·비밀번호·주민번호 전체를 요구하지 않음, 유심 양도 절차 없음, 지급은 유지 확인 후. 「사기 없음」「100% 안전」이라고 쓰지 않는다

법률 검토가 필요한 문장 (이 문서는 법률 자문이 아님):

- 「고객 부담금 0원」「회사가 요금 전액 부담」과 실제 통신 약관·청구 주체가 같은지. 점검 문서도 계약 자료 대조를 필수로 적어 두었다
- 「수수료·장려금을 혜택으로 환원」의 표시광고
- 시뮬레이션 상담 건수·온라인 인원·토스트 이름 (`public/live-activity.js`) — 사실 아닌 사회적 증거는 표시광고와 AI 경고 양쪽의 문제다. P0에서 공개 제거를 권한다
- 후기 코퍼스가 체험으로 읽히는지 (`public/reviews/`). 검증되지 않은 후기·인증 마크는 점검 문서가 금지

전자상거래 표시(통신판매업 신고)는 저장소에 없다. 해당하면 변호사·세무사 확인 후 `/structure/` 사업자 표에만 추가한다. 없으면 만들지 않는다.

## SEO strategy without triggering loan-adjacent AI

**필러:** `/structure/` + `/` + `/guide/`. 하나의 조직, 하나의 서비스, 지급은 가이드.

**클러스터:** 상황별 생활비·대출 거절·직군 페이지는 클러스터로 두지 않는다. `docs/free-entry-points.md`의 허용 주제에 맞춘다.

- 유심 개통 혜택 / 유지 기간 / 지급 시점 → `/guide/`
- 본인 명의, 유심을 고객이 보유 → `/structure/`
- 운영 법인 → `/about/`

**제목 틀 (1층)**

- 홈: `클라임유심 | 유심 혜택 · 유심 혜택 확인 · 최대 {{MAX_TOTAL}} | 서울평가정보㈜`
- 가이드: `유심 혜택 · 유지 기간별 지급 기준 | 클라임유심`
- 구조: `사업 구조 | 재원·유심 귀속·비용 | 클라임유심` (2층 — 알뜰·선불·통신비 허용)
- 소개: `CLIME 소개 | 서울평가정보㈜ · 클라임유심`
- 블로그: `유심 혜택 유지 조건 | 클라임유심` — **유심 혜택**으로 시작; 대출·폰깡·통신혜택 선행 금지

**태그:** `유심개통혜택`, `클라임유심`, `CLIME`, `유심지원금`, `조건부혜택`. `급전대안`, `폰깡`, `폰깡아님`은 제거 (`scripts/naver-blog/posts/00-pillar-usim-benefit-naver.md` 태그 목록).

**`llms.txt`:** 「주제별 정보 안내」의 급전·소액·대출 거절·주부·학생·직장·가게 항목을 삭제하고, 공식 페이지 5개(홈, 소개, 구조, 가이드, 후기)와 상담 URL만 남긴다. 첫 문단은 캐논 블록. 이 파일은 보조다.

**내부 앵커 텍스트:** 「상황별 안내」「대출이 아닌 혜택으로」를 「유지 조건」「사업 구조」로 바꾼다. 앵커가 대출이면 링크 목적지도 대출로 학습된다.

## Implementation phases (P0 / P1 / P2)

**0-R — 1층 카피 「유심 혜택」** (P0과 동시 배포)

- `functions/api/content.js`, `public/index.html`, `public/guide/index.html`, `public/llms.txt`, `public/links/index.html`, meta/OG, empathy, `docs/naver-blog-brand.md`, 블로그 원고 — 체크리스트 **0-R** 전 항목
- 테스트: `test/seo.test.js`, `test/public-readable-seo.test.js`, `test/content-api.test.js`, `test/public-content-metadata.test.js`, `test/public-page.test.js`, `test/marketing-guide.test.js`

**P0 — 크롤러가 오늘 읽는 주제 그래프**

- `public/sitemap.xml`에서 `/topics/` 및 하위 8 URL 제거
- `public/topics/index.html`과 하위 `index.html`: `/guide/` 또는 `/structure/`로 **301** (`functions/_middleware.js`)
- `public/llms.txt` 주제 목록 삭제 (0-R 캐논과 중복 작업)
- `public/index.html` 공감 카드 topics 링크 제거, live-activity 제거
- 테스트: topics 301, `test/live-activity.test.js`, sitemap/robots

**P1 — 정체 스키마와 고지**

- `functions/index.js` Organization을 구조 페이지 사실과 하나의 `@id`로
- `public/structure/index.html`, `public/about/index.html`의 중복 Organization 노드를 `#organization` 참조로
- 홈 푸터에 소재지 (CMS `operator`에 주소 필드를 넣으면 편집기와 `public/admin/content-editor.js`까지 확장. 안 넣을 거면 구조 페이지 링크만 푸터에 추가)
- `/disclosures/` 3페이지, 사이트맵 추가, 410 목록에 없는지 `retired-investment.js`와 대조
- `docs/naver-blog-seo.md` 카테고리 표, `docs/naver-blog-official-research.md`의 “대출/내구재 비교를 본문에” 지침을 이 아키텍처로 수정
- 블로그 관리 화면에서 카테고리 개명, 글 `02`·`03` 비공개, `00` 제목·태그 수정. 원고는 `scripts/naver-blog/posts/`
- 서치어드바이저·Search Console에 새 사이트맵 제출, 구 주제 URL 제거 요청

**P2 — 채널 문장 한 벌**

- `docs/naver-blog-brand.md`에 채널 공통 블록(바이오, 텔레그램 고정, 채널톡 인사, 릴스 자막 4줄) 추가 후 운영자가 채널에 붙여 넣기
- `/links/` 고지 문장을 그 블록과 같게
- `/structure/` 금액 하드코딩을 `functions/guide/index.js`와 같은 D1 주입으로
- `usim-benefit` 301이 안정된 뒤 HTML 파일 삭제 여부는 로그로 결정
- 인스타 전용 저장소 카피는 만들지 않음. HeyGen 배경(`assets/heygen/`)은 자막 원본이 아니므로 자막은 브랜드 블록만 사용

## Metrics & validation

배포 후 같은 문장으로만 비교한다. 모델 답변은 날짜·계정·지역에 따라 달라지므로 통과/실패 이분법은 쓰지 않고, **인용 URL과 첫 문장 명사**를 기록한다.

Gemini / Google AI에 넣을 질문 (한국어, 변경 전후 각 1회):

1. `클라임유심이 무슨 회사야?`
2. `climekr.com 은 대출이야?`
3. `서울평가정보 유심 혜택 조건`
4. `클라임유심 폰깡이야 내구재야?`

기대 방향 (보장 아님): 인용에 `climekr.com/structure/` 또는 `/about/`·`/guide/`가 있고, 첫 설명 명사에 **서울평가정보㈜**·**유심 혜택**이 있다. 인용이 `/topics/*`이면 P0 미완료. 「통신혜택」으로 요약되면 1층 카피 재점검.

기술 확인:

- Rich Results Test에 `/`, `/structure/`, `/about/` URL. Organization이 하나인지, 홈에 FAQPage가 없는지, 구조에 FAQ 4개가 보이는 본문과 일치하는지
- `curl -sI`로 주제 URL이 301이고 `Location`이 상품 페이지인지, `/terms` `/privacy`는 계속 410인지
- 뷰소스 **1층** description에 `통신혜택` `급전` `소액대출` `내구재` `폰깡`이 없는지; `유심 혜택`·`서울평가정보㈜` 있는지 (`/structure/`·`/disclosures/`·블로그 05 본문은 2층 예외)
- 네이버 서치어드바이저 수집 현황에서 제거 URL이 제외·리다이렉트로 잡히는지
- `npm test`의 SEO·content-api·public-readable 테스트

상담 채널은 저장소 밖이다. 고정 메시지 게시 여부는 스크린샷으로만 확인한다.

## Deployment architecture (climekr.com)

요청 `https://climekr.com/…`가 처리되는 경로를 운영·패치 시 공통 그림으로 둔다.

```text
[사용자·크롤러]
       │
       ▼
 Cloudflare DNS (climekr.com, www, admin.climekr.com → Pages)
       │
       ▼
 Cloudflare Pages — 프로젝트 usim-plus-site
   ├─ 정적 자산: public/  (HTML, CSS, reviews/data, sitemap.xml, llms.txt)
   └─ Pages Functions: functions/
         onRequest 체인 예:
         _middleware.js  → www 308, 410 retired paths, preview noindex, admin 호스트 가드
         index.js        → GET / 만 HTMLRewriter (D1 site_content → 메타·JSON-LD·intro)
         guide/index.js  → GET /guide/ 지급표 주입
         robots.txt.js   → 호스트별 robots.txt
         api/*           → JSON·admin·legacy applications
       │
       ├─ D1 (CONTENT_DB)     site_content, admin_sessions, application_submissions, …
       └─ R2 (APPLICATIONS_BUCKET)  legacy 홈 접수 사진 pending/ reviewed/ (비공개 URL)

[별도] Worker usim-plus-application-retention (wrangler-retention.toml)
       Cron → D1 메타 60일 삭제 + R2 reviewed 정리
```

**프로덕션 반영 경로**

1. 변경을 GitHub `main`에 merge/push → Pages **자동 배포**(빌드 스텝 없음).
2. 스키마 변경 시: `npx wrangler d1 migrations apply usim-plus-content --remote` (`docs/cloudflare-application-review-setup.md`).
3. retention Worker 변경 시: `npx wrangler deploy --config wrangler-retention.toml`.
4. Pages Production **Variables/Secrets**(Turnstile, `ADMIN_*`)는 대시보드 또는 `wrangler pages secret put` — 저장소에 값 없음.

**캐시·일관성**

- 홈·가이드 HTMLRewriter: `Cache-Control` s-maxage **15초** (`functions/index.js`, `guide/index.js`). CMS 발행 후 짧은 지연 가능.
- 정적 `public/*.html`(topics, structure 등)은 커밋 내용 그대로 Edge 캐시; 패치 후 URL 검증·필요 시 Cloudflare 캐시 purge.

**커스텀 도메인**

- apex `climekr.com` = canonical; `www`는 middleware 308.
- `admin.climekr.com`은 동일 Pages 프로젝트에 별도 커스텀 도메인으로 연결된 패턴(`README.md`). robots 전면 Disallow.

패치 P0( topics 301·sitemap·llms ) 배포 후: Search Console·네이버 서치어드바이저에 **`https://climekr.com/sitemap.xml` 재제출**, smoke URL·Gemini 질문은 아래 Metrics 절.

## Honest limits

- Google AI Mode와 Gemini는 climekr.com만이 아니라 뉴스, 커뮤니티, 유사 키워드(유심·개통·현금·지원금)의 **다른 사업자 사기 글**을 섞는다. 자사 제목에서 그 단어를 빼도, 산업 키워드 자체가 소비자 경고 템플릿을 호출한다. 경고 문단이 0이 되는 설계는 없다.
- `llms.txt`, JSON-LD, 서치어드바이저 재수집은 힌트다. 모델이 이 파일을 읽는지, 읽은 뒤 경고를 지우는지는 통제되지 않는다. 점검 문서가 같은 한계를 이미 적었다.
- 부정 문장(「대출이 아니다」)을 많이 쓸수록 일부 요약기는 대출 문서와 한 덩어리로 둔다. 그래서 구분은 한 페이지로 줄이는 것이다. 그 한 페이지를 읽은 모델은 여전히 경고를 붙일 수 있다.
- 과거 색인, 블로그 글 `02`·`03`, 공유된 캡션은 삭제·비공개 후에도 캐시와 인용으로 남는다. 반영은 수주에서 수개월이다.
- 사업자 정보를 정확히 적어도, 유지 조건 현금 혜택이라는 **상품 형태**에 대해 모델이 일반 소비자 주의를 붙이는 것은 정상 동작에 가깝다. 사이트가 할 수 있는 일은 그 주의 옆에 **법인·번호·유심 귀속·지급 시점**이 같이 나오게 하는 것이다.
- 시뮬레이션 카운터를 남겨 두면, 본문이 정직해도 요약기는 “실적 과장” 쪽으로 기울 수 있다.

이 문서는 구현 지시서다. 약관 문안과 「요금 전액 회사 부담」의 계약 일치 여부는 변호사·운영 계약 검토 전제로 둔다.