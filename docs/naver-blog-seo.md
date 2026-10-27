# CLIME 네이버 블로그 SEO 운영 가이드

> **현실적인 목표:** 네이버는 “무조건 1위”를 보장할 수 없습니다. 키워드·주제·내부링크·꾸준한 발행·서치어드바이저 등록으로 **유심 개통 혜택 / 클라임유심 / CLIME** 관련 검색에서 노출 가능성을 높이는 것이 목표입니다.

## 블로그 계정

| 항목 | 값 |
|------|-----|
| 블로그 ID | `climeusimguide` |
| URL | https://blog.naver.com/climeusimguide |
| 네이버 ID | `glo` (로그인 계정) |
| 공식 사이트 | https://climekr.com/ |
| 사이트 소유 확인 | `public/navercb78a18ae519c02b17c8618a7b72822c.html` (배포됨) |
| 메타 태그 검증 | `public/index.html` `naver-site-verification` |

**한 번에 따라하기:** [`naver-blog-quickstart.md`](./naver-blog-quickstart.md)  
프로필 문구(복사용): [`naver-blog-brand.md`](./naver-blog-brand.md) · 3D 비주얼: [`assets/naver-blog/README.md`](../assets/naver-blog/README.md)

## 프로필 SEO (관리 → 기본 설정 → 블로그 정보)

1. **블로그명:** `클라임유심 유심 개통·혜택 안내` (25자 이내)
2. **별명:** `클라임유심혜택` (10자 이내)
3. **소개글:** 운영사·대출 아님·공식 URL·광고 표기 (200자 이내, `naver-blog-brand.md`)
4. **주제:** IT·컴퓨터 또는 비즈니스·경제 (필수)
5. **프로필/커버:** `assets/naver-blog/` 이미지 업로드 권장
6. **확인** 클릭 후 네이버 **비밀번호 재확인** 창이 뜨면 직접 입력 (자동화 불가)

## 카테고리 (메뉴·글 관리 → 카테고리)

`/topics/` 구조와 맞춥니다.

| 카테고리명 | 대응 사이트 |
|-----------|-------------|
| 유심 개통 혜택 안내 | `/topics/usim-benefit/` |
| 급전·생활비 대안 | `/topics/urgent-money/` |
| 대출 거절·대안 | `/topics/loan-rejected/` |
| 직장인·주부·학생·사업자 | `/topics/worker/` 등 |
| CLIME 공식 안내 | `/guide/` |

## 코너스톤 글 (5편)

마크다운 원고: [`scripts/naver-blog/posts/`](../scripts/naver-blog/posts/)

- 사이트 HTML과 **동일 문장 복붙 금지** — 블로그용으로 각각改稿됨
- 매 글 하단: 공식 링크 `https://climekr.com/...` + 상담 `t.me/climeusim` + **[운영사 제공 정보·광고 포함]** 문구

## 글 작성 체크리스트 (매 발행)

- [ ] 제목에 핵심 키워드 1~2개 (유심 개통 혜택, 클라임유심, 유심 지원금 등)
- [ ] 본문 1,500자 이상 + 소제목(H2) 3개 이상
- [ ] FAQ 블록 3~5개
- [ ] climekr.com 해당 주제 **canonical 링크** 1회 이상
- [ ] 대출·폰깡 **아님** 명시 (과장·당일 현금 보장 표현 금지)
- [ ] 협찬/광고 해당 시 네이버 **광고·협찬 표시** 설정
- [ ] 태그 5~10개 (예: `유심개통혜택`, `클라임유심`, `CLIME`, `유심지원금`, `급전대안`)

## 네이버 서치어드바이저

1. https://searchadvisor.naver.com/ 접속
2. **사이트 등록:** `https://climekr.com` — HTML 파일 또는 메타 태그로 소유 확인
3. **블로그 URL** `https://blog.naver.com/climeusimguide` 별도 등록(가능 시)
4. **사이트맵:** `https://climekr.com/sitemap.xml` 제출(있을 경우)
5. **수집 요청:** 코너스톤 글 URL 각각 요청

## 발행 cadence (상위 노출 “전략”)

| 주차 | 행동 |
|------|------|
| 1주 | 프로필 저장 + 카테고리 + 코너스톤 3편 |
| 2주 | 코너스톤 2편 + 주 2회 짧은 FAQ 글 |
| 3주~ | 주 2~3회, 검색어 변형(급전 대안, USIM 혜택 조건 등) |

## 자동화 한계

네이버 블로그 **공식 Open API로 일반 글 자동 발행은 제한**됩니다. 이 저장소에서는:

- `scripts/naver-blog/extract-topic-prose.mjs` — `public/topics/` HTML에서 본문 추출
- `scripts/naver-blog/posts/*.md` — 발행용 원고
- (선택) Cursor 브라우저 MCP / Playwright로 **로그인 세션** 글쓰기 — 비밀번호 재확인·캡차 시 수동 개입 필요

## 준수

- 정보통신망법·표시광고법: 상업·유료성 안내는 **광고 표시**
- “대출”, “즉시 승인”, “100% 지급” 등 **미확정 수익·대출 연상** 표현 지양
- 서울평가정보(주) / CLIME 공식 copy는 `public/`과 일치 유지
