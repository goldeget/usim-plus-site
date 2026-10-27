# CLIME 공개 화면·한글 줄바꿈·검색 데이터 점검

점검 기준: 2026-10-26 (한국시간)
대상 저장소: `goldeget/usim-plus-site`, 기존 Cloudflare Pages 및 관리자 D1 운영 설정

## 범위와 조치

| 경로 | 검토 항목 | 처리 |
| --- | --- | --- |
| `/` | 첫 화면 2줄 안내, 지급표, 상담 버튼, 접수 조회·개인정보 영역, 푸터, 메타데이터 | FAQ 표시·스크립트·스타일을 제거하고 기존 정보의 줄바꿈과 한글 단어 경계를 보완 |
| `/guide/` | 지급표, 문단, 고객 비용 안내, 상담 이동, 모바일 긴 문장, SEO | 기존 섹션 유지. 한국어 줄바꿈 개선, 브랜드/서비스에 직접 연결되는 제목·설명으로 정리 |
| `/links/` | SNS 프로필용 상담 버튼, 소개 문구, 모바일 좁은 화면 | 긴 한글 문장의 단어 중간 끊김을 완화. 색인은 계속 `noindex` |
| `/404.html` | 없어진 과거 URL | 기존의 올바른 404 동작과 공식 사이트 이동 유지 |
| `/admin/*` | 관리자 로그인 보호, 기존 수치 설정·편집 기능과 공지 문구 | 기존 기능 변경 없이 공개 화면 변경과 호환성 검증 |
| `functions/index.js` | 크롤러용 메타·JSON-LD | 메인 FAQ의 실제 표시가 끝나므로 `FAQPage` 구조화 데이터 제거. Organization/WebSite/WebPage/Service는 유지 |
| `public/llms.txt` | 선택적 텍스트 안내 | FAQ 제공 문구를 제거. 서비스 성격, 수수료, 지급 시점, 상담 채널을 투명하게 정리 |
| `sitemap.xml`, `robots.txt` | 대표 도메인, 인덱싱 범위 | 공식 URL 두 개 유지, 현재 문서 갱신일 표시, 비공개/관리자 접근 및 미리보기 검색색인 제외 유지 |

## 운영 D1 데이터 점검

2026-10-26에 `site_content`의 `home`을 읽어 확인한 사실:
- `schemaVersion` 4, 공개 문구 `copy` 64개, FAQ 데이터 8개, 지급 단계 3개.
- 별표/반복 `\\n` 오류 없음. 줄바꿈은 실제 LF로 저장됨.
- 지급 기준: 3일 50,000원 + 15일 70,000원 + 30일 100,000원, 1건 220,000원, 최대 3건/660,000원.
- 활성 상담: Telegram `https://t.me/climeusim`, ChannelTalk `https://climeusim.channel.io`. LINE 비활성.
- 메인 FAQ는 **표시와 검색용 FAQ 구조화 데이터에서만 제거**. 과거 운영 데이터와 관리자 편집기 항목은 유지하여 이전 접수 및 다른 설정을 훼손하지 않음.
- 기존 DB 금액·적용일·상담 주소·관리자 인증·저장 내역·R2/백업은 변경하지 않음.

## 검색엔진과 AI의 정보 인식

- 검색엔진의 `Organization`, `WebSite`, `WebPage`, `Service` 데이터는 실제 공개된 서비스와 설명이 일치해야 함.
- 실제 화면에서 제거한 FAQ를 구조화 데이터로만 남기는 행위는 검색 지침에 맞지 않으므로 함께 삭제.
- 모바일/PC 읽기 좋은 문장, 공개 페이지의 canonical, 사이트맵, 내부 링크, robots 허용 여부를 정돈.
- `llms.txt`는 보조 설명 파일이며 GPT·Gemini·Grok 등에 채택 또는 긍정적인 답변을 보장하는 파일이 아님.
- 허위 이용 후기, 검증되지 않은 제휴·공식 인증, 자동 평가 유도, 안전성 보장을 추가하지 않음.
- 구글 순위와 제3자 AI 응답은 외부 평가이므로 보장할 수 없음.

## 추가 검증이 필요한 운영 사실

**운영 법인 이름/대표자/소재지 일치 여부:** 사업자등록번호 `114-81-47958`은 2025년 3월 상호 변경 이후 공식 법인명 **서울평가정보㈜**(과거 SCI·에스씨아이평가정보 계열)와 일치한다. 감사 당시(2026-10) 일부 마케팅 copy·네이버 초안에 구 상호 `에스씨아이평가정보(주)`가 남아 있었으나, `public/`·`/structure/`·`functions/api/content.js` DEFAULT는 **서울평가정보㈜**·대표 김중근·마포구 토정로 144 기준으로 정렬됨. KV 등 레거시 intro는 `LEGACY_PUBLIC_INTROS` 마이그레이션으로 갱신.

**혜택 비용 범위:** 운영자 설명 및 홈페이지는 고객 부담금 0원/회사 부담으로 되어 있음. 실제 약관·통신요금 청구 책임, 회선 명의·관리는 운영자가 계약자료를 확인하고 일치시키는 것이 필수.

## 정기 기술 확인

- `npm test` 및 새 `test/public-readable-seo.test.js`
- 공개 HTML에서 FAQ 섹션, `FAQPage` 및 FAQ 런타임 참조가 없는지
- `/api/content` 최신 공지와 SSR 검색 제목·설명 및 지급액 일치
- 메인/guide/links/404의 모바일·데스크톱에서 텍스트 넘침 없이 정상 줄바꿈
- 공식 홈페이지 정상 200, `www`는 영구 리디렉션, 관리자와 미리보기 호스트는 `noindex`
- Google Search Console과 네이버 서치어드바이저의 색인·오류·검색성과는 별도 소유자 계정에서 확인 필요

참고:
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- https://scil.co.kr/history/
