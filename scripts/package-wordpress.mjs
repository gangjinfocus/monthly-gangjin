import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const theme=resolve('wordpress/theme/monthly-gangjin');
await mkdir(theme+'/assets',{recursive:true});
for(const file of ['site.css','site.js'])await cp('public/'+file,theme+'/assets/'+file);
await cp('public/fonts',theme+'/assets/fonts',{recursive:true});
await cp('public/images',theme+'/images',{recursive:true});
await mkdir('test-results/wordpress-packages',{recursive:true});
await cp('data/content.json','test-results/wordpress-packages/gangjin-public-content.json');
await cp('data/image-credits.json','test-results/wordpress-packages/image-credits.json');
for(const type of ['theme','plugin']){
 const source=resolve('wordpress/'+type+'/monthly-gangjin');
 const destination=resolve('test-results/wordpress-packages/monthly-gangjin-'+type+'.zip');
 if(process.platform==='win32'){
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  execFileSync('powershell',['-NoProfile','-Command',`Compress-Archive -LiteralPath ${quote(source)} -DestinationPath ${quote(destination)} -Force`],{stdio:'pipe'});
 }else execFileSync('zip',['-q','-r',destination,'monthly-gangjin'],{cwd:resolve('wordpress/'+type),stdio:'pipe'});
}
const note='월간 강진 WordPress 이전 패키지\n\n1. 플러그인 ZIP 설치/활성화\n2. 테마 ZIP 설치/활성화\n3. 월간 강진 관리자에서 gangjin-public-content.json 가져오기\n4. 고유주소/홈페이지/구독 폼/정책/실제 사진 확인\n5. 전체 안내: 저장소 docs/WORDPRESS.md\n\n이 공개 콘텐츠 파일은 개인정보 접수 자료를 포함하지 않습니다.\n실제 개인/기관 구독 데이터는 기존 관리자에서 비공개로 별도 내보내고 안전한 경로로 이전하십시오.\n';
await writeFile('test-results/wordpress-packages/설치안내.txt',note);
console.log('WordPress theme/plugin ZIPs, public content and credits packaged in test-results/wordpress-packages.');
