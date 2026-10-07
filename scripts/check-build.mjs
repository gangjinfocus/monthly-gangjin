import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import assert from 'node:assert/strict';
const dist=resolve('dist'), base=process.env.BASE_PATH||'/';
const prefix='/'+base.replace(/^\/+|\/+$/g,'');
const files=[];
async function walk(folder){for(const e of await readdir(folder,{withFileTypes:true})){const p=join(folder,e.name);if(e.isDirectory())await walk(p);else if(e.name.endsWith('.html'))files.push(p)}}await walk(dist);
let checked=0;
for(const file of files){
 const html=await readFile(file,'utf8');
 for(const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
  const raw=m[1].replaceAll('&amp;','&');if(/^(?:https?:|mailto:|tel:|data:)/.test(raw))continue;
  if(!raw.startsWith('/'))continue;
  let url=raw.split(/[?#]/)[0];
  if(prefix!=='/'){assert(url.startsWith(prefix+'/'),'Unexpected path '+url+' in '+file);url=url.slice(prefix.length);}
  let target=resolve(dist,'.'+decodeURIComponent(url));assert(target===dist||target.startsWith(dist+sep),'Unsafe path');
  let info;try{info=await stat(target)}catch{throw Error('Missing internal resource '+url+' in '+file)}
  if(info.isDirectory())await stat(join(target,'index.html'));checked++;
 }
 for(const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))JSON.parse(m[1]);
}
const home=await readFile(join(dist,'index.html'),'utf8');
const images=[...home.matchAll(/<img[^>]+src="([^"]+)/g)].map(m=>m[1]);
assert(new Set(images).size>=20,'Homepage must show at least 20 distinct photographic sources.');
console.log(JSON.stringify({pages:files.length,internalResources:checked,homePhotoSlots:images.length,distinctHomePhotos:new Set(images).size}));
