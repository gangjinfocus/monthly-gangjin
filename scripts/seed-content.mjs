import {readFile,writeFile} from 'node:fs/promises';
const categories=[
 ['cover','이달의 강진','매월 하나의 주제를 깊게 읽는 커버스토리'],
 ['people','강진 사람','강진에서 살아가는 사람을 만납니다'],
 ['village','동네 담談','강진읍과 열 개 면, 마을의 작은 이야기'],
 ['food','맛있는 강진','생산자와 식재료, 시장과 식탁의 이야기'],
 ['work','일하는 강진','지역에서 일하고 먹고사는 방법'],
 ['history','오래된 강진','문장과 청자, 오래된 시간의 흔적'],
 ['life','강진 생활','계절마다 달라지는 일상과 문화']
].map(([slug,name,description])=>({slug,name,description}));
let credits=[];try{credits=JSON.parse(await readFile('data/image-credits.json','utf8'))}catch{}
const altTexts=['강진읍과 주변 들판을 내려다본 풍경','강진읍 표지판과 동네로 이어지는 길','군동면 표지판 너머의 도로와 들판','영랑생가 입구와 계단','가을빛 나무와 다산초당의 처마','햇빛 아래 늘어선 강진의 장독','산을 배경으로 마당을 채운 장독','장독 안에 보관한 된장','장독 속 된장과 저장 도구','풀과 나무 사이에 세워진 영랑 시비','푸른 잎 사이에 핀 흰 모란','모란의 잎과 꽃봉오리','강진 고려청자 가마터의 발굴 흔적','병영면의 커다란 은행나무','성동리 은행나무와 마을의 자리','물 위에 비친 까막섬의 나무들','박물관의 전시 공간','사찰 기둥과 단청의 세부','사찰 마당을 걷는 사람들과 전각','분홍 꽃이 핀 작은 들꽃','초록 나무와 빛이 드는 숲','나무로 지은 전통 건물의 툇마루','강진 바다와 산, 물 위의 길','박물관에 전시된 고려청자','초록 나무 사이로 이어지는 흙길','양념과 함께 차린 게장','파와 들깻가루를 올린 추어탕','접시에 담은 전복회'];
credits=credits.map((entry,index)=>({...entry,alt:altTexts[index]}));
await writeFile('data/image-credits.json',JSON.stringify(credits,null,2)+'\n');
const photo=(n,alt)=>({...credits.find(x=>x.id==='photo-'+String(n).padStart(2,'0')),src:'/images/photo-'+String(n).padStart(2,'0')+'.webp',alt:alt||altTexts[n-1],caption:'강진 사진 기록 · 기사 구성 예시',credit:credits.find(x=>x.id==='photo-'+String(n).padStart(2,'0'))?.credit||'Wikimedia Commons · 사진 출처 목록 참고'});
const specs=[
 ['living-in-gangjin','나는 왜 강진에 사나?','익숙한 풍경을 조금 낯설게 바라보는 일. 우리의 첫 번째 질문은 여기서 시작합니다.','cover',[23,25,21,22,5,16],'살아가는 곳을 기록한다는 것','어떤 곳을 안다는 것은 그곳에서 살아가는 사람들의 하루를 헤아리는 일일지도 모릅니다. 관광지도에 표시된 이름을 지나, 매일 밥을 짓고 문을 열고 같은 길을 걷는 시간을 먼저 생각합니다.','여기서 태어난 사람도, 떠났다가 돌아온 사람도, 강진을 처음 선택한 사람도 있습니다.'],
 ['returning-home','떠났다가 돌아왔습니다','돌아온 사람의 이야기를 기다리며, 처음부터 다시 바라보는 동네.','people',[22,10,11,12,14],'한 사람의 목소리가 지면이 되기까지','돌아온다는 말 안에는 여러 시간이 들어 있습니다. 떠나 있던 시간과 남아 있던 시간, 다시 만난 풍경을 말로 옮기는 시간. 월간 강진은 그 사이를 서둘러 결론 내리지 않으려 합니다.','인터뷰는 정답을 듣는 일이 아니라 한 사람의 시간을 천천히 따라가는 일입니다.'],
 ['a-day-in-gangjin','강진의 하루는 이렇게 흐른다','마을의 아침부터 골목의 저녁까지. 하루의 작은 장면들을 이어봅니다.','life',[3,2,14,15,16],'하루를 이루는 작은 풍경','어디에나 아침이 있고 저녁이 있지만, 하루의 리듬은 장소마다 다릅니다. 같은 길도 빛과 계절, 지나가는 사람에 따라 다른 표정을 보여줍니다. 그 변화를 사진 사이의 여백에 담고 싶습니다.','매일 같은 길에도 매일 다른 장면이 있습니다.'],
 ['opening-the-dawn','새벽을 여는 사람','문이 열리기 전의 시간, 누군가의 손에서 시작되는 하루를 생각합니다.','people',[19,18,21,22,25],'우리가 아직 만나지 못한 손','사람을 소개하는 지면에는 이름보다 먼저 그 사람이 보내는 시간을 담으려 합니다. 일하는 손과 도구, 잠깐 쉬는 자리, 하루를 시작하는 습관 같은 것들입니다. 실제 취재에서는 당사자의 동의를 받아 이야기를 기록합니다.','일상은 누군가의 보이지 않는 수고 위에서 시작됩니다.'],
 ['walking-gangjin-eup','매일 지나쳐서 몰랐던 강진읍','발걸음의 속도를 늦추면, 익숙한 동네가 한 장의 사진이 됩니다.','village',[1,2,3,15,16],'지나치는 곳에서 머무는 곳으로','우리는 큰 이름을 가진 장소와 작고 익숙한 장소를 같은 관심으로 바라봅니다. 길가의 나무와 낮은 담, 골목 끝에서 보이는 산. 익숙해서 사진으로 남기지 않았던 장면이 동네의 표정을 만들기도 합니다.','동네를 읽는 가장 좋은 속도는 걸음의 속도입니다.'],
 ['the-gangjin-table','강진 사람은 이걸 어떻게 먹을까','식재료가 식탁에 오기까지. 맛을 넘어 그 뒤의 시간을 읽습니다.','food',[26,27,28,8,9],'한 끼의 뒤편','음식의 이야기는 완성된 한 접시만으로 끝나지 않습니다. 재료를 고르고 기다리고 보관하는 과정, 함께 먹는 사람, 계절에 따라 달라지는 습관을 함께 담아야 식탁의 모습이 조금 더 선명해집니다.','한 끼에는 재료가 자란 계절과 그것을 준비한 시간이 함께 놓입니다.'],
 ['making-a-living','강진에서 먹고사는 법','흙과 손, 도구와 계절. 지역에서 일한다는 것에 관한 기록.','work',[6,7,13,22,23],'일의 풍경을 바라보는 일','지역의 일은 한 가지 모습으로 설명하기 어렵습니다. 오랫동안 이어온 기술과 새롭게 시작한 일, 계절을 따라 움직이는 일과 매일 같은 자리에서 이어지는 일을 서로 다른 목소리로 기록하려 합니다.','작은 도구 하나에도 오래 반복한 손의 기억이 남습니다.'],
 ['walking-with-yeongrang','영랑의 문장을 따라 걷다','집과 정원, 나무와 여백. 오래된 문장을 만나는 느린 산책.','history',[4,10,11,12,5,24,25],'문장과 공간 사이','문학과 역사를 다루는 지면에서는 기록된 사실과 오늘의 감상을 구분합니다. 장소의 설명과 작품의 인용은 공식 자료와 저작권을 확인하고, 사진은 촬영 시점과 출처를 함께 남깁니다. 이 예시에는 실제 작품의 문장을 인용하지 않았습니다.','오래된 공간은 오늘의 발걸음을 만나 다시 읽힙니다.']
];
const layouts=['mosaic','portrait','strip','trio','pair','split','overlap','mosaic'];
const articles=specs.map(([slug,title,subtitle,category,nums,heading,body,quote],i)=>{
 const images=nums.map(n=>photo(n));
 return {id:'story-'+(i+1),slug,title,subtitle,category,author:'월간 강진 편집부 · 구성 예시',photographer:'출처별 표기 · Wikimedia Commons',date:'2027-01-01',status:'published',publishAt:null,primaryImage:images[0].src,secondaryImage:images[1].src,images,tags:['창간호','강진','로컬 매거진'],people:[],places:['강진'],issueId:'vol-01',isDemo:true,seo:{title:title+' | 월간 강진',description:subtitle},blocks:[
 {type:'paragraph',text:'이 글은 월간 강진 창간호의 편집 구성과 읽기 경험을 보여주기 위한 예시입니다. 실존 인물의 인터뷰나 현장 취재 기사로 작성된 내용이 아닙니다. 사진은 출처와 이용 조건이 확인된 공개 기록이며 현재의 모습을 보증하지 않습니다.'},
 {type:'heading',text:heading},{type:'paragraph',text:body},
 {type:layouts[i],images:images.slice(1,4),text:'사진 사이의 여백에도 이야기가 있습니다.'},
 {type:'paragraph',text:'월간 강진은 사람과 마을, 일과 맛을 기록하는 독립적인 지역 월간지를 지향합니다. 유명한 장소를 소개하는 데서 한 걸음 더 나아가, 그 장소를 일상으로 살아가는 사람들의 시선을 함께 담고자 합니다.'},
 {type:'quote',text:quote},{type:'full',images:[images[images.length-1]]},
 {type:'heading',text:'다음 장을 함께 만들어주세요'},
 {type:'paragraph',text:'기록하고 싶은 동네의 이야기, 만나보고 싶은 사람, 오래 남기고 싶은 장면이 있다면 편집부에 알려주세요. 실제 발행 전에는 취재 내용과 사진 사용 동의, 사실 확인을 거쳐 이 예시를 정식 기사로 교체합니다.'},
 {type:'pair',images:images.slice(0,2)}
 ]};
});
const content={version:1,imageCredits:credits,settings:{name:'월간 강진',englishName:'MONTHLY GANGJIN',tagline:'유명한 강진보다, 살아 있는 강진을 기록합니다.',email:'gjfnews365@gmail.com',singlePrice:10000,annualPrice:120000,heroArticleIds:['story-1','story-5','story-8'],featuredArticleIds:['story-2','story-4','story-6','story-7'],heroImages:[photo(23),photo(25),photo(21)],sectionOrder:['cover','people','village','food','work','history','life'],footer:{publisher:'',editor:'',address:'',businessNumber:'',registrationNumber:'',issn:'',phone:''},social:{instagram:'',youtube:'',facebook:''}},categories,articles,issues:[{id:'vol-01',volume:'01',month:'2027-01',title:'강진에서 산다는 것',description:'사람과 마을, 일과 맛. 월간 강진 창간호 편집 예시.',cover:photo(23).src,articleIds:articles.map(a=>a.id),isDemo:true}]};
await writeFile('data/content.json',JSON.stringify(content,null,2)+'\n');
console.log('Seeded 8 explicitly labelled demonstration stories and 1 issue.');

