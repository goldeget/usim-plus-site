import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { DEFAULT_CONTENT } from '../functions/api/content.js';
import { buildPublicMetadata } from '../functions/index.js';

test('home structured data describes the actual platform without inferring a founder', () => {
 const graph=buildPublicMetadata(DEFAULT_CONTENT).structuredData['@graph'];
 assert.equal(graph.find(n=>n['@type']==='Organization').founder,undefined);
 assert.equal(graph.find(n=>n['@type']==='Service').serviceType,'유심 혜택 확인·진행 지원 플랫폼');
});

test('public JSON and llms endpoints exist', async () => {
 assert.ok(existsSync(new URL('../functions/api/service-facts.js',import.meta.url)));
 assert.ok(existsSync(new URL('../functions/llms.txt.js',import.meta.url)));
});

test('public endpoints share a single CMS snapshot, keep methods and exclude private metadata', async () => {
 const { onRequest: json }=await import('../functions/api/service-facts.js');
 const { onRequest: llms }=await import('../functions/llms.txt.js');
 const content=structuredClone(DEFAULT_CONTENT);content.operator.company='운영 & 회사';content.operator.address='새 주소 <안내>';content.supportLinks.telegram='https://t.me/updated';
 let reads=0;const env={CONTENT_DB:{prepare(){return{bind(){return{async first(){reads++;return {content:JSON.stringify(content)}}}}}}}};
 const response=await json({request:new Request('https://climekr.com/api/service-facts'),env});const data=await response.json();
 assert.equal(reads,1);assert.equal(data.operator.company,content.operator.company);assert.equal(data.contentSource,'cms');assert.equal(data.customerCostWon,0);assert.equal(data.schemaVersion,undefined);assert.equal(data.retentionDays,undefined);
 const text=await (await llms({request:new Request('https://climekr.com/llms.txt'),env})).text();assert.match(text,/운영 & 회사/);assert.match(text,/https:\/\/t.me\/updated/);assert.equal(reads,2);
 const denied=await json({request:new Request('https://climekr.com/api/service-facts',{method:'POST'}),env});assert.equal(denied.status,405);assert.equal(denied.headers.get('allow'),'GET');assert.equal(reads,2);
});

test('cost zero is accepted independently of payout amounts while invalid payout remains rejected', async () => {
 const {validateContent}=await import('../functions/api/content.js');
 const content=structuredClone(DEFAULT_CONTENT);
 content.intro='이용 비용은 0원입니다. 3일·15일·30일 유지 조건 충족 시 최대 {{MAX_TOTAL}} 지급 대상입니다.';
 assert.equal(validateContent(content),null);
 content.intro='지급 금액은 999원입니다.';
 assert.match(validateContent(content),/지급 금액/);
});

test('footer renderer uses one validated CMS read for metadata, visible operator, channels and structured data', async () => {
 const {renderPublicPage}=await import('../functions/_lib/public-page-renderer.js');
 const {FixtureHTMLRewriter}=await import('../test-support/html-rewriter.js');
 const content=structuredClone(DEFAULT_CONTENT);content.operator.company='운영 <회사> & 안내';content.operator.address='맞춤 주소';content.operator.email='custom@example.com';content.supportLinks.telegram='https://t.me/custom';
 let reads=0;const env={CONTENT_DB:{prepare(){return{bind(){return{async first(){reads++;return {content:JSON.stringify(content)}}}}}}}};
 const original=globalThis.HTMLRewriter;globalThis.HTMLRewriter=FixtureHTMLRewriter;
 try{
 const fixture='<title>old</title><meta name="description" content="old"><span data-service-definition>old</span><strong data-operator="company">old</strong><strong data-operator="address">old</strong><a data-channel="telegram" href="old">相談</a><a data-channel="channeltalk" href="old">chat</a><span data-content-source>old</span><script type="application/ld+json">{}</script>';
 const response=await renderPublicPage({request:new Request('https://climekr.com/about/'),env,next:()=>new Response(fixture,{headers:{'Content-Type':'text/html'}})},'about');const html=await response.text();
 assert.equal(reads,1);assert.match(html,/운영 &lt;회사&gt; &amp; 안내/);assert.match(html,/맞춤 주소/);assert.match(html,/href="https:\/\/t.me\/custom"/);assert.match(html,/href="https:\/\/climeusim.channel.io"/);assert.match(html,/현재 저장된 운영 안내 기준/);assert.equal(response.headers.get('cache-control'),'public, max-age=0, s-maxage=15');
 const graph=JSON.parse(html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1])['@graph'];assert.equal(graph[0].legalName,content.operator.company);assert.equal(graph[0].address.streetAddress,content.operator.address);assert.equal(graph[1].description,'클라임유심은 유심으로 받을 수 있는 혜택을 확인해주는 플랫폼입니다.');
 }finally{if(original===undefined)delete globalThis.HTMLRewriter;else globalThis.HTMLRewriter=original;}
});

