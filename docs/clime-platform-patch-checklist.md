# CLIME 플랫폼 패치 — 실행 체크리스트 (마스터)

아키텍처: [`clime-platform-patch-architecture.md`](./clime-platform-patch-architecture.md)  
스냅샷 기준일: **2026-10-28** · **1층 카피 전략: 「유심 혜택」** 반영

번호 순서대로 진행. 각 항목은 `- [ ]`로 완료 표시.  
**0-R(리브랜드 카피)** 은 P0와 **같은 PR**에서 끝내거나, P0 직전에 완료한다. 카피·테스트·topics/llms는 한 번에 배포하는 것이 안전하다.

---

## 0. 준비 (Prep)

- [ ] **0.1** 작업 브랜치 생성 (예: `patch/clime-platform-p0`) — `main`에서 분기
- [ ] **0.2** Cloudflare Pages 프로덕션 스냅샷 확인: 대시보드 → `usim-plus-site` → 최근 배포 커밋 SHA 기록 (롤백용, 섹션 8 참고)
- [ ] **0.3** D1 `site_content`(`id=home`) 백업 — admin 콘솔 export 또는 `npx wrangler d1 execute usim-plus-content --remote --command "SELECT id, content FROM site_content WHERE id='home'"` (JSON만 저장; `.env`·시크릿·비밀번호는 저장·커밋하지 않음)
- [ ] **0.4** `.dev.vars` 로컬 전용 확인 — 프로덕션 `ADMIN_*` / Turnstile 값을 커밋·채팅·PR 본문에 넣지 않음 (`.env` 파일 **읽지 않음**)
- [ ] **0.5** 미추적·필수 파일 — 이번 패치에 **반드시 `git add`** 할 목록 확인:
  - [ ] `public/about/` 전체 (사이트맵에 있으나 git 미추적 가능)
  - [ ] `functions/_lib/retired-investment.js`
  - [ ] `functions/_middleware.js` (410·301·preview noindex 변경 시)
  - [ ] `test/retired-investment-paths.test.js`
  - [ ] `docs/clime-platform-patch-architecture.md`, `docs/clime-platform-patch-checklist.md` (본 문서)
  - [ ] `docs/naver-blog-brand.md`, `docs/naver-blog-seo.md`, `docs/naver-blog-official-research.md`, `docs/naver-blog-first-post-playbook.md`, `docs/naver-blog-quickstart.md` (운영 참고; 필요분만 추적)
- [ ] **0.6** 아키텍처 「현재 상태 스냅샷」·본 체크리스트를 팀/운영자와 공유
- [ ] **0.7** 카피 SSOT 확인: 금액·기간은 `functions/api/content.js` `DEFAULT_CONTENT.payout` + D1 `site_content.home.payout` — 정적 HTML의 `66만원`·`5만`·`7만`·`10만`은 CMS와 **동시** 수정

---

## 0-R. 리브랜드 카피 — 1층 「유심 혜택」(P0 선행·병행)

> **1층** = 제목·메타·OG/Twitter·H1·히어로·아이브로·공감 섹션·`llms.txt` 첫 블록·CMS `intro`/`seo.*`·네이버 프로필·블로그 제목/태그.  
> **2층** = `/structure/`, `/disclosures/`, 상담 고지, 가이드 본문, 블로그 구분 글 — 알뜰폰·선불·통신비·개통 절차는 **여기만**.

### 0-R.0 허용·금지 (수용 기준)

| 구분 | 1층에 **쓸 것** | 1층 **금지** (2층으로) |
| --- | --- | --- |
| 핵심 명사 | **유심 혜택**, **유심 혜택 확인**, **최대 66만원**, **몰랐던 유심 혜택**, **서울평가정보㈜** | **통신혜택**, **통신 혜택** (요금제 혜택과 혼동) |
| 히어로 훅 | 혜택·확인·유지 후 지급·법인명 | **알뜰폰**, **선불**, **통신비 대납**, **유심 개통**을 히어로/제목 선행어로 |
| 구(舊) 금지 | (유지) | `급전`, `소액대출`, `비상금`, `대출 거절`, `폰깡`, `폰테크`, `내구재`, `즉시 지급`, `당일 지급 보장`, `무조건`, 구 상호 `에스씨아이평가정보` |
| CTA | **유심 혜택 확인**, **조건 확인**, **개통 가능 여부 확인**(기존 조회 버튼 유지 가능) | 「30초」, 「지금 무료」, 「혼자 끌어안지 마세요」 등 급전형 공감 |

