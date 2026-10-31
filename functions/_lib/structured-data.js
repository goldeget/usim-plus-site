import { SERVICE_FACTS } from './service-facts.js';
export const jsonLdEscape = value => JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
export function publicStructuredData(info, { path='/', title, description }) {
 const origin='https://climekr.com';
 return { '@context':'https://schema.org', '@graph':[
  {'@type':'Organization','@id':origin+'/#organization',name:'클라임유심 · CLIME',legalName:info.operator.company,taxID:info.operator.registrationNumber,url:origin+'/',email:info.operator.email,address:{'@type':'PostalAddress',streetAddress:info.operator.address,addressCountry:'KR'}},
  {'@type':'Service','@id':origin+'/#service',name:'클라임유심 유심 혜택 확인',serviceType:'유심 혜택 확인·진행 지원 플랫폼',description:SERVICE_FACTS.definition,provider:{'@id':origin+'/#organization'},areaServed:'KR'},
  {'@type':path==='/about/'?'AboutPage':'WebPage','@id':origin+path+'#webpage',url:origin+path,name:title,description,inLanguage:'ko-KR',about:{'@id':origin+'/#service'},publisher:{'@id':origin+'/#organization'}}
 ]};
}