test('home labels fallback provenance rather than implying current CMS conditions were read', async()=>{
 const {onRequest}=await import('../functions/index.js');const {FixtureHTMLRewriter}=await import('../test-support/html-rewriter.js');
 const prior=globalThis.HTMLRewriter;globalThis.HTMLRewriter=FixtureHTMLRewriter;
 try{const response=await onRequest({request:new Request('https://climekr.com/'),env:{},next:()=>new Response('<span data-content-source>old</span>',{headers:{'Content-Type':'text/html'}})});assert.match(await response.text(),/기본 안내 기준/);}
 finally{if(prior===undefined)delete globalThis.HTMLRewriter;else globalThis.HTMLRewriter=prior;}
});

test('only exact former default cost explanations migrate; custom stored explanations survive', async()=>{
 const {withCurrentPublicSummary}=await import('../functions/api/content.js');
 const content=structuredClone(DEFAULT_CONTENT);
 content.faqs=[{question:'유심 개통·통신요금은 누가 부담하나요?',answer:'CLIME 운영사 안내 기준 고객의 개통·통신·회선 유지 관련 비용은 회사가 전액 부담합니다. 지급 혜택은 별도의 유지 조건이 충족되어야 받을 수 있습니다. 신청 전 본인 명의 회선 계약의 청구·납부 주체 및 회사 부담 범위를 확인하세요.'},{question:'유심 개통·통신요금은 누가 부담하나요?',answer:'운영자가 저장한 별도 안내'}];
 const migrated=withCurrentPublicSummary(content);
 assert.match(migrated.faqs[0].answer,/이용 비용은 0원/);assert.doesNotMatch(migrated.faqs[0].answer,/회사.*부담/);assert.equal(migrated.faqs[1].answer,'운영자가 저장한 별도 안내');assert.match(content.faqs[0].answer,/회사.*부담/);
});

