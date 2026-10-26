import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../public/index.html", import.meta.url);
const nl = "\n";
let html = readFileSync(path, "utf8");
html = html.replace(
  /<p class="hero-intro" id="homeIntro">[^<]+<\/p>/,
  `<p class="hero-intro" id="homeIntro">${[
    "고객의 유심 개통·통신·유지 관련 비용은 회사가 전액 부담합니다.",
    "개통 가능 여부를 확인하고 텔레그램·채널톡에서 조건을 문의하세요."
  ].join(nl)}</p>`
);
html = html.replace(
  /<p class="site-footer__terms" id="footerTerms">[^<]+<\/p>/,
  `<p class="site-footer__terms" id="footerTerms">${[
    "고객 개통·통신 비용 회사 전액 부담",
    "유지 조건 충족 시 최대 3건 · 최대 66만원 지급 대상"
  ].join(nl)}</p>`
);
writeFileSync(path, html, "utf8");
