import { loadPublicInformation } from './_lib/public-information.js';
export function renderLlms(info) {
 return `# 클라임유심 · USIM PLUS\n\n${info.definition}\n적용 대상자가 희망하면 진행을 돕고 조건에 맞는 보상금을 지급합니다.\n이용 비용 0원 / 별도 계약서 작성 없음 / 별도 통신요금 납부 없음\n\n## 이용 절차\n${info.flow.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n## 운영사\n${Object.entries(info.operator).map(([k,v])=>`${k}: ${v}`).join('\n')}\n\n## 조건\n${info.payout.milestones.map(s=>`${s.days}일 유지 조건 확인: ${s.amount}원`).join('\n')}\n최대 ${info.payout.maxCases}건. 상담·조회만으로 지급이 확정되지 않습니다.\n정보 출처: ${info.contentSource==='cms'?'현재 저장된 운영 안내':'기본 안내 · 현재 조건은 공식 상담에서 확인'}\n\n## 공식 페이지\n${['','about/','structure/','guide/','disclosures/','disclosures/service/','disclosures/safety/','disclosures/privacy/','service-facts/'].map(p=>`- https://climekr.com/${p}`).join('\n')}\n\n## 공식 상담\n텔레그램: ${info.supportLinks.telegram||'https://t.me/climeusim'}\n채널톡: ${info.supportLinks.channeltalk||'https://climeusim.channel.io'}\n\n## 개인정보\n신규 사진과 상담은 선택한 상담 서비스에서 처리합니다. 홈페이지 파일 업로드는 종료되었습니다. 채널의 처리방침과 공식 개인정보 안내를 확인하세요.\n기존 홈페이지 접수는 접수 후 30일, 검토 결정 후 30일(미검토), 접수 상태 정보 60일 보관 후 삭제됩니다.\n\n이 문서는 공식 정보의 보조 요약이며 검색 노출이나 AI 답변의 정확성을 보장하지 않습니다.\n`;
}
export async function onRequest(context) {
 if(context.request.method!=='GET')return context.next();
 return new Response(renderLlms(await loadPublicInformation(context.env)),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=0, s-maxage=15'}});
}