test('guide and privacy bind every operator contact and avoid redundant fixed payout pitches', async()=>{
 const {readFile}=await import('node:fs/promises');
 const guide=await readFile(new URL('../public/guide/index.html',import.meta.url),'utf8');
 const hero=guide.slice(guide.indexOf('<section class="hero wrap">'),guide.indexOf('id="criteria"'));
 const footer=guide.slice(guide.indexOf('<footer>'),guide.indexOf('<script>',guide.indexOf('<footer>')));
 assert.doesNotMatch(hero,/66만원/);assert.doesNotMatch(footer,/66만원/);
 for(const field of ['company','registrationNumber','email'])assert.ok(footer.includes(`data-operator="${field}"`),field);
 assert.match(footer,/data-operator-email/);
 const privacy=await readFile(new URL('../public/disclosures/privacy/index.html',import.meta.url),'utf8');
 for(const tag of privacy.matchAll(/<a[^>]*href="mailto:[^"]*"[^>]*>/g))assert.match(tag[0],/data-operator-email/);
});

test('links page includes current platform facts, common server renderer and per-entry safe channel parsing',async()=>{
 const {readFile}=await import('node:fs/promises');const html=await readFile(new URL('../public/links/index.html',import.meta.url),'utf8');
 assert.match(html,/data-service-definition/);assert.match(html,/별도 계약서 작성 없음/);assert.match(html,/별도 통신요금 납부 없음/);assert.match(html,/href="\/service-facts\/"/);assert.doesNotMatch(html,/사업 구조/);assert.match(html,/name="robots" content="noindex,follow"/);
 assert.ok(existsSync(new URL('../functions/links/index.js',import.meta.url)));
});

test('mobile preserves bare line breaks and llms labels review retention triggers accurately',async()=>{
 const {readFile}=await import('node:fs/promises');const css=await readFile(new URL('../public/user-flow.css',import.meta.url),'utf8');assert.doesNotMatch(css,/\.hero-intro br\s*\{\s*display:\s*none/);
 const {renderLlms}=await import('../functions/llms.txt.js');const {loadPublicInformation}=await import('../functions/_lib/public-information.js');
 const dynamic=renderLlms(await loadPublicInformation({}));const fallback=await readFile(new URL('../public/llms.txt',import.meta.url),'utf8');assert.equal(fallback,dynamic);
 assert.match(dynamic,/검토된 사진은 검토 결정 후 30일/);assert.match(dynamic,/미검토 사진은 접수 후 30일/);assert.match(dynamic,/접수 상태 정보는 60일/);
});

test('links client accepts saved safe HTTPS ChannelTalk hosts after empty or malformed Telegram entries',async()=>{
 const {readFile}=await import('node:fs/promises');const vm=await import('node:vm');const html=await readFile(new URL('../public/links/index.html',import.meta.url),'utf8');const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
 for(const telegram of ['', 'malformed URL', 'javascript:alert(1)']){
  const anchors={telegram:{href:'https://t.me/climeusim'},channeltalk:{href:'https://climeusim.channel.io'}};
  await vm.runInNewContext(script,{URL,document:{querySelectorAll(selector){return [anchors[selector.includes('telegram')?'telegram':'channeltalk']];}},fetch:async()=>({ok:true,json:async()=>({supportLinks:{telegram,channeltalk:'https://custom.channel.io/contact'}})})});
  assert.equal(anchors.telegram.href,'https://t.me/climeusim');assert.equal(anchors.channeltalk.href,'https://custom.channel.io/contact');
 }
});

test('all information roles render current operator contacts and preserve source noindex in one snapshot',async()=>{
 const {renderPublicPage}=await import('../functions/_lib/public-page-renderer.js');const {FixtureHTMLRewriter}=await import('../test-support/html-rewriter.js');const content=structuredClone(DEFAULT_CONTENT);content.operator.company='맞춤 운영사';content.operator.registrationNumber='123-45-67890';content.operator.email='current@example.com';content.payout.maxCases=2;
 const original=globalThis.HTMLRewriter;globalThis.HTMLRewriter=FixtureHTMLRewriter;
 try{for(const key of ['guide','disclosures/privacy','links']){
  let reads=0;const env={CONTENT_DB:{prepare(){return{bind(){return{async first(){reads++;return{content:JSON.stringify(content)}}}}}}}};
  const fixture='<meta name="robots" content="noindex,follow"><span data-operator="company">old</span><span data-operator="registrationNumber">old</span><span data-operator="email">old</span><a data-operator-email href="mailto:old">문의</a><strong data-total>66만원</strong><script type="application/ld+json">{}</script>';
  const html=await (await renderPublicPage({request:new Request(`https://climekr.com/${key}/`),env,next:()=>new Response(fixture,{headers:{'Content-Type':'text/html'}})},key)).text();assert.equal(reads,1);assert.match(html,/맞춤 운영사/);assert.match(html,/123-45-67890/);assert.match(html,/current@example.com/);assert.match(html,/href="mailto:current@example.com"/);assert.match(html,/>44만원<\/strong>/);assert.match(html,/name="robots" content="noindex,follow"/);
 }}finally{if(original===undefined)delete globalThis.HTMLRewriter;else globalThis.HTMLRewriter=original;}
});
