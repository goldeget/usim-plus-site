# CLIME 무료 검색·SNS 유입 채널 운영안

기준일: 2026-10-26. 기존 저장소 `goldeget/usim-plus-site`의 실제 Cloudflare Pages 배포 구조를 유지한다.

## 현재 구현한 진입 경로

| 경로 | 목적 | 검색 색인 | 상담 링크 |
| --- | --- | --- | --- |
| `https://climekr.com/` | 공식 홈페이지·최신 관리자 공지 | index | 관리자 설정에 따라 노출 |
| `https://climekr.com/guide/` | 비대출 유심 개통 혜택·비용·지급시점에 관한 자세한 정보 | index | 텔레그램 / 채널톡 |
| `https://climekr.com/links/` | SNS 프로필용 링크인바이오 | noindex | 텔레그램 / 채널톡 |
| `https://usim-plus-site.pages.dev` | 동일 프로젝트의 기본 Pages 주소 | noindex | 클라임 공식 도메인으로 검색 신호 집중 |

`/guide/`는 `GET /api/content` 응답의 최신 단계별 지급액과 최대 건수를 표시한다. 응답 실패 시 숫자를 임의 표시하지 않고 상담에서 확인하도록 안내한다. 직접 링크는 `https://t.me/climeusim`과 `https://climeusim.channel.io`이며 관리자 설정에 동일한 허용 호스트의 URL이 있으면 이를 사용한다. LINE 링크는 노출하지 않는다.

## 검색 주제 설계

한 사이트에서 검색자에게 실질적인 정보를 제공하는 독립 페이지를 유지한다.

- **유심 개통 혜택 / CLIME 유심 혜택**: 제공 내용과 단계별 지급 기준
- **유심 개통 유지기간 / 유심 혜택 지급 시점**: 개통 후 지급 시점과 유지 조건
- **유심 개통 비용 / 본인 명의 유심 계약**: 개통비·통신요금·위약금·명의 책임
- **자금이 급할 때 유심 개통 혜택**: 대출과 다른 서비스라는 점, 즉시 지급이 아니라는 점

`당일대출`, `소액대출`, `개인급전` 등 대출 제공을 기대시키는 제목이나 URL로 유심 개통 서비스를 대출상품처럼 보이게 만들지 않는다. 대출이 어려운 이용자를 대상으로 '무심사', '즉시 현금', '무조건 66만원'을 보장하지 않는다.

## 무료 서비스 활용 기준

| 플랫폼 | 무료 주소 유형 | 권장 이용 |
| --- | --- | --- |
| Cloudflare Pages | `PROJECT.pages.dev` | 기존 운영 유지. 별도 도메인 구매 필요 없음 |
| Netlify Free | `SITE.netlify.app` | SNS 캠페인용 독립 안내 자산(중복 랜딩은 noindex) |
| Render Static Site Free | `SITE.onrender.com` | 기술 검증/프로토타입 |
| Linktree Free | `linktr.ee/USERNAME` | 인스타그램·X 프로필 링크 허브. 회원가입 및 고유 아이디 필요 |
| Google Sites | `sites.google.com/...` | 서비스와 구분되는 독립 문서·안내 콘텐츠 |
| Blogger / Tistory | 제공 블로그 주소 | 독창적인 정보성 글 발행 후 공식 안내 페이지에 연결 |
| Vercel Hobby | `SITE.vercel.app` | 상업적 홍보 사이트 운영에 부적절. Hobby는 개인 비상업 용도로 제한 |

중요: 각 플랫폼의 무료 상업적 이용 범위, 도메인 예약 가능 여부, 휴대전화/이메일 인증 요건은 계정 개설 시 재검토한다. 사이트 이름의 키워드 일치만으로 SEO 순위가 오르지 않으며, 특정 무료 주소가 선점 가능한지는 생성 전 알 수 없다.

## 동일한 사이트의 복제 배포 금지

검색 결과를 여러 무료 도메인으로 점유하기 위해 유사 랜딩페이지를 대량 생성하고 동일 상담 링크로 모으는 것은 Google Search Central의 Doorway Abuse / Scaled Content Abuse에 해당할 수 있다. 같은 콘텐츠의 여러 주소를 사용해야 한다면 대표 도메인을 지정하거나, SNS 용도라면 `noindex`한다.

- 검색용 원본 정보는 `https://climekr.com/guide/`에 유지한다.
- 마케팅 채널의 링크 허브는 `https://climekr.com/links/` 또는 Linktree 무료 프로필 한 곳에 유지한다.
- 새 무료 호스트에 `public` 전체를 그대로 게시하지 않는다. 기존 Pages Functions, D1, R2, 관리자 인증은 Cloudflare 환경에 종속되므로 동작이 달라지고 보안 사고 위험이 있다.
- Netlify 등 타 호스트에 별도 SNS 링크 허브를 배포할 때에는 `public/links`만 독립 정적 웹사이트로 게시하고 검색 색인을 차단한다. 이 경로는 Cloudflare API가 없어도 기본 두 링크로 동작하도록 구성되어 있다.

## 게시·광고 전 확인사항

1. 기존 사업자등록증에 기재된 상호와 현 운영 법인의 실제 관계·사용 권한이 검증되어야 한다.
2. '최대 66만원'은 **조건 충족 시 최대치**이며, 개통 직후 지급이 아님을 명시한다.
3. '본인 부담금 0원'은 개통비·월 통신요금·유지비·위약금의 부담 주체가 계약상 증빙된 뒤에만 사용한다.
4. 본인 명의 유심/회선을 타인에게 양도·대여하는 거래를 금지하며, 주민등록번호·인증번호·신분증 전체 이미지의 메신저 전송을 유도하지 않는다.
5. 사이트에 없는 대출상품을 제공하는 것처럼 광고하거나, 상담 신청 시 자동 지급되는 것처럼 표시하지 않는다.

## 기술 검사

- `node --test test/marketing-guide.test.js`
- `npm test`
- `/guide/`의 canonical과 sitemap 항목이 일치하는지 확인한다.
- `/links/`와 `pages.dev` 미리보기는 `noindex`로 유지한다.
- 모바일 320px/390px/1440px에서 글자 겹침·접근성·두 외부 버튼을 확인한다.
- 실제 운영 데이터의 `GET /api/content`가 변경되면 `/guide/`의 최대 혜택 및 단계별 금액도 변경되는지 확인한다.
- 운영 Cloudflare 프로젝트의 배포 성공, HTTPS 응답, 리다이렉트와 기존 관리자 경로가 정상인지를 확인한다.

## 참고

- Google spam policies: https://developers.google.com/search/docs/essentials/spam-policies
- Google canonicalization: https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Linktree Free: https://linktr.ee/s/pricing