**수용 검색:** 1층 HTML·메타·DEFAULT·llms 첫 500자에 `통신혜택|통신 혜택|급전|폰깡|폰테크` **없음**; `유심 혜택` 또는 `유심 혜택 확인` **있음**; `서울평가정보㈜` **있음**.

### 0-R.1 캐논 블록 (복사 SSOT — 아키텍처와 동일)

아래를 **한 세트**로 유지. `{{MAX_TOTAL}}` = CMS 치환(기본 66만원).

1. **서비스:** 클라임유심(CLIME), https://climekr.com  
2. **운영:** **서울평가정보㈜**, 사업자등록번호 114-81-47958, help@climekr.com  
3. **한 줄:** **몰랐던 유심 혜택**을 **서울평가정보㈜** 공식 안내로 **유심 혜택 확인** 후 조건에 따라 안내합니다.  
4. **유심·단말:** 고객이 계속 보유·사용. 회사는 수거하지 않음. (상세는 `/structure/`)  
5. **비용·지급:** 유지 조건 충족 시 단계 지급. **최대 66만원**(3일 5만 / 15일 +7만 / 30일 +10만, 건당 최대 22만, 최대 3건). **유지 확인 후** 대상 결정 — 상담·신청 즉시 지급 아님.  
6. **재원:** 가입 유치 수수료·장려금의 일부 (`/structure/`와 동일)  
7. **상담:** 텔레그램 https://t.me/climeusim · 채널톡 https://climeusim.channel.io — 주민번호·인증번호·비밀번호·신분증 전체 금지  
8. **광고:** `[정보/광고]` 또는 `[운영사 제공 정보·광고 포함]`

**샘플 1층 (히어로·title 참고):**

- title: `클라임유심 | 유심 혜택 · 유심 혜택 확인 · 최대 66만원 | 서울평가정보㈜`  
- H1/히어로: `몰랐던 유심 혜택, **유심 혜택 확인**부터` / `유지 조건 충족 시 **최대 66만원**`  
- eyebrow: `서울평가정보㈜ 공식 안내 · 유심 혜택`  
- CTA: `유심 혜택 확인`, `개통 가능 여부 확인`

### 0-R.2 CMS·API 기본값

- [ ] **0-R.2.1** `functions/api/content.js` — `DEFAULT_CONTENT.intro`를 캐논 0-R.1로 교체 — **수용:** `유심 혜택`, `서울평가정보㈜`, `폰깡`/`급전`/`통신혜택` 없음  
- [ ] **0-R.2.2** `functions/api/content.js` — `seo.title`, `seo.description`, `seo.socialDescription` (150–220자, 1층 규칙) — **수용:** description에 `유심 혜택 확인`, `최대 66만원`  
- [ ] **0-R.2.3** `functions/api/content.js` — `copy.heroTitle`, `copy.heroEyebrow`, `copy.heroLead`(있으면), `copy.consultationSafety` — eyebrow에 `유심 혜택`; hero에 `알뜰폰`/`선불`/`통신비 대납`/`유심 개통` 선행 없음  
- [ ] **0-R.2.4** `functions/api/content.js` — `LEGACY_PUBLIC_INTROS`, `LEGACY_SEO_DESCRIPTIONS`(또는 동등 집합)에 **현재** 장문(폰깡·급전·구 intro) 추가 → D1 구버전 read 시 0-R.1로 치환  
- [ ] **0-R.2.5** `functions/index.js` — `buildStructuredData` 내 Organization·Service·WebPage `description`이 DEFAULT와 같은 1층 톤 — **수용:** Service `serviceType`은 2층 허용 문구(예: 본인 명의 회선 조건부 혜택 안내) 가능; **description**은 1층 규칙  
- [ ] **0-R.2.6** `test/content-api.test.js` — DEFAULT·legacy 치환·payout assert를 0-R.1 문장 기준으로 갱신  
- [ ] **0-R.2.7** `test/public-content-metadata.test.js` — Rewriter가 덮는 title/description이 새 DEFAULT와 일치하는지 갱신 (해당 assert 있을 때)

