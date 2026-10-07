import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, getPublicRoutes, publicContent, escapeHtml } from './render.mjs';
export { renderPage, getPublicRoutes, publicContent } from './render.mjs';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export async function buildSite(content, config = {}) {
  const outDir = path.resolve(config.outDir || path.join(projectRoot,'dist'));
  if (outDir === projectRoot || !outDir.startsWith(projectRoot + path.sep) || ['data','public','scripts','server','wordpress','docs','tests'].some(dir => outDir === path.join(projectRoot,dir) || outDir.startsWith(path.join(projectRoot,dir) + path.sep))) throw new Error('Build output must be a dedicated directory inside this project.');
  const basePath = config.basePath || process.env.BASE_PATH || '/';
  const siteUrl = new URL(config.siteUrl || process.env.SITE_URL || 'http://localhost:4173').origin;
  const publicApiBase = config.publicApiBase || process.env.PUBLIC_API_BASE || '';
  if (publicApiBase && !/^https:\/\//i.test(publicApiBase)) throw new Error('PUBLIC_API_BASE must be an HTTPS endpoint.');
  const customDomain = config.customDomain || process.env.CUSTOM_DOMAIN || '';
  if (customDomain && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(customDomain)) throw new Error('CUSTOM_DOMAIN must be a hostname without a protocol or path.');
  const renderConfig = {...config,basePath,siteUrl,apiBase:publicApiBase || config.apiBase,mode:publicApiBase ? 'live' : config.mode || 'static'};
  const routes = getPublicRoutes(content);
  // Remove only the checked, dedicated output directory; source assets remain intact.
  await rm(outDir,{recursive:true,force:true});
  await mkdir(outDir,{recursive:true});
  await cp(path.join(projectRoot,'public'),outDir,{recursive:true});
  for (const route of routes) {
    const target = path.resolve(outDir,'.' + route,'index.html');
    if (!target.startsWith(outDir + path.sep)) throw new Error('Unsafe public route: ' + route);
    await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,renderPage(route,content,renderConfig),'utf8');
  }
  await writeFile(path.join(outDir,'404.html'),renderPage('/404/',content,renderConfig),'utf8');
  if (customDomain) await writeFile(path.join(outDir,'CNAME'),customDomain + '\n','utf8');
  const prefix = '/' + basePath.replace(/^\/+|\/+$/g,'');
  const canonical = route => siteUrl.replace(/\/$/,'') + (prefix === '/' ? '' : prefix) + route;
  const indexed = routes.filter(route => route !== '/search/');
  await writeFile(path.join(outDir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed.map(route => `<url><loc>${escapeHtml(canonical(route))}</loc></url>`).join('\n')}\n</urlset>`,'utf8');
  await writeFile(path.join(outDir,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: ${prefix === '/' ? '' : prefix}/admin/\nDisallow: ${prefix === '/' ? '' : prefix}/api/\nSitemap: ${canonical('/sitemap.xml')}\n`,'utf8');
  return {outDir,routes:routes.length,basePath,siteUrl};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = JSON.parse(await readFile(path.join(projectRoot,'data/content.json'),'utf8'));
  const result = await buildSite(content);
  process.stdout.write(`Built ${result.routes} public pages → ${result.outDir}\n`);
}
