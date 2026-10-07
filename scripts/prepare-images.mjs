import {mkdir,writeFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';
const titles = [
 'Panoramic view of Gangjin-eup.jpg','Gundong-myeon-Gangjin-eup border.JPG',
 'Gangjin-eup-Gundong myeon border.JPG','Yeongrang Birth place Gangjin Jeollanamdo South Korea01.jpg',
 'Dasanchodang (茶山草堂) - panoramio.jpg','Korean pottery-jangdoks in Gangjin Jeollanamdo(1).jpg',
 'Korean pottery-jangdoks in Gangjin Jeollanamdo(2).jpg','Doenjang in Jangdok Gangjin South Korea.jpg',
 'Doenjang in Jangdok Gangjin South Korea(2).jpg','Poem monument of Kim Yeong-nang Gangjin South Korea.jpg',
 'White Paeonia ostii Gangjin Jeollanam-do South Korea(1).jpg','White Paeonia suffruticosa Gangjin Jeollanam-do South Korea(2).jpg',
 'Goryeo Celadon Kiln Site, Gangjin.jpg','강진병영면의은행나무전경.jpg',
 '강진 성동리 은행나무 전경 (촬영년도 2015년).jpg','Encykorea-강진 까막섬 상록수림.jpg',
 'KORAIL Gangjin Gun 51 (17283089831).jpg','KORAIL Gangjin Gun 33 (17095832698).jpg',
 'KORAIL Gangjin Gun 67 (17283084391).jpg','KORAIL Gangjin Gun 11 (17053645068).jpg',
 'KORAIL Gangjin Gun 66 (16663353743).jpg','KORAIL Gangjin Gun 41 (16661142364).jpg',
 'KORAIL Gangjin Gun 59 (17096046600).jpg','KORAIL Gangjin Gun 68 (17283084121).jpg',
 'KORAIL Gangjin Gun 35 (17095831878).jpg','KORAIL Gangjin Gun 06 gejang.jpg',
 'Chueotang, Gangjin, Jeollanam-do.jpg','KORAIL Gangjin Gun 01 (17053892080).jpg'
];
const strip=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
await mkdir('public/images',{recursive:true});
const params=new URLSearchParams({action:'query',titles:titles.map(t=>'File:'+t).join('|'),prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1600',format:'json'});
const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{headers:{'User-Agent':'MonthlyGangjin/1.0 (gjfnews365@gmail.com)'}});
if(!response.ok)throw Error('Commons metadata '+response.status);
const pages=Object.values((await response.json()).query.pages);
const manifest=[];
for(let i=0;i<titles.length;i++){
 const page=pages.find(p=>p.title==='File:'+titles[i]);
 const info=page?.imageinfo?.[0]; if(!info)throw Error('Missing Commons photo '+titles[i]);
 const meta=info.extmetadata,license=strip(meta.LicenseShortName?.value);
 if(!/CC BY|CC0|Public domain|KOGL Type 1/i.test(license))throw Error('Unapproved photo license '+license);
 const id='photo-'+String(i+1).padStart(2,'0');
 let buffer;
 try{buffer=await readFile('public/images/'+id+'.webp')}catch{
  const r=await fetch(info.thumburl||info.url,{headers:{'User-Agent':'MonthlyGangjin/1.0 (gjfnews365@gmail.com)'},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('Photo '+id+' download '+r.status);
  buffer=Buffer.from(await r.arrayBuffer());
 }
 const original=await sharp(buffer).metadata();
 for(const width of [640,960,1600])await sharp(buffer).rotate().resize({width,withoutEnlargement:true}).webp({quality:82}).toFile('public/images/'+id+(width===1600?'':'-'+width)+'.webp');
 manifest.push({id,src:'/images/'+id+'.webp',alt:strip(meta.ObjectName?.value)||titles[i],caption:'강진 사진 기록 · 지면 구성 예시',credit:strip(meta.Artist?.value)+' · '+license,width:Math.min(original.width,1600),height:Math.round(original.height*Math.min(original.width,1600)/original.width),source:info.descriptionurl,license,licenseUrl:meta.LicenseUrl?.value,description:strip(meta.ImageDescription?.value).slice(0,400)});
 console.log(id+' '+license);
}
await writeFile('data/image-credits.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared '+manifest.length+' distinct, attributed Gangjin photographs.');