### 0-R.3 홈 정적·메타

- [ ] **0-R.3.1** `public/index.html` — `<title>`, `#seoDescription`, `#ogTitle`, `#ogDescription`, `#twitterTitle`, `#twitterDescription` — 1층 샘플·캐논; 정적 fallback이 구 장문이면 교체 (Rewriter 전 뷰소스도 통과)  
- [ ] **0-R.3.2** `public/index.html` — `#homeIntro` — 캐논 0-R.1 줄바꿈 형식 유지  
- [ ] **0-R.3.3** `public/index.html` — 히어로 `#heroTitle` / `#heroEyebrow` / CTA 버튼 문구 — **유심 혜택 확인** 축; `data-copy` 키가 CMS와 맞는지 확인  
- [ ] **0-R.3.4** `public/index.html` — `#empathy-title`, `.empathy__resolve`, 공감 카드 — **급전·폰깡·대출** 문장 제거; **프로세스 3단계**(조회 → 사진 → 유지 확인) + 링크 **`/guide/`**, **`/structure/`** 만 (아래 1.4와 중복 시 한 번에)  
- [ ] **0-R.3.5** `public/index.html` — 푸터 「상황별 안내」→ 「사업 구조」「혜택 조건」; `/topics/` 링크 제거  
- [ ] **0-R.3.6** `public/index.html` — JSON-LD 첫 `application/ld+json` 정적 fallback description — 1층 규칙 (Rewriter가 덮어도 일치)  
- [ ] **0-R.3.7** `test/public-readable-seo.test.js` — `#homeIntro` visible assert를 0-R.1로 갱신  
- [ ] **0-R.3.8** `test/seo.test.js` — meta description·JSON-LD WebPage/Service description assert — `급전`/`폰깡` 기대 **제거**, `유심 혜택`·`서울평가정보㈜` 기대 **추가**  
- [ ] **0-R.3.9** `test/public-page.test.js` — 홈 히어로·CTA 관련 assert 있으면 0-R 샘플에 맞게 갱신

### 0-R.4 가이드·링크·후기 메타 (1층)

- [ ] **0-R.4.1** `public/guide/index.html` — `<title>`, meta/OG, **H1** — 예: `유심 혜택 · 유지 기간과 지급 기준` (「자금이 급할 때」 제거)  
- [ ] **0-R.4.2** `public/guide/index.html` — 리드 문단 — 1층 규칙; 알뜰폰·선불·통신비 대납은 본문 깊은 절에만  
- [ ] **0-R.4.3** `test/marketing-guide.test.js` — 가이드 H1·금지 문구 assert 갱신  
- [ ] **0-R.4.4** `public/links/index.html` — disclosure·히어로 — 캐논 5–8 + 1층 금지 준수; 「대출·당일대출」 선행 제거  
- [ ] **0-R.4.5** `public/reviews/index.html` — `<title>`·description — 「대출 상품이 아닌」 1층 선행 대신 **유지 조건 확인 후 지급** 톤  
- [ ] **0-R.4.6** `test/public-readable-seo.test.js` — 가이드·홈 cross-check assert 갱신

### 0-R.5 llms.txt (AI 1층)

