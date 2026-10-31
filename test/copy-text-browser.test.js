import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { renderParagraphs } from '../functions/_lib/copy-renderer.js';
const source=await readFile(new URL('../public/copy-text.js',import.meta.url),'utf8');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function element(tag,doc){return {tag,ownerDocument:doc,children:[],append(child){this.children.push(child);},replaceChildren(){this.children=[];}};}
function serialize(node){if(typeof node==='string')return escape(node);if(node.tag==='br')return '<br>';return `<${node.tag}>${node.children.map(serialize).join('')}</${node.tag}>`;}

test('browser copy and server copy produce the same escaped paragraphs for CMS multiline input',()=>{
 const context=vm.createContext({});vm.runInContext(source,context);
 const doc={createElement(tag){return element(tag,this);},createTextNode(value){return String(value);}};
 for(const value of ['첫 줄\r\n둘째 줄\\n셋째 줄\n \n새 문단 <script> & "안내"', '', '긴 https://example.com/a 와 이메일 test@example.com']){
  const container=element('div',doc);context.ClimeCopy.render(container,value);
  assert.equal(container.children.map(serialize).join(''),renderParagraphs(value));
 }
 const container=element('div',doc);context.ClimeCopy.render(container,'첫 값');context.ClimeCopy.render(container,'두 번째 값');assert.equal(container.children.map(serialize).join(''),'<p>두 번째 값</p>');
});
