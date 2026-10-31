# 운영 배포 결과 — 2026-11-01

운영 주소: https://climekr.com/

## 배포 확인

- 운영 브랜치 `main`에 `ce7698b6930e816bbce6550933c5f823c98f5f4e` 반영 완료. 원격 main SHA도 같은 값임을 재확인했다.
- [GitHub CI](https://github.com/goldeget/usim-plus-site/actions/runs/41244666507): Node 22 test suite succeeded.
- [Cloudflare Pages 체크](https://github.com/goldeget/usim-plus-site/runs/124665574927): `Deployed successfully`, latest commit `ce7698b` 확인.
- Cloudflare 배포 식별 URL: https://79377b35.usim-plus-site.pages.dev . 이 URL은 제공자 체크에 표시된 값이며 직접 HTTP 확인은 아래 실제 운영 도메인에서 수행했다.
- 최초 검증 코드 `08a759a`를 먼저 배포한 뒤, 실제 운영 CMS의 미처리 이전 문구를 발견해 `ce7698b`로 보완 배포했다.

## 운영 CMS에서 확인해 수정한 항목

실제 공개 `/api/content`에서 다음 기존 값이 남아 있었다.

- 검색 제목: ‘클라임유심 CLIME | 개통·통신비 회사 부담 · 최대 {{MAX_TOTAL}} 혜택’.
- 공유 제목: ‘CLIME 유심 혜택 | 고객 비용 회사 부담 · 조건 충족 시 최대 {{MAX_TOTAL}}’.
- 비용 FAQ: ‘유심 개통·통신 비용은 누가 부담하나요?’와 실제 계약·회사 부담 범위 확인을 안내하는 이전 답변.

이 세 가지의 **정확한 이전 문구 조합만** 읽기 단계에서 현재 안내로 변환한다. 임의의 사용자 지정 SEO/FAQ, 운영사, 금액, 채널, 원본 객체는 보존한다. 운영 D1에 별도 쓰기·초기화·스키마 변경을 수행하지 않았다. 독립 리뷰 PASS 및 신규 재현 테스트를 포함한 전체235개 테스트 통과 후 배포했다.

## 운영 사이트 실검증

프록시와 TLS 검증을 유지한 Chromium 일반 브라우저에서 확인했다.

- 홈페이지 HTTP200. 새 검색 제목 ‘클라임유심 | 유심 혜택 · 유심 혜택 확인 · 최대66만원 | 서울평가정보㈜’ 확인(띄어쓰기는 실제 응답 JSON 참조).
- 간결한 첫 화면·서비스 정의·이용 비용0원·주요 조회 CTA 표시. 모바일390×844에서 CTA가 클릭 가능한 최상위 요소이며 화면 안에 있고 가로 넘침이 없음을 확인.
- `.sticky-cta`가0개로 떠 있는 상담 CTA 제거 반영 확인.
- `/api/content` HTTP200, 현재 검색 제목과 비용 FAQ가 정정된 값임을 확인.
- `/api/service-facts` HTTP200, `customerCostWon=0`, 별도 계약서/통신요금 납부 false, 실제 CMS 출처 확인.
- 소개·이용 절차·혜택 조건·상담 링크·고지 및 세 하위 페이지·공식 정보·llms·robots·sitemap HTTP200.
- 공개 호스트 `/admin/` HTTP404, `/api/admin/applications` HTTP401로 보호 유지.
- `/topics/urgent-money/`가 `/guide/`로 이동해 HTTP200. 실제 fetch의 redirected와 최종 URL 기록.
- 종료된 `/terms` HTTP410, `POST /api/applications` HTTP410. 새 접수나 실제 이용자 데이터 쓰기는 발생시키지 않았다.
- 홈페이지 외19개 경로/메서드 검사를 모두 기대 상태와 대조했다. 모든 경로가200이라는 뜻이 아니라 보호/종료 상태까지 정상이라는 의미다.
- 생성 후기·활동 보호 파일131개의 원본 해시가 그대로임을 재확인했다.

## 확인 범위와 남은 한계

- 로컬 전체 테스트235개 통과/실패0/skip0. 기존 화면·확대·CTA·커스텀 CMS 검증은 [구현 검증 보고서](2026-11-01-platform-patch-results.md) 참조.
- GitHub CI에는 기존 checkout/setup-node 액션 런타임과 Ubuntu runner 변경에 대한 warning/notice가 있으나, 테스트 및 배포 결과는 succeeded였다. 이번 배포를 위해 무관한 CI 버전 변경을 추가하지 않았다.
- 이 실행 환경의 urllib 자동 요청은403을 반환했다. 같은 허용 프록시의 일반 Chromium에서는 운영 사이트와 동일 출처 API가 정상 동작했다. 따라서 이를 전체 사이트 장애나 모든 검색 크롤러 차단으로 단정하지 않는다. Googlebot 등 실제 크롤러의 접근·색인은 별도 검증 항목이다.
- 공적 사업자 등록 상태, 실제 사용자 Gemini/Grok/ChatGPT 답변 및 검색 색인 갱신 완료를 검증한 것은 아니다. 배포 성공을 AI 답변 교정 성공으로 확대하지 않는다.
- 조회용 네트워크 도메인 추가 초안은 대체 검증 경로가 확보된 후 원래의 허용 목록으로 복구했다. 클라우드 환경 Publish는 수행하지 않았다. Cloudflare 운영 사이트 배포와 환경 스냅샷 게시는 별개다.
- 본 보고서와 증거는 작업 브랜치에 보존한다. 운영 main의 배포 코드는 위 `ce7698b`이며, 이후 보고서 보존용 커밋에는 제품 코드 변경이 없다.

## 증거

- [배포·CI 상태](2026-11-01-production-status.json)
- [운영 HTTP·CTA 검사](2026-11-01-production-smoke.json)
- [실제 운영 모바일 첫 화면](screenshots/production-home-mobile.png)
- [운영 CMS 보완 독립 리뷰](reviews/production-cms.md)