- [ ] **0-R.5.1** `public/llms.txt` — 첫 문단을 **캐논 0-R.1** (8줄 이내 평문)으로 교체  
- [ ] **0-R.5.2** `public/llms.txt` — 「주제별 정보 안내」(급전·대출·직군 URL) 섹션 **삭제** (P0 1.3과 동일 작업)  
- [ ] **0-R.5.3** `public/llms.txt` — 공식 페이지 목록: `/`, `/about/`, `/guide/`, `/structure/`, `/reviews/` (+ `/disclosures/` P1 후)  
- [ ] **0-R.5.4** `test/seo.test.js` — llms.txt assert — `폰깡`/`급전` 기대 제거, `유심 혜택`·`서울평가정보` 기대 추가

### 0-R.6 네이버·블로그 문서·원고 (저장소)

- [ ] **0-R.6.1** `docs/naver-blog-brand.md` — 소개글·별명 — 1층: `유심 혜택`, `서울평가정보㈜`, `climekr.com`; 「대출·폰깡·대부 아닌」을 **한 줄 사실**로만 (제목급 반복 금지); **채널 공통** 절(P2) 초안 있으면 1층 블록과 문장 일치  
- [ ] **0-R.6.2** `docs/naver-blog-seo.md` — 카테고리 표·태그 — `급전대안`, `폰깡` 제거; `유심개통혜택` → **`유심혜택`**, `클라임유심`, `조건부혜택`  
- [ ] **0-R.6.3** `scripts/naver-blog/posts/00-pillar-usim-benefit-naver.md` — 제목 **유심 혜택**으로 시작; 태그에서 `급전대안`, `폰깡` 제거  
- [ ] **0-R.6.4** `scripts/naver-blog/posts/01-*.md`, `04-guide-milestones.md` — 1층 제목·리드 점검 (구분은 05에 집중)  
- [ ] **0-R.6.5** `scripts/naver-blog/checklist.md` — 발행 전 1층 금지어 스캔 항목 추가  
- [ ] **0-R.6.6** `assets/naver-blog/README.md` — (참고) 시각 자산에 대출/폰깡 연상 없음 유지

### 0-R.7 0-R 게이트

- [ ] **0-R.7.1** `npm test` — `content-api`, `seo`, `public-readable-seo`, `public-page`, `marketing-guide` **green**  
- [ ] **0-R.7.2** 로컬 `rg -i "통신혜택|통신 혜택|급전|폰깡" public/index.html public/guide/index.html public/llms.txt functions/api/content.js` → **0건** (structure·topics·disclosures 제외)  
- [ ] **0-R.7.3** D1 프로덕션 `home` — admin에서 intro/seo 발행 또는 0-R.2.4 legacy 치환으로 **구 장문 노출 없음** 확인 (배포 후 smoke)

---

## 1. P0 — 크롤러·AI 주제 그래프 + UI

> 목표: `/topics/` **색인 중단**, 301, sitemap/robots/llms 정렬, live-activity 제거. **0-R 카피와 동시 배포.**

### 1.1 사이트맵·robots

- [ ] **1.1.1** `public/sitemap.xml` — `/topics/` 및 하위 8 URL **삭제**; `lastmod` 실제 수정일 — **수용:** `<loc>`에 `topics` 없음  
- [ ] **1.1.2** `public/sitemap.xml` — P1 완료 후 `/disclosures/` URL 추가 (미리 placeholder 주석 가능)  
- [ ] **1.1.3** `functions/robots.txt.js` — `Allow: /topics/` **삭제**; 주석 topics 설명 수정 — **수용:** 프로덕션 robots에 topics Allow 없음  
- [ ] **1.1.4** `test/seo.test.js` — sitemap·robots 기대값 갱신

### 1.2 Topics 리다이렉트·noindex

- [ ] **1.2.1** `functions/_middleware.js` — `/topics`, `/topics/*` → **301** (매핑 예: 허브·급전·대출·직군 → `/guide/`; `usim-benefit` → `/structure/` — 아키텍처 IA 표) — **수용:** `curl -sI` Location이 상품 URL  
- [ ] **1.2.2** (301 전 임시) `public/topics/**/index.html` — `<meta name="robots" content="noindex,follow">` (301 우선이면 생략)  
- [ ] **1.2.3** `test/retired-investment-paths.test.js` 또는 **신규** `test/topics-redirect.test.js` — 301 Location·비-410 경로 회귀 — **수용:** `/topics/urgent-money/` → 301  
- [ ] **1.2.4** `test/marketing-guide.test.js` — middleware import 경로 유지 확인

