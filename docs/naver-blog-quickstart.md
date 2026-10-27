# 네이버 블로그 `climeusimguide` — 지금 할 일 (순서)

블로그 ID 생성과 레포 콘텐츠·3D 비주얼은 준비됐습니다. **네이버 관리자 저장**과 **글 발행**은 비밀번호 재확인·업로드 UI 때문에 브라우저에서 직접 마무리해야 합니다.

## 0. 자동화용 `.env` (선택)

1. 루트에서 `.env.example` → `.env` 복사 후 `NAVER_ID`, `NAVER_PASSWORD` 입력 (`.env`는 git 제외)
2. 확인: `node scripts/naver-blog/load-env.mjs` 또는 `node scripts/naver-blog/automation/login.mjs`
3. Cursor 브라우저 자동화(캡차·재확인만 직접): [`HITL-WORKFLOW.md`](../scripts/naver-blog/automation/HITL-WORKFLOW.md) · 절차 [`runbook.md`](../scripts/naver-blog/automation/runbook.md) — 채팅에 **「로그인부터 HITL 진행」** → 막히면 처리 후 **「완료」**

## 1. 기본 정보 + 이미지 (5분)

1. [블로그 기본정보 관리](https://admin.blog.naver.com/AdminUserBasic.naver?blogId=climeusimguide) 열기 (네이버 로그인)
2. [`naver-blog-brand.md`](./naver-blog-brand.md)에서 **블로그명 · 별명 · 소개글** 붙여넣기
3. **주제:** IT·컴퓨터 또는 비즈니스·경제 선택
4. **프로필:** `assets/naver-blog/clime-naver-profile-3d.jpg`
5. **커버:** `assets/naver-blog/clime-naver-mobile-cover-3d.jpg`
6. **확인** → 비밀번호 재확인 창이 뜨면 입력

## 2. PC 배너 (선택)

관리 → **디자인 설정** → `assets/naver-blog/clime-naver-pc-cover-3d.jpg`

## 3. 카테고리

[`naver-blog-seo.md`](./naver-blog-seo.md) 표대로 5개 카테고리 생성

## 4. 첫 게시글 (공식 조사 반영)

**우선:** [`naver-blog-first-post-playbook.md`](./naver-blog-first-post-playbook.md) — 원고 `00-pillar-usim-benefit-naver.md`, 이미지 6장 `assets/naver-blog/posts/post-00/`  
**근거:** [`naver-blog-official-research.md`](./naver-blog-official-research.md) (네이버 Help·서치어드바이저 인용)

이후 [`scripts/naver-blog/posts/`](../scripts/naver-blog/posts/) 01~05 · 체크 [`checklist.md`](../scripts/naver-blog/checklist.md)

## 5. 검색 등록

[네이버 서치어드바이저](https://searchadvisor.naver.com/) — `climekr.com`(이미 검증 파일 있음) + 블로그 URL 등록·수집 요청

---

**URL:** https://blog.naver.com/climeusimguide  
상위 노출은 **꾸준한 발행 + 키워드 일치 + 공식 사이트 연동**으로 쌓는 것이 현실적인 방법입니다.
