import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const BASE = 'https://iphone-animation-git-diag-87a40c-playwithlifenow-8152s-projects.vercel.app';
const OUT = '.diagnostics/bezel-mask-evidence';
const REQUIRED = [0.477,0.507,0.520,0.559,0.650,0.706,0.760,0.772,0.796,0.815];
const EXTRA = [0.490,0.535,0.600,0.680,0.735,0.785,0.805];
const ALL = [...new Set([...REQUIRED,...EXTRA])].sort((a,b)=>a-b);
const REGRESSION = [0.477,0.559,0.650,0.760,0.815];
fs.mkdirSync(OUT,{recursive:true});

const label = p => Number(p).toFixed(3);
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function readPng(file){ return PNG.sync.read(fs.readFileSync(file)); }
function rgbaDelta(a,b,i){ return Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2])); }
function maskStats(file){
  const png=readPng(file); const {width,height,data}=png;
  let count=0, grayViolation=0, x0=width,y0=height,x1=-1,y1=-1;
  const mask=new Uint8Array(width*height);
  for(let p=0,i=0;p<mask.length;p++,i+=4){
    const r=data[i],g=data[i+1],b=data[i+2];
    if(Math.max(r,g,b)>32){
      count++; mask[p]=1;
      const x=p%width,y=Math.floor(p/width); x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
      if(Math.max(r,g,b)-Math.min(r,g,b)>3) grayViolation++;
    }
  }
  return {width,height,count,coverage:count/(width*height),bbox:count?[x0,y0,x1,y1]:null,grayViolation,mask};
}
function dilate(mask,w,h){
  const out=new Uint8Array(mask.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let hit=0;
    for(let dy=-1;dy<=1&&!hit;dy++)for(let dx=-1;dx<=1;dx++){
      const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h&&mask[yy*w+xx]){hit=1;break;}
    }
    out[y*w+x]=hit;
  }
  return out;
}
function overlayRegistration(rawFile,offFile,overlayFile){
  const raw=maskStats(rawFile), off=readPng(offFile), over=readPng(overlayFile);
  if(raw.width!==off.width||raw.height!==off.height||off.width!==over.width||off.height!==over.height) throw new Error('dimension mismatch');
  const dil=dilate(raw.mask,raw.width,raw.height);
  let changed=0, changedInside=0, maskChanged=0, maskCount=0;
  for(let p=0,i=0;p<raw.mask.length;p++,i+=4){
    const d=rgbaDelta(off.data,over.data,i);
    const ch=d>8;
    if(ch){changed++; if(dil[p]) changedInside++;}
    if(raw.mask[p]){maskCount++; if(d>4) maskChanged++;}
  }
  return {changedPixels:changed, precision:changed?changedInside/changed:1, recall:maskCount?maskChanged/maskCount:0};
}
function regressionCompare(mainFile,offFile){
  const a=readPng(mainFile),b=readPng(offFile); if(a.width!==b.width||a.height!==b.height) throw new Error('dimension mismatch');
  const diff=new PNG({width:a.width,height:a.height});
  const pixelMismatch=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:0.08,includeAA:false});
  let exact=0,sum=0,max=0;
  for(let p=0,i=0;p<a.width*a.height;p++,i+=4){const d=rgbaDelta(a.data,b.data,i);if(d){exact++;sum+=d;max=Math.max(max,d);}}
  return {pixelMismatch,pixelMismatchPct:pixelMismatch/(a.width*a.height),exactDiffPixels:exact,exactDiffPct:exact/(a.width*a.height),meanMaxChannelDelta:exact?sum/exact:0,maxChannelDelta:max};
}

const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']});
const context=await browser.newContext({viewport:{width:1350,height:900},deviceScaleFactor:1,colorScheme:'light',reducedMotion:'no-preference'});
const page=await context.newPage();
page.setDefaultTimeout(120000);

const consoleErrors=[];
page.on('console',m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });
page.on('pageerror',e=>consoleErrors.push(String(e)));

async function capture(mode,p,{audit=false}={}){
  const u=`${BASE}/bezel-mask-harness.html?mode=${mode}&p=${label(p)}${audit?'&audit=1':''}`;
  await page.goto(u,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>document.querySelector('iframe')?.src?.length>0,{timeout:30000});
  let child=null;
  for(let n=0;n<240;n++){
    child=page.frames().find(f=>f!==page.mainFrame() && /iphone-animation/.test(f.url()));
    if(child) break;
    await sleep(250);
  }
  if(!child) throw new Error(`No hero iframe for ${mode} ${p}`);
  await child.waitForFunction(()=>window.__iglassCaptureReady===true,{timeout:120000});
  if(mode==='raw'||mode==='overlay') await page.waitForFunction(()=>window.__bezelMaskAudit?.status==='READY',{timeout:120000});
  await sleep(250);
  const file=path.join(OUT,`${mode}-${label(p)}.png`);
  await page.screenshot({path:file,type:'png'});
  const a=(mode==='raw'||mode==='overlay')?await page.evaluate(()=>window.__bezelMaskAudit):null;
  const gpu=await child.evaluate(()=>{
    const c=document.querySelector('canvas'); const gl=c?.getContext('webgl2')||c?.getContext('webgl');
    if(!gl)return null; const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};
  }).catch(()=>null);
  return {file,audit:a,gpu,url:u};
}