### 1.3 llms.txt (그래프)

- [ ] **1.3.1** 0-R.5 완료 확인 (중복 작업 방지)  
- [ ] **1.3.2** `test/seo.test.js` — topics URL 문자열 assert **없음**

### 1.4 홈 UI (0-R와 병행)

- [ ] **1.4.1** `public/index.html` — 0-R.3.4 공감·프로세스 카드  
- [ ] **1.4.2** `public/index.html` — `public/live-activity.css`, `public/live-activity.js` **link·script 제거**; `.trust-bar`·연동 마크업 정리  
- [ ] **1.4.3** `public/live-activity.js` — (선택) 파일 삭제 또는 README에 “미로드” 명시; 다른 페이지에서 import 없음 확인  
- [ ] **1.4.4** `test/live-activity.test.js` — 홈 HTML에 live-activity **미참조** 검증으로 조정

### 1.5 CMS·D1 (0-R와 병행)

- [ ] **1.5.1** 0-R.2 완료  
- [ ] **1.5.2** (배포 후) admin `public/admin/content-editor.js` — D1 `home` intro/seo가 구버전이면 수동 발행 또는 legacy 치환 동작 확인

### 1.6 가이드 Worker

- [ ] **1.6.1** `functions/guide/index.js` — 지급표 D1 주입 유지; HTML 1층은 0-R.4  
- [ ] **1.6.2** `test/guide-edge-render.test.js` — payout 주입 회귀 없음

### 1.7 P0 테스트 게이트

- [ ] **1.7.1** 저장소 루트 `npm test` **전체 통과** (186+ tests, 스냅샷일 기준)  
- [ ] **1.7.2** (선택) `npx wrangler pages functions build` — Functions 번들 오류 없음  
- [ ] **1.7.3** `test/cloudflare-config.test.js` — wrangler·문서 앵커 깨짐 없음

---

## 2. P1 — 정체·고지·스키마·블로그 문서

### 2.1 JSON-LD·정체

- [ ] **2.1.1** `functions/index.js` `buildStructuredData` — Organization: `taxID` `114-81-47958`, `address`(마포구 토정로 144), `foundingDate` `1992-07-27`, `sameAs` `https://blog.naver.com/climeusimguide` — **수용:** Rich Results Organization 필드 채움  
- [ ] **2.1.2** `functions/index.js` — Service `serviceType` 2층 문구 유지 가능; `@id` `https://climekr.com/#service`  
- [ ] **2.1.3** `public/structure/index.html` — Organization `@id` → **`https://climekr.com/#organization` 참조만**; 중복 Organization 노드 제거  
- [ ] **2.1.4** `public/about/index.html` — Organization 중복 선언 정리; **`git add public/about/`**  
- [ ] **2.1.5** `public/structure/index.html` — FAQPage `mainEntity` 조직 `@id` → `#organization` 통일  
- [ ] **2.1.6** `test/seo.test.js`, `test/public-readable-seo.test.js` — JSON-LD assert (FAQPage 홈 **없음** 유지)

### 2.2 Disclosures (2층·법무)

- [ ] **2.2.1** `public/disclosures/index.html` 생성 — 목차: 사업자(→ `/structure/`), 서비스 조건, 상담 개인정보, 금지 행위  
- [ ] **2.2.2** `public/disclosures/service/index.html`, `privacy/index.html`, `safety/index.html` (또는 단일 페이지 앵커) — 슬러그 **`/disclosures/`** 만  
- [ ] **2.2.3** `functions/_lib/retired-investment.js` — 410 목록과 **경로 충돌 없음** 검사 — **수용:** `/disclosures/` → 200, `/terms` → 410  
- [ ] **2.2.4** `public/sitemap.xml` — disclosures URL 추가  
- [ ] **2.2.5** `public/index.html`, `public/guide/index.html`, `public/structure/index.html` 푸터 — disclosures 링크  
- [ ] **2.2.6** `test/not-found-page.test.js` — (해당 시) disclosures 200 회귀

