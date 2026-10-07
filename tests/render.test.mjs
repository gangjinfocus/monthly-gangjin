import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPage,publicContent} from '../scripts/render.mjs';
const content=JSON.parse(await readFile(new URL('../data/content.json',import.meta.url),'utf8'));
const config={basePath:'/monthly-gangjin/',siteUrl:'https://gangjinfocus.github.io',apiBase:'',mode:'static'};
test('all requested public routes render content and base-aware navigation',()=>{
 const routes=['/','/archive/','/issues/vol-01/','/subscribe/','/institutions/','/advertise/','/contact/','/about/','/search/','/credits/',...['privacy','terms','email','subscription','refund'].map(p=>'/policies/'+p+'/'),...content.categories.map(c=>'/category/'+c.slug+'/'),...content.articles.map(a=>'/stories/'+a.slug+'/')];
 for(const route of routes){const html=renderPage(route,content,config);assert.match(html,/<!doctype html>/i,route);assert.match(html,/<html lang="ko">/,route);assert.match(html,/<main[ >]/,route);assert.match(html,/href="\/monthly-gangjin\//,route);assert(!html.includes('https://gangjinfocus.github.io/monthly-gangjin/monthly-gangjin'),route);assert(!html.includes('undefined'),route);}
});
test('article SEO has canonical, structured data, provenance and demonstration label',()=>{
 const html=renderPage('/stories/living-in-gangjin/',content,config);
 assert.match(html,/rel="canonical" href="https:\/\/gangjinfocus.github.io\/monthly-gangjin\/stories\/living-in-gangjin\/"/);
 assert.match(html,/application\/ld\+json/);assert.match(html,/"@type":"Article"/);assert.match(html,/BreadcrumbList/);assert.match(html,/예시 기사|구성 예시/);assert.match(html,/CC BY-SA|KOGL/);
});
test('future and draft stories never appear in search, cards or article pages',()=>{
 const source=structuredClone(content);source.articles.push({...source.articles[0],id:'draft-secret',slug:'draft-secret',title:'DO_NOT_DISCLOSE_DRAFT',status:'draft'},{...source.articles[0],id:'future-secret',slug:'future-secret',title:'DO_NOT_DISCLOSE_FUTURE',status:'scheduled',publishAt:'2099-01-01T00:00:00Z'});
 assert.equal(publicContent(source).articles.length,content.articles.length);
 for(const route of ['/','/search/','/category/cover/','/stories/draft-secret/','/stories/future-secret/'])assert.doesNotMatch(renderPage(route,source,config),/DO_NOT_DISCLOSE/);
});
test('editor supplied text is escaped in HTML and structured JSON',()=>{
 const source=structuredClone(content);source.articles[0].title='<img src=x onerror=alert(1)>';source.articles[0].blocks[0].text='</script><script>alert(1)</script>';
 const html=renderPage('/stories/living-in-gangjin/',source,config);assert.doesNotMatch(html,/<img src=x|<script>alert\(1\)/);assert.match(html,/&lt;img/);
});
test('static inquiry pages explicitly communicate contact behavior without a DB',()=>{
 for(const route of ['/subscribe/','/institutions/','/advertise/','/contact/']){const html=renderPage(route,content,config);assert.match(html,/gjfnews365@gmail.com/);assert.match(html,/개인정보|수집/);assert.match(html,/data-mode="static"/);}
});