const records=[];
for(const p of ALL){
  const raw=await capture('raw',p,{audit:p===0.477});
  const off=await capture('off',p);
  const overlay=await capture('overlay',p);
  const ms=maskStats(raw.file);
  const reg=overlayRegistration(raw.file,off.file,overlay.file);
  records.push({p,required:REQUIRED.includes(p),raw:path.basename(raw.file),off:path.basename(off.file),overlay:path.basename(overlay.file),audit:raw.audit,gpu:raw.gpu,mask:{count:ms.count,coverage:ms.coverage,bbox:ms.bbox,grayViolation:ms.grayViolation},overlayRegistration:reg});
}

const regressions=[];
for(const p of REGRESSION){
  const main=await capture('main',p);
  const off=path.join(OUT,`off-${label(p)}.png`);
  regressions.push({p,main:path.basename(main.file),off:path.basename(off),...regressionCompare(main.file,off)});
}

await browser.close();

const firstAudit=records.find(r=>r.audit)?.audit||null;
const auditInvariant=records.every(r=>r.audit?.status==='READY' && JSON.stringify(r.audit?.meshNames)===JSON.stringify(firstAudit?.meshNames));
const registrationPass=records.every(r=>r.overlayRegistration.precision>=0.985 && r.overlayRegistration.recall>=0.985);
const maskPass=records.every(r=>r.mask.count>0 && r.mask.grayViolation===0);
const regressionPass=regressions.every(r=>r.pixelMismatchPct<=0.0005);
const report={generatedAt:new Date().toISOString(),viewport:[1350,900],requiredP:REQUIRED,extraP:EXTRA,meshAudit:firstAudit,auditInvariant,registrationPass,maskPass,regressionPass,records,regressions,consoleErrors:[...new Set(consoleErrors)].slice(0,50)};
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));

const fmt=n=>typeof n==='number'?n.toFixed(6):String(n);
let md=`# GPU Bezel Mask Acceptance Evidence\n\nGenerated ${report.generatedAt}. Viewport 1350×900.\n\n## Runtime semantic audit\n\n\`\`\`json\n${JSON.stringify(firstAudit,null,2)}\n\`\`\`\n\n## Required frames\n\n| p | mask px | coverage | overlay precision | overlay recall | raw | overlay | off |\n|---:|---:|---:|---:|---:|---|---|---|\n`;
for(const r of records.filter(x=>x.required)) md+=`| ${label(r.p)} | ${r.mask.count} | ${fmt(r.mask.coverage)} | ${fmt(r.overlayRegistration.precision)} | ${fmt(r.overlayRegistration.recall)} | ![](${r.raw}) | ![](${r.overlay}) | ![](${r.off}) |\n`;
md+=`\n## Additional intermediate frames\n\n| p | raw | overlay |\n|---:|---|---|\n`;
for(const r of records.filter(x=>!x.required)) md+=`| ${label(r.p)} | ![](${r.raw}) | ![](${r.overlay}) |\n`;
md+=`\n## Debug-OFF regression against main\n\n| p | pixelmatch mismatch | mismatch % | exact diff % | max channel delta | main | branch debug-OFF |\n|---:|---:|---:|---:|---:|---|---|\n`;
for(const r of regressions) md+=`| ${label(r.p)} | ${r.pixelMismatch} | ${fmt(r.pixelMismatchPct)} | ${fmt(r.exactDiffPct)} | ${r.maxChannelDelta} | ![](${r.main}) | ![](${r.off}) |\n`;
md+=`\n## Automated gates\n\n- semantic audit invariant: **${auditInvariant?'PASS':'FAIL'}**\n- raw mask deterministic/grayscale/non-empty: **${maskPass?'PASS':'FAIL'}**\n- raw-mask ↔ overlay pixel registration: **${registrationPass?'PASS':'FAIL'}**\n- debug-OFF ↔ main regression: **${regressionPass?'PASS':'FAIL'}**\n\n## Browser console errors\n\n\`\`\`\n${report.consoleErrors.join('\n')||'(none)'}\n\`\`\`\n`;
fs.writeFileSync(path.join(OUT,'EVIDENCE.md'),md);
console.log(JSON.stringify({auditInvariant,registrationPass,maskPass,regressionPass,meshNames:firstAudit?.meshNames,meshCount:firstAudit?.meshCount,consoleErrors:report.consoleErrors},null,2));
if(!auditInvariant||!registrationPass||!maskPass||!regressionPass) process.exitCode=2;