### 2.3 푸터·운영자 정보

- [ ] **2.3.1** `public/index.html` 푸터 — 소재지·법인등록번호 — `public/structure/index.html`과 동일 문장 또는 구조 링크  
- [ ] **2.3.2** (선택) `functions/api/content.js` `operator.address` + `public/admin/content-editor.js` 필드

### 2.4 레거시 410

- [ ] **2.4.1** `functions/_lib/retired-investment.js` — **`git add`·커밋** (운영자 요청 시)  
- [ ] **2.4.2** `functions/_middleware.js` — retired paths 410 연동  
- [ ] **2.4.3** `test/retired-investment-paths.test.js` — 전 경로 410·비-retired 200/301 **통과**

### 2.5 네이버·문서 (저장소)

- [ ] **2.5.1** `docs/naver-blog-seo.md` — 「블로그 카테고리 (개명)」 표 (아키텍처)  
- [ ] **2.5.2** `docs/naver-blog-official-research.md` — L141–142: 구분 비교는 **구분 글·structure**; 1층 제목 낚시 금지  
- [ ] **2.5.3** `scripts/naver-blog/posts/02-urgent-money-alternative.md`, `03-loan-rejected-alternative.md` — **발행 중단/비공개** 운영 메모 상단  
- [ ] **2.5.4** `docs/2026-10-26-public-readable-seo-audit.md` — (참고) FAQPage 정책 변경 이력 유지

### 2.6 P1 테스트·수동

