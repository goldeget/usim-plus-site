# climekr.com 과거 투자 플랫폼 Google 검색결과 정리

운영 기준일: 2026-10-26 (KST)

## 확인된 현재 상태

- Cloudflare DNS: `climekr.com`, `www.climekr.com`, `admin.climekr.com`은 모두 현재 `usim-plus-site.pages.dev`로 연결된다.
- Cloudflare Pages: 세 사용자 지정 도메인이 active이며, production은 `main`이다.
- 현재 코드 `functions/_middleware.js`: `www.climekr.com`의 요청은 같은 경로의 `https://climekr.com` 주소로 **308 영구 리디렉션**된다.
- 실제 웹 콘텐츠 조회에서 `https://www.climekr.com/`의 최종 URL은 `https://climekr.com/`이었다.
- 실제 Google 검색결과 속에 남은 **과거 투자 플랫폼의 정확한 제목·URL**은 이 작업에서 재현하지 못했다. URL이 없을 때 임의의 투자 페이지 경로나 삭제 대상 URL을 만들어서는 안 된다.
- 최신 공식 검색용 표기는 현재 서비스인 유심 혜택, 최대 66만원(조건부), 고객 관련 비용 회사 전액 부담(운영사 설명 기준), 별도 유지 조건을 일치시킨다. 과거 금액 51만원인 원본 HTML과 llms.txt 정적 폴백도 갱신한다.

## 구글에서 과거 결과를 없애는 실제 절차

1. [Google Search Console](https://search.google.com/search-console)에 로그인하여 소유권이 확인된 **도메인 속성 `climekr.com`**을 선택한다. 인증이 없으면 Cloudflare DNS로 구글이 제공한 TXT 인증 값을 등록한다. 인증 문자열은 구글이 발급한 것만 사용하며 임의 생성하지 않는다.
2. 상단의 URL 검사에 `https://climekr.com/`을 입력하고 **실제 URL 테스트 → 색인 생성 요청**을 진행한다. 함께 `https://www.climekr.com/`을 검사하여 영구 리디렉션과 올바른 대표 URL 인식을 확인한다.
3. 사이트맵에서 `https://climekr.com/sitemap.xml`을 제출한다. 실제 사이트맵에는 새 유심 안내 페이지 `/guide/`만 추가되며, `/links/`는 검색색인 제외다.
4. 구글 검색에 남은 **정확한 과거 투자 플랫폼 URL**을 결과의 링크에서 복사한다. 실제 페이지와 1:1로 대응하는 새 페이지가 있다면 301/308로 이동시킨다. 완전히 삭제된 과거 투자 페이지는 명확한 HTTP 404 또는 410을 반환하도록 한다. 그 URL을 우선 Google URL 검사에서 확인한다.
5. 과거 투자 페이지의 개별 URL이 검색결과에 그대로 노출되어 긴급한 숨김이 필요하면 Search Console의 **색인 > 삭제(Removals)**에서 해당 개별 URL만 임시 삭제를 요청할 수 있다. 단, 이 작업은 구글 검색에 한해 약 6개월만 유효하다. 원본 URL도 실제로 제거되거나 404/410이 되어야 영구적인 정리가 가능하다.
6. **`https://climekr.com/` 또는 `https://www.climekr.com/`의 전체 접두어를 삭제 요청하지 않는다.** 현재의 공식 홈페이지 검색결과까지 사라질 수 있다. 이전 투자 플랫폼 텍스트만 남은 **같은 홈페이지 URL**은 삭제가 아니라 **최신 본문으로 재크롤링**을 요청한다.
7. Google이 다시 크롤링하는 기간에는 기존 투자 플랫폼 제목이나 스니펫이 잠시 표시될 수 있다. 색인 갱신은 즉시 처리나 순위 확보를 보장하지 않는다.

## 금지 사항

- `robots.txt`로 이전 URL을 차단하면서 삭제를 기대하지 않는다. Google이 404/410이나 noindex를 크롤링하지 못하면 오래된 색인이 남을 수 있다.
- 검색 결과 정리 목적으로 현재 공개 홈페이지를 `noindex` 처리하지 않는다.
- Google 색인을 빠르게 바꾸기 위해 검색엔진을 속이는 무관한 대출 페이지나 중복 도메인 생성은 하지 않는다.
- 정확히 알려지지 않은 과거 URL에 무작정 Cloudflare 전체 경로 리디렉션·410 규칙을 적용하지 않는다.

## 체크리스트

- [ ] 공식 메인에서 66만원 조건부 혜택과 고객 비용 회사 부담 안내가 일치한다.
- [ ] `www` 방문 시 `climekr.com`으로 영구 리디렉션한다.
- [ ] `climekr.com`의 canonical 메타태그와 사이트맵이 일치한다.
- [ ] 현재 공식 페이지는 `index`, SNS 링크 허브와 Pages 미리보기는 `noindex`다.
- [ ] Google Search Console의 URL 검사로 공식 URL 재수집을 요청했다.
- [ ] Google Search Console에 사이트맵을 제출했다.
- [ ] 이전 투자 플랫폼 결과의 개별 정확한 URL을 수집하고 404/410 또는 적절한 리디렉션을 확인했다.
- [ ] 사라진 과거 URL에 한해 필요하면 임시 삭제를 신청했다.
- [ ] 구글 검색에서 이전 제목·본문이 갱신되었는지 이후 다시 확인한다.

출처:
- https://developers.google.com/search/docs/crawling-indexing/301-redirects
- https://support.google.com/webmasters/answer/9689846?hl=ko
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://developers.google.com/search/docs/crawling-indexing/remove-information
