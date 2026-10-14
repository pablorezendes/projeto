import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:; worker-src 'self' blob:; frame-src 'self' blob:; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'";
http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'text/plain'}).end('ok\n');return;}
    let target=path.resolve(root,pathname.replace(/^\/+/,''));
    if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(404).end();return;}
    let info=await stat(target);
    if(info.isDirectory()){target=path.join(target,'index.html');info=await stat(target);}
    if(!info.isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':info.size,'Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
    if(req.method==='HEAD')res.end();else createReadStream(target).pipe(res);
  }catch{res.writeHead(404).end('Não encontrado');}
}).listen(4180,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4180'));