- [ ] **2.6.1** `npm test` 전체 통과  
- [ ] **2.6.2** [Rich Results Test](https://search.google.com/test/rich-results) — `/`, `/structure/`, `/about/` Organization **중복 없음**

---

## 3. P2 — 채널 SSOT·금액·정리

- [ ] **3.1** `docs/naver-blog-brand.md` — 「채널 공통」: 바이오, 텔레그램 고정, 채널톡 인사, 릴스 자막 4줄 — **1층 유심 혜택** 블록과 동일 문장  
- [ ] **3.2** `public/links/index.html` — 고지 = 채널 공통 블록  
- [ ] **3.3** `functions/structure/index.js` **(신규, 선택)** — `/structure/` 금액표 D1 `payout` 주입 (`functions/guide/index.js` 패턴)  
- [ ] **3.4** `public/structure/index.html` — 3.3 미적용 시 하드코딩 66만·5·7·10만 CMS와 수동 동기화  
- [ ] **3.5** topics 정적 HTML 삭제 — 301·GSC 404 안정 **2주+** 후 `public/topics/**` 삭제 여부 결정  
- [ ] **3.6** `npm test`

---

## 4. 로컬 검증

- [ ] **4.1** Node 22+ — `npm test`  
- [ ] **4.2** `.dev.vars` — 로컬 전용 `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_AUTH_SECRET` (값은 `.env`에서 복사하지 말고 운영자가 로컬만 설정)  
- [ ] **4.3** D1 로컬:
  ```bash
  npx wrangler d1 migrations apply usim-plus-content --local
  ```
- [ ] **4.4** Pages 로컬:
  ```bash
  npx wrangler pages dev public --local --port 8788
  ```
- [ ] **4.5** 수동 smoke (로컬 `http://127.0.0.1:8788`):
  - [ ] `/` — intro·메타에 **유심 혜택**; `live-activity` **없음**; empathy **topics 링크 없음**
  - [ ] `/guide/` — H1 1층 톤; 지급표 숫자 CMS와 일치
  - [ ] `/structure/` — 알뜰폰·선불·비용 **2층** 존재 가능
  - [ ] `/topics/urgent-money/` — **301** + `Location`
  - [ ] `/terms` — **410**
  - [ ] `/robots.txt` — topics Allow 없음
  - [ ] `/llms.txt` — topics 섹션 없음; 첫 단락 캐논

---

## 5. 스테이징 / 프리뷰 (선택)

- [ ] **5.1** PR 또는 non-`main` push → Cloudflare Pages Preview URL 확인  
- [ ] **5.2** 프리뷰 — `X-Robots-Tag: noindex` (`functions/_middleware.js`)  
- [ ] **5.3** 프리뷰 hostname ≠ canonical — sitemap·OG canonical은 `climekr.com`; **301·카피는 로컬 smoke + 프로덕션 배포 후** 재검증

---

## 6. 프로덕션 배포 (climekr.com)

### 6.1 사전 (인프라 — 변경 시에만)

- [ ] **6.1.1** D1 원격 pending migration:
  ```bash
  npx wrangler d1 migrations apply usim-plus-content --remote
  ```
- [ ] **6.1.2** retention Worker 변경 시:
  ```bash
  npx wrangler deploy --config wrangler-retention.toml
  ```
- [ ] **6.1.3** R2 lifecycle, Pages 바인딩 — [`docs/cloudflare-application-review-setup.md`](./cloudflare-application-review-setup.md)

### 6.2 애플리케이션 배포

- [ ] **6.2.1** PR 리뷰 · `npm test` CI green (또는 로컬 최종 `npm test`)  
- [ ] **6.2.2** **`main` merge/push** → GitHub `goldeget/usim-plus-site` → Pages 자동 배포  
- [ ] **6.2.3** Cloudflare 대시보드 — 배포 **Success** · 커밋 SHA = 0.2 기록과 비교  
- [ ] **6.2.4** (필요 시) Pages **Purge cache** — HTML·301 반영

### 6.3 DNS·커스텀 도메인

- [ ] **6.3.1** `climekr.com`, `www.climekr.com`, `admin.climekr.com` — Pages 연결 유지 확인  
- [ ] **6.3.2** `curl -sI https://www.climekr.com/` → **308** → apex  
- [ ] **6.3.3** `curl -sI https://climekr.com/` → **200**

---

## 7. 배포 후 (Post-deploy)

### 7.1 Smoke URL (프로덕션)

- [ ] **7.1.1** `https://climekr.com/sitemap.xml` — **topics 없음**; `/`, `/about/`, `/guide/`, `/structure/`, `/reviews/`, `/disclosures/`(P1)  
- [ ] **7.1.2** `https://climekr.com/robots.txt` — Sitemap; Disallow `/admin/`, `/api/`; **Allow /topics/ 없음**  
- [ ] **7.1.3** `https://climekr.com/llms.txt` — 1층 캐논; topics URL 없음  
- [ ] **7.1.4** topics 구 URL — `curl -sI` **301** Location  
- [ ] **7.1.5** `https://climekr.com/terms` — **410**  
- [ ] **7.1.6** `https://climekr.com/` — view-source: meta·intro에 **유심 혜택**; **통신혜택·급전·폰깡 없음**  
- [ ] **7.1.7** `https://admin.climekr.com/` — 로그인·대시보드  
- [ ] **7.1.8** `https://climekr.com/reviews/` — 목록 로드

### 7.2 검색 콘솔

- [ ] **7.2.1** [Google Search Console](https://search.google.com/search-console) — `https://climekr.com/sitemap.xml` **재제출**  
- [ ] **7.2.2** [네이버 서치어드바이저](https://searchadvisor.naver.com/) — 동일 사이트맵; **구 topics URL 재수집 요청 금지**  
- [ ] **7.2.3** (선택) IndexNow — `public/2cc7263262b5a365ad26c37e214acd2b.txt` 키 — `/`, `/guide/`, `/structure/`, `/about/` 알림

### 7.3 AI 수동 검증 (기록만)

Gemini / Google AI — 패치 전·후 각 1회 ([Metrics](./clime-platform-patch-architecture.md#metrics--validation)):

1. `클라임유심이 무슨 회사야?`
2. `climekr.com 은 대출이야?`
3. `서울평가정보 유심 혜택 조건`
4. `클라임유심 폰깡이야 내구재야?`

- [ ] **7.3.1** 인용 URL·첫 문장 명사 스크린샷/텍스트 저장 — **기대 방향:** `climekr.com/structure|guide|about`, 명사 **유심 혜택**·**서울평가정보**; `/topics/` 인용이면 P0 미완

### 7.4 네이버 블로그 (수동)

`scripts/naver-blog/checklist.md`, `docs/naver-blog-brand.md`

- [ ] **7.4.1** 프로필·커버·주제 — **유심 혜택**·**서울평가정보㈜**; 1층 금지어 없음  
- [ ] **7.4.2** 카테고리 개명·삭제 (급전·대출거절·직군)  
- [ ] **7.4.3** 글 02·03 **비공개**; 00·01·04·05 제목·태그; 하단 링크 → `/`, `/guide/`, `/structure/` (**topics 금지**)  
- [ ] **7.4.4** 블로그 서치어드바이저 색인 (사이트와 별도)

### 7.5 상담 채널 (저장소 밖)

- [ ] **7.5.1** 텔레그램·채널톡 고정 — `copy.consultationSafety` + disclosures + `docs/naver-blog-brand.md` 채널 공통 (스크린샷)

---

## 8. 롤백

- [ ] **8.1** **Pages Rollback** — Deployments → 0.2 SHA Success  
- [ ] **8.2** **Git revert** on `main` → 재배포 (force push 금지 unless approved)  
- [ ] **8.3** D1 migration **되돌리기 어려움** — 0.3 백업 필수  
- [ ] **8.4** topics 301 롤백 시 구 URL 200+대출 본문 → GSC 재제출  
- [ ] **8.5** retention Worker — 이전 버전 재배포 + Cron 확인

---

## 부록 A — `npm test` Suite 맵 (카피 변경 시)

| 우선순위 | 파일 | 패치·0-R 관련 assert |
| --- | --- | --- |
| **0-R 필수** | `test/content-api.test.js` | DEFAULT intro/seo, LEGACY 치환 |
| **0-R 필수** | `test/seo.test.js` | meta, JSON-LD, sitemap, robots, **llms.txt** |
| **0-R 필수** | `test/public-readable-seo.test.js` | `#homeIntro`, FAQ 부재, Service description |
| **0-R** | `test/public-content-metadata.test.js` | HTMLRewriter title/description |
| **0-R** | `test/public-page.test.js` | 홈 구조·카피 |
| **0-R** | `test/marketing-guide.test.js` | 가이드 H1·middleware |
| P0 | `test/live-activity.test.js` | 위젯 미로드 |
| P0/P1 | `test/retired-investment-paths.test.js` | 410; topics 비-410 |
| P1 | `test/admin-middleware.test.js` | admin·www |
| P1 | `test/guide-edge-render.test.js` | guide payout |
| 배포 전 | `test/cloudflare-config.test.js` | wrangler·문서 |
| 전체 | `npm test` | 회귀 |

---

## 부록 B — 1층 수정 파일 인덱스 (빠른 grep)

| 파일 | 0-R | P0 | P1 |
| --- | --- | --- | --- |
| `functions/api/content.js` | ● | | |
| `functions/index.js` | ● | | ● |
| `public/index.html` | ● | ● | ● |
| `public/guide/index.html` | ● | | ● |
| `public/llms.txt` | ● | ● | |
| `public/links/index.html` | ● | | P2 |
| `public/reviews/index.html` | ● | | |
| `docs/naver-blog-brand.md` | ● | | P2 |
| `public/sitemap.xml` | | ● | ● |
| `functions/robots.txt.js` | | ● | |
| `functions/_middleware.js` | | ● | ● |
| `public/topics/**` | | ● | |
| `public/structure/index.html` | 2층 | | ● |
| `public/about/index.html` | | | ● |
| `public/disclosures/**` | | | ● |

---

*체크리스트는 [`clime-platform-patch-architecture.md`](./clime-platform-patch-architecture.md)와 함께 갱신한다. **커밋은 운영자 요청 시에만.***
