import {readdir, readFile, lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=path.join(root,'public');
const allowed=new Set(['.html','.css','.js','.jpg','.jpeg','.png','.webp','.svg','.ico','.woff','.woff2']);
const files=[];
async function walk(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const filename=path.join(directory,entry.name);
    const info=await lstat(filename);
    if(info.isSymbolicLink())throw new Error(`Link simbólico não permitido: ${entry.name}`);
    if(entry.isDirectory())await walk(filename);
    else if(entry.isFile())files.push(filename);
  }
}
await walk(publicRoot);
for(const filename of files){
  const legalNotice=path.relative(publicRoot,filename).split(path.sep).join('/')==='modelo/THIRD-PARTY-LICENSE.txt';
  if((!allowed.has(path.extname(filename))&&!legalNotice)||path.basename(filename).startsWith('.'))throw new Error(`Arquivo não autorizado em public/: ${path.relative(publicRoot,filename)}`);
  if(['.html','.js','.css'].includes(path.extname(filename))){
    const content=await readFile(filename,'utf8');
    if(/ApiceP1_modelo3d|fitcheck|parts3d\.json|lista_de_corte|__DATA__|01_documentos\/|02_corte\/|04_desenhos\//i.test(content))throw new Error(`Referência ao acervo técnico em ${filename}`);
    if(path.extname(filename)==='.html'){
      if(/\sdownload(?:\s|=|>)/i.test(content))throw new Error('A apresentação não deve oferecer downloads de acervo.');
      const ids=new Set([...content.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
      for(const match of content.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)){
        const value=match[1];
        if(value.startsWith('#')){if(!ids.has(value.slice(1)))throw new Error(`Âncora ausente: ${value}`);continue;}
        if(/^(?:https?:|data:|blob:|mailto:)/.test(value))continue;
        const relative=decodeURIComponent(value.split(/[?#]/)[0]);
        const target=path.resolve(path.dirname(filename),relative);
        if(!target.startsWith(publicRoot+path.sep))throw new Error(`Referência fora de public/: ${value}`);
        await lstat(target);
      }
    }
  }
}
for(const name of ['public/app.js','src/modelo.js','build-modelo.mjs']){
  const result=spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr);
}
console.log(`Apresentação verificada: ${files.length} arquivos públicos; referências locais válidas; sem acervo técnico.`);
