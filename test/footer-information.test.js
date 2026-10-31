import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('footer information pages provide definition, fixed costs and official navigation before JavaScript', async () => {
  for (const page of ['about','structure','guide','disclosures','disclosures/service','disclosures/safety','disclosures/privacy','service-facts']) {
    const html = await readFile(new URL(`../public/${page}/index.html`, import.meta.url), 'utf8');
    assert.match(html, /data-service-definition/, page);
    assert.match(html, /별도 계약서 작성 없음/, page);
    assert.match(html, /별도 통신요금 납부 없음/, page);
    assert.match(html, /href="\/service-facts\/"/, page);
    assert.match(html, /data-operator="address"/, page);
  }
});

test('every actual UI includes common typography', async () => {
  for (const page of ['404.html','links/index.html','reviews/index.html', ...['index','login','content','applications','duplicates','review','reviews'].map(p=>`admin/${p}.html`)]) {
    assert.match(await readFile(new URL(`../public/${page}`, import.meta.url),'utf8'), /href="\/copy-typography\.css/ ,page);
  }
});

test('guide contains initial payout conditions and summary page links to detailed conditions', async () => {
 const guide=await readFile(new URL('../public/guide/index.html',import.meta.url),'utf8');
 assert.match(guide,/data-total/);assert.match(guide,/data-milestones/);assert.match(guide,/3일 유지/);assert.match(guide,/15일 유지/);assert.match(guide,/30일 유지/);
 const summary=await readFile(new URL('../public/service-facts/index.html',import.meta.url),'utf8');assert.match(summary,/href="\/guide\/"/);
});

test('mobile phrase parts remain inline and generated gone UI loads typography', async () => {
 const css=await readFile(new URL('../public/copy-typography.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.hero-intro__chunk, \.hero-intro__part, \.lead__chunk, \.lead__part \{ display: block/);
 const {retiredInvestmentGone}=await import('../functions/_lib/retired-investment.js');assert.match(await retiredInvestmentGone().text(),/copy-typography.css/);
});

test('CMS editor offers a plain text paragraph preview', async()=>{
 const editor=await readFile(new URL('../public/admin/content-editor.js',import.meta.url),'utf8');
 assert.match(editor,/introPreview/);assert.match(editor,/ClimeCopy.render/);
});
