import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const hero=html.match(/<section class="hero"[\s\S]*?<\/section>/)[0];
const overview=html.match(/<section[^>]*id="serviceOverview"[\s\S]*?<\/section>/)?.[0] || '';
test('home has no floating consultation CTA',()=>assert.doesNotMatch(html,/<a[^>]*class="sticky-cta"/));
test('hero prioritizes lookup and keeps detailed conditions in a visible overview',()=>{
 assert.doesNotMatch(hero,/id="homeIntro"|혜택 확인 →|data-content-source|id="heroTrust"/);
 assert.match(hero,/data-service-definition/);assert.match(hero,/이용 비용 <span class="copy-nowrap">0원/);
 assert.match(hero,/id="eligibilityButton"/);assert.match(hero,/id="heroApplyButton"/);
 for(const text of ['id="homeIntro"','id="heroTrust"','data-content-source','/service-facts/','별도 계약서 작성 없음','조건에 맞는 보상금 지급']) assert.ok(overview.includes(text),text);
 assert.doesNotMatch(overview, / hidden|<details/);
});
