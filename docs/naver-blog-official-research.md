# 네이버 블로그·검색 공식 자료 조사 (CLIME `climeusimguide`)

> **조사일:** 2026-10-28  
> **방법:** Firecrawl로 `help.naver.com`(블로그 고객센터), `searchadvisor.naver.com`(서치어드바이저) 1차 출처만 인용.  
> **원칙:** 순위·노출 **보장 없음**. 공식 문서에 없는 “이미지 N장 = 1위”류 주장 **금지**.

---

## 1. 제목·부제(리드) 글자 제한

### 공식 사실

| 항목 | 제한 | 출처 |
|------|------|------|
| **게시글 제목** | 최대 **100자** | [제목과 제목 배경 사진 안내](https://help.naver.com/service/5593/contents/15514?lang=ko) |
| **제목 배경 사진** | 제목 영역에 별도 배경 이미지 등록 가능 (용량·픽셀 규격은 해당 페이지에 **미기재**) | 동일 URL |
| **부제목 필드** | 스마트에디터 ONE 기준 **별도 “부제목” 입력란에 대한 고객센터 규격 미확인** | 조사 공백 (§7) |
| **웹 `<title>` (자사 사이트)** | “매우 긴 텍스트” 지양, 페이지마다 **고유·정확한 제목** | [SEO 기본 가이드](https://searchadvisor.naver.com/guide/seo-help) |
| **검색 스니펫용 설명** | `meta description` 등 **간결한 요약** 권장 (블로그 글 자체 필드와는 별개) | [콘텐츠 작성시 권장 사항](https://searchadvisor.naver.com/guide/content-basic) |

### CLIME 적용 (근거 있는 범위만)

- 네이버 **제목 100자**는 상한이지 SEO 권장 길이가 아님. 서치어드바이저는 **간결·정확·고유** 제목을 권장 ([content-basic](https://searchadvisor.naver.com/guide/content-basic)).
- 코너스톤 1편 제목은 **핵심 키워드(유심 개통 혜택·클라임유심)** 를 앞쪽에 두되, **40~55자 내외**로 읽기 쉽게 작성 (100자 상한 대비 여유).
- “부제” 역할은 **첫 문단(리드)** + 필요 시 **제목 배경 사진**으로 대체 (공식 부제 필드 없음).

---

## 2. 본문·글 구조 (네이버 공식 권장)

### 블로그 제품 도움말

- 본문 입력·블록 서식: [글 작성 및 서식 편집 방법](https://help.naver.com/service/5593/contents/15515?lang=ko) — **본문 최대 글자 수는 해당 페이지에 미기재**.
- 발행 전 **카테고리·주제**, **공개 범위**, **검색 허용** 등 설정: [글 발행 방법](https://help.naver.com/service/5593/contents/15541?lang=ko), [글 발행 설정 상세](https://help.naver.com/service/5593/contents/15420?osType=PC&lang=ko).

### 서치어드바이저 (콘텐츠 품질·구조)

출처: [콘텐츠 작성시 권장 사항](https://searchadvisor.naver.com/guide/content-basic)

- **전문성·경험**, **일관된 주제**, **진정성·출처 표기**, **읽기 쉬운 구조**(제목·소제목·문단), **꾸준한 갱신**을 권장.
- **핵심 정보는 텍스트**로. 이미지만으로 중요 정보 전달 지양; 이미지 사용 시 **alt(대체 텍스트)** 로 주제 전달 ([동일](https://searchadvisor.naver.com/guide/content-basic), [SEO 기본 가이드 – Alt 속성](https://searchadvisor.naver.com/guide/seo-help)).
- **낚시성 제목·썸네일**, **키워드 무관 삽입·반복**, **타 사이트 복제**는 품질/스팸 불이익 가능 ([content-basic](https://searchadvisor.naver.com/guide/content-basic), [웹 콘텐츠 스팸사례](https://searchadvisor.naver.com/guide/content-abusing)).

### CLIME 적용

- H2 4~6개, FAQ, 면책·광고 표기, `climekr.com` 공식 링크 1회 이상 — 위 **구조·투명성** 권장과 정합.
- 사이트 HTML **전문 복붙 금지** (스크래핑·유사 문서 리스크, [content-abusing – 스크래핑](https://searchadvisor.naver.com/guide/content-abusing)).

---

## 3. 태그·#태그 vs 검색 키워드

### 공식 사실

| 구분 | 설명 | 출처 |
|------|------|------|
| **발행 시 태그 필드** | Enter로 태그 추가, **최대 30개** | [글 발행 방법](https://help.naver.com/service/5593/contents/15541?lang=ko) |
| **본문 `#태그`** | 본문에 `#태그` 입력 시 **태그 및 링크 자동 등록** (PC 스마트에디터 ONE·앱) | [#태그 이용 방법](https://help.naver.com/service/5593/contents/15427?lang=ko) (메타 설명·고객센터 요약) |
| **태그 ↔ 순위** | 태그 개수·태그만으로 **상위 노출 보장** 문구 **없음** | — |
| **키워드 남용** | 제목·본문 **동일 키워드 의도적 반복**·낚시성 = 스팸 유형 | [웹 콘텐츠 스팸사례 – 키워드 반복·남용](https://searchadvisor.naver.com/guide/content-abusing) |

### CLIME 적용

- 발행 창 태그 **8~12개**, 글 주제와 **직접 관련** (`유심개통혜택`, `클라임유심` 등). 30개 **전부 채우기** 불필요.
- 본문 `#태그` 남발보다 **발행 태그 + 자연스러운 본문 키워드** 우선 (스팸 가이드와 정합).

---

## 4. 이미지 (블로그 업로드 + 검색 관점)

### 블로그 고객센터 (업로드 한도)

출처: [사진 첨부 및 교체 안내](https://help.naver.com/service/5593/contents/15523?lang=ko)

| 항목 | 값 |
|------|-----|
| 글당 사진 | 최대 **50장** |
| 용량 | 최대 **100MB** (글당) |
| 형식 | jpg, jpeg, png, gif |
| 파일명 | 한글·특수문자 시 오류 가능 → **영문·숫자** 권장 |

**픽셀 권장 해상도:** 해당 페이지 **미기재**.

### 서치어드바이저

- 이미지 **alt** 있으면 로봇 이해에 유리 ([seo-help](https://searchadvisor.naver.com/guide/seo-help)).
- 로봇은 **이미지 속 텍스트 인식이 어려움** → 핵심은 **본문 텍스트** ([content-basic](https://searchadvisor.naver.com/guide/content-basic)).
- **“이미지 N장이면 순위 상승”** 류 공식 문구 **없음**.

### CLIME 1편 권장 이미지 수 (근거)

| 권장 | 장수 | 근거 |
|------|------|------|
| **이번 코너스톤** | **6장** (본문 5 + 제목 배경 1) | §2 구조(섹션별 1시각) + §4 alt·텍스트 병행; 50장 상한과 **무관** (양보다 **주제 일치·캡션·alt**) |

---

## 5. CCL·저작권

| 항목 | 내용 | 출처 |
|------|------|------|
| 글 발행 시 **CCL 표시** | 상업적 이용·2차 저작(변경) **허용/비허용** 설정 가능, 글 하단 아이콘 표기 | [글 발행 설정](https://help.naver.com/service/5593/contents/15420?osType=PC&lang=ko), [글 발행 방법](https://help.naver.com/service/5593/contents/15541?lang=ko) |
| CCL 설명 | Creative Commons 표준 약관 | [저작물 이용 허락 표시 방법](https://help.naver.com/service/5593/contents/15551?lang=ko) |
| 블로그 기본 CCL | 관리 → 기본 설정 → 콘텐츠 공유 설정 | [영리 목적 이용 거부](https://help.naver.com/service/5593/contents/15552?lang=ko) 등 |

**CLIME:** 자사 생성 3D 에셋 — 발행 시 CCL 정책은 **운영方 선택**; 공식 안내 캐릭터·로고 **무단 2차 배포** 금지는 사내 브랜드 정책.

---

## 6. 상업·광고·협찬 표시

| 항목 | 내용 | 출처 |
|------|------|------|
| **검색 허용** | 켜면 통합검색·외부 검색 **노출 가능** (노출 **보장 아님**) | [글 발행 설정 – 검색 허용](https://help.naver.com/service/5593/contents/15420?osType=PC&lang=ko) |
| **내돈내산** | 네이버 **일부 서비스 결제·이용 내역** 기반, 작성자가 **직접 구매·이용**을 인증하는 기능 | [내돈내산 기능 소개](https://help.naver.com/service/5593/contents/22399?lang=ko) |
| **내돈내산 ≠ 일반 광고** | CLIME **자사 서비스 안내**는 내돈내산 첨부 대상이 **아닐 수 있음** (결제 내역 연동 전제) | 동일 + [이용 유의사항](https://help.naver.com/service/5593/contents/22403?lang=ko) |

**CLIME:** 본문·말미 **`[운영사 제공 정보·광고 포함]`** 명시. 표시광고법 등 **법령 준수**는 별도 법무 검토(네이버 고객센터 범위 밖).

---

## 7. 네이버가 보장하지 않는 것 (공식)

| 주장 | 공식 입장 | 출처 |
|------|-----------|------|
| 수집·색인 후 **검색 노출** | 수집 성공해도 **검색결과 노출 보장 없음** | [수집요청 및 검색제외](https://searchadvisor.naver.com/guide/request-crawl) |
| **특정 게시물·키워드 순위** | 특정 게시물 노출 **예측·보장 불가** | [글 검색 시 보이지 않는 경우](https://help.naver.com/service/5593/contents/9564?lang=ko) |
| **단어 많이 = 상위** | 단순히 많은 단어 ≠ 검색 상위 **보장** | [content-basic](https://searchadvisor.naver.com/guide/content-basic) |
| **이미지 개수 = 순위** | 공식 문서 **침묵** (§4) | — |
| **구조화 데이터 노출** | 마크업 형식 **노출 보장 없음** (시험·부분 적용) | [평점 AggregateRating](https://searchadvisor.naver.com/guide/structured-data-rating) 등 |

블로그 검색 반영: 등록·수정 후 **24시간 내** 반영 안내, 스팸·유사 문서 시 **미노출** 가능 ([9564](https://help.naver.com/service/5593/contents/9564?lang=ko)).

---

## 8. CLIME 증거 기반 베스트 프랙티스 (유심 개통 혜택)

> 아래는 **§2·§3·§4·§7** 공식 가이드 + CLIME 브랜드(`public/topics/usim-benefit/`) 정합. **순위 공식 없음.**

1. **주제 일관성:** 블로그 전체를 `유심 개통 조건부 혜택`·`CLIME 공식 안내`에 맞춤 ([content-basic – 일관된 주제](https://searchadvisor.naver.com/guide/content-basic)).
2. **제목:** 100자 이내, **낚시·대출 연상** 금지, “대출·폰깡 아님”은 **사실 설명** 수준으로 ([content-abusing – 낚시성](https://searchadvisor.naver.com/guide/content-abusing)).
3. **본문:** 대출/내구재(폰깡)/조건부 혜택 **구조 비교**를 **텍스트**로; 이미지는 보조 + **한글 캡션·alt**.
4. **태그:** 30개 상한 중 **8~12개** 관련 태그 ([15541](https://help.naver.com/service/5593/contents/15541?lang=ko)).
5. **발행 설정:** **전체 공개 + 검색 허용** ([15420](https://help.naver.com/service/5593/contents/15420?osType=PC&lang=ko)); `climekr.com` **서치어드바이저** 등록·수집 요청은 **보조** ([request-crawl](https://searchadvisor.naver.com/guide/request-crawl)).
6. **투명성:** 운영사·조건 변경 가능·확정 수익 아님 — **과장·당일 현금 보장** 금지 ([content-basic – 진정성](https://searchadvisor.naver.com/guide/content-basic)).

---

## 9. 업계 관찰 (2차 — 공식 아님)

| 관찰 | 비고 |
|------|------|
| “블로그 글 1,500자+” | **네이버 고객센터 미명시**; 타 SEO 블로그·에이전시 관행. CLIME는 **완결성·FAQ** 목적으로 장문 사용. |
| “제목 40자” | **공식 100자**와 별개; **모바일 가독성** 관행 (`scripts/naver-blog/checklist.md`). |
| “블로그명 25자·별명 10자·소개 200자” | **블로그 정보 UI**에서 흔히 인용되나, 이번 조사에서 **블로그 전용 help 페이지에 숫자 미확인** — 저장 시 **에디터 카운터**로 재확인. |

---

## 10. 조사 공백 (추가 확인 권장)

- 게시글 **본문 최대 글자/바이트** (15515 등 **미기재**).
- **부제목** 전용 필드·글자 제한 (스마트에디터 ONE).
- **블로그명·소개글** 정확한 글자 상한 (관리 UI 실측).
- **블로그 전용** 이미지 권장 px (50장/100MB만 공식).
- **C-Rank** 상세 (9564에서 링크만 안내, 본 조사에서 전문 **미스크랩**).

---

## 11. 핵심 공식 URL 목록

- https://help.naver.com/service/5593/contents/15514?lang=ko — 제목 100자  
- https://help.naver.com/service/5593/contents/15541?lang=ko — 발행·태그 30  
- https://help.naver.com/service/5593/contents/15427?lang=ko — #태그  
- https://help.naver.com/service/5593/contents/15523?lang=ko — 사진 50장/100MB  
- https://help.naver.com/service/5593/contents/15420?osType=PC&lang=ko — 검색 허용·CCL  
- https://help.naver.com/service/5593/contents/9564?lang=ko — 노출 비보장  
- https://help.naver.com/service/5593/contents/22399?lang=ko — 내돈내산  
- https://searchadvisor.naver.com/guide/content-basic — 콘텐츠 권장  
- https://searchadvisor.naver.com/guide/content-abusing — 스팸  
- https://searchadvisor.naver.com/guide/seo-help — title·alt  
- https://searchadvisor.naver.com/guide/request-crawl — 수집≠노출  
