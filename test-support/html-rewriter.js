// Small runtime adapter for flat fixtures; the actual Cloudflare runtime is browser-tested separately.
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export class FixtureHTMLRewriter {
 rules=[];
 on(selector,handlers){this.rules.push([selector,handlers]);return this;}
 async transform(response){
  let html=await response.text();
  for(const [selector,handlers] of this.rules){
   html=html.replace(/<(\w+)\b([^>]*)>([\s\S]*?)<\/\1>|<(meta|link)\b([^>]*)>/g,(all,tag,attrs,body,voidTag,voidAttrs)=>{
    tag=tag||voidTag;attrs=attrs??voidAttrs;body=body||'';
    const parsed=selector.match(/^(\w+)?\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if(parsed){if(parsed[1]&&tag!==parsed[1])return all;const attr=attrs.match(new RegExp(`(?:^|\\s)${parsed[2]}(?:="([^"]*)")?(?=\\s|$)`));if(!attr||(parsed[3]!==undefined&&attr[1]!==parsed[3]))return all;}
    else if(tag!==selector)return all;
    handlers.element({setInnerContent(value,options){body=options?.html?String(value):escape(value);},setAttribute(name,value){const re=new RegExp(`\\b${name}="[^"]*"`);const next=`${name}="${escape(value)}"`;attrs=re.test(attrs)?attrs.replace(re,next):attrs+' '+next;}});
    return `<${tag}${attrs}>`+(voidTag?'':body+`</${tag}>`);
   });
  }
  return new Response(html,{status:response.status,headers:response.headers});
 }
}
