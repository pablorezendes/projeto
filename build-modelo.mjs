import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
await build({ entryPoints:[path.join(root,'src/modelo.js')], outfile:path.join(root,'public/modelo/viewer.js'), bundle:true, minify:true, format:'iife', target:'es2020', legalComments:'eof', sourcemap:false });
