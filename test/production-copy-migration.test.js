import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONTENT, withCurrentPublicSummary } from "../functions/api/content.js";

const legacyTitle = "클라임유심 CLIME | 개통·통신비 회사 부담 · 최대 {{MAX_TOTAL}} 혜택";
const legacySocialTitle = "CLIME 유심 혜택 | 고객 비용 회사 부담 · 조건 충족 시 최대 {{MAX_TOTAL}}";
const legacyCostFaq = {
  question: "유심 개통·통신 비용은 누가 부담하나요?",
  answer: "CLIME 운영사가 안내한 조건에 따르면 고객의 유심 개통·통신·회선 유지와 관련된 비용은 회사가 전액 부담합니다. 혜택 지급에는 별도 회선 유지 조건이 적용되며, 실제 본인 명의 계약과 회사의 비용 부담 범위를 확인한 뒤 참여하세요."
};

for (const maximum of ["{{MAX_TOTAL}}", "66만원"]) {
  test(`migrates exact production SEO titles (${maximum}) on read`, () => {
    const stored = structuredClone(DEFAULT_CONTENT);
    stored.seo.title = legacyTitle.replace("{{MAX_TOTAL}}", maximum);
    stored.seo.socialTitle = legacySocialTitle.replace("{{MAX_TOTAL}}", maximum);
    const before = structuredClone(stored);
    const result = withCurrentPublicSummary(stored);
    assert.equal(result.seo.title, DEFAULT_CONTENT.seo.title);
    assert.equal(result.seo.socialTitle, DEFAULT_CONTENT.seo.socialTitle);
    assert.deepEqual(stored, before);
  });
}

test("migrates the exact production cost FAQ pair without changing other content or stored input", () => {
  const stored = structuredClone(DEFAULT_CONTENT);
  stored.faqs = [{ ...legacyCostFaq, ownerTag: "retain" }, { question: "운영자 질문", answer: "운영자 답변" }];
  stored.operator.company = "운영자 회사";
  stored.supportLinks.telegram = "https://t.me/custom";
  stored.payout.maxCases = 2;
  stored.copy.contactTitle = "운영자 상담 제목";
  const before = structuredClone(stored);
  const result = withCurrentPublicSummary(stored);
  const expected = structuredClone(stored);
  expected.faqs[0] = { ...DEFAULT_CONTENT.faqs.find(item => item.question === "이용 비용과 별도 통신요금이 있나요?"), ownerTag: "retain" };
  assert.deepEqual(result, expected);
  assert.deepEqual(stored, before);
});

test("preserves customized SEO and FAQs that only resemble the production legacy copy", () => {
  const stored = structuredClone(DEFAULT_CONTENT);
  stored.seo.title = `${legacyTitle} · 운영자 안내`;
  stored.seo.socialTitle = `${legacySocialTitle} · 운영자 안내`;
  stored.faqs = [
    { ...legacyCostFaq, answer: `${legacyCostFaq.answer} 운영자 추가 안내.` },
    { ...legacyCostFaq, question: "운영자가 정한 비용 질문" }
  ];
  const before = structuredClone(stored);
  assert.deepEqual(withCurrentPublicSummary(stored), before);
  assert.deepEqual(stored, before);
});
