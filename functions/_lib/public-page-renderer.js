import { loadPublicInformation } from './public-information.js';
import { publicStructuredData, jsonLdEscape } from './structured-data.js';
export const PUBLIC_PAGES = {
 links: ["공식 상담 링크", "유심 혜택 확인 플랫폼의 공식 상담 채널과 이용 비용, 현재 조건 안내입니다."],
 about: ['CLIME 소개','유심 혜택 확인 플랫폼의 역할과 운영사, 공식 상담 채널을 안내합니다.'],
 structure: ['이용 절차','혜택 확인부터 적용 대상·조건 안내, 희망 시 진행 지원과 보상금 지급까지의 절차입니다.'],
 guide: ['혜택 조건','적용 대상과 유지 조건, 현재 단계별 보상금 및 지급 기준을 확인하세요.'],
 disclosures: ['고지·안내','이용 비용과 절차, 공식 채널 확인 및 개인정보 처리 안내입니다.'],
 'disclosures/service': ['서비스 이용 안내','이용 비용 0원, 별도 계약서 작성 및 별도 통신요금 납부 없는 진행 절차를 안내합니다.'],
 'disclosures/safety': ['공식 채널 확인','공식 사이트와 상담 채널을 확인하고 사칭이 의심되면 운영사에 문의하세요.'],
 'disclosures/privacy': ['상담 채널 개인정보','상담 중 전달되는 정보와 채널별 처리, 과거 홈페이지 사진 접수의 구분을 안내합니다.'],
 'service-facts': ['공식 정보','클라임유심의 서비스 정의, 비용, 이용 절차, 운영사와 지급 조건을 요약합니다.']
};
export function currency(amount) { return Number.isInteger(amount)&&amount>=0&&amount%10000===0?`${amount/10000}만원`:`${new Intl.NumberFormat('ko-KR').format(amount)}원`; }
export async function renderPublicPage(context,pageKey) {
 if(context.request.method!=='GET') return context.next();
 const response=await context.next();
 if(!response.ok||!response.headers.get('content-type')?.includes('text/html')||typeof globalThis.HTMLRewriter!=='function') return response;
 const info=await loadPublicInformation(context.env||{});
 const [name,description]=PUBLIC_PAGES[pageKey]; const title=name+' | 클라임유심';
 let rw=new globalThis.HTMLRewriter();
 const text=(selector,value)=>{rw=rw.on(selector,{element(el){el.setInnerContent(String(value));}});};
 const attr=(selector,key,value)=>{rw=rw.on(selector,{element(el){el.setAttribute(key,String(value));}});};
 text('title',title);
 for(const selector of ['meta[name="description"]','meta[property="og:description"]','meta[name="twitter:description"]'])attr(selector,'content',description);
 for(const selector of ['meta[property="og:title"]','meta[name="twitter:title"]'])attr(selector,'content',title);
 text('[data-service-definition]',info.definition);
 text('[data-content-source]',info.contentSource==='cms'?'현재 저장된 운영 안내 기준':'기본 안내 기준 · 현재 조건은 공식 상담에서 확인하세요');
 for(const [key,value] of Object.entries(info.operator))text(`[data-operator="${key}"]`,value);
 attr('[data-operator-email]','href',`mailto:${info.operator.email}`);
 for(const [key,value] of Object.entries(info.supportLinks))attr(`[data-channel="${key}"]`,'href',value || ({telegram:'https://t.me/climeusim',channeltalk:'https://climeusim.channel.io'}[key] || '/#contact'));
 info.flow.forEach((value,index)=>text(`[data-flow="${index}"]`,value));
 const perCase=info.payout.milestones.reduce((sum,s)=>sum+s.amount,0);
 text('[data-total]',currency(perCase*info.payout.maxCases));
 rw=rw.on('[data-milestones]',{element(el){el.setInnerContent(info.payout.milestones.map(s=>`<div class="row"><span>${s.days}일 유지 단계</span><strong>${currency(s.amount)} 지급 대상</strong></div>`).join('')+`<div class="row"><span>1건 전체 조건 충족 · 최대 ${info.payout.maxCases}건</span><strong>${currency(perCase)} / 건</strong></div>`,{html:true});}});
 rw=rw.on('script[type="application/ld+json"]',{element(el){el.setInnerContent(jsonLdEscape(publicStructuredData(info,{path:`/${pageKey}/`,title,description})),{html:true});}});
 const headers=new Headers(response.headers); headers.set('Cache-Control','public, max-age=0, s-maxage=15');headers.delete('Content-Length');
 return rw.transform(new Response(response.body,{status:response.status,headers}));
}
