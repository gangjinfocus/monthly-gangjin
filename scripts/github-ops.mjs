import {execFileSync} from 'node:child_process';
const owner='gangjinfocus', repo='monthly-gangjin';
const raw=execFileSync('git',['credential','fill'],{input:`protocol=https\nhost=github.com\nusername=${owner}\n\n`,encoding:'utf8',env:{...process.env,GCM_INTERACTIVE:'never'}});
const token=raw.split('\n').find(l=>l.startsWith('password='))?.slice(9);
if(!token)throw Error('GitHub account is not authenticated');
const api=async(path,method='GET',body)=>{
 const r=await fetch('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const value=r.status===204?{}:await r.json();
 if(!r.ok)throw Error('GitHub API '+r.status+': '+value.message);
 return value;
};
const account=await api('/user');
if(account.login!==owner)throw Error('Authenticated GitHub account does not match requested owner');
const base=`/repos/${owner}/${repo}`;
switch(process.argv[2]){
 case 'enable-pages': {
  let exists;try{exists=await api(base+'/pages')}catch(error){if(!error.message.includes('404'))throw error}
  const p=await api(base+'/pages',exists?'PUT':'POST',{build_type:'workflow'});
  console.log(JSON.stringify({owner,url:p.html_url||`https://${owner}.github.io/${repo}/`,configured:true}));break;
 }
 case 'pages': {const p=await api(base+'/pages');console.log(JSON.stringify({url:p.html_url,status:p.status,build_type:p.build_type,https_enforced:p.https_enforced,cname:p.cname}));break;}
 case 'runs': {const p=await api(base+'/actions/runs?per_page=3');console.log(JSON.stringify(p.workflow_runs.map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,url:r.html_url,sha:r.head_sha}))));break;}
 default: {const p=await api(base);console.log(JSON.stringify({owner:account.login,repository:p.full_name,defaultBranch:p.default_branch,url:p.html_url}));}
}
