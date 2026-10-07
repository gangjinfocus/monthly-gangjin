import {readdir,readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
async function walk(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+entry.name;if(entry.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
for(const folder of ['scripts','server','tests','public'])for(const file of await walk(folder))if(/\.(mjs|js)$/.test(file))execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
const c=JSON.parse(await readFile('data/content.json','utf8'));
assert.equal(c.settings.email,'gjfnews365@gmail.com');
assert.equal(c.settings.singlePrice,10000);assert.equal(c.settings.annualPrice,120000);
assert.equal(c.categories.length,7);
assert.equal(c.articles.length,8);
assert.equal(new Set(c.articles.map(a=>a.slug)).size,c.articles.length);
const credits=JSON.parse(await readFile('data/image-credits.json','utf8'));
assert.equal(credits.length,28);
for(const i of credits){assert(i.source&&i.license&&i.credit);for(const w of ['', '-640','-960'])await access('public'+i.src.replace('.webp',w+'.webp'));}
for(const a of c.articles){assert(a.isDemo===true);assert(a.blocks.some(b=>b.type==='paragraph'&&b.text.includes('예시')));for(const i of a.images)await access('public'+i.src);}
console.log('Syntax, source credits, 28 distinct responsive photo sets, 8 labelled stories, categories and price configuration verified.');
