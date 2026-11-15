import {mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const output=mkdtempSync(join(tmpdir(),'erp-native-esm-'));
try {
 const compiled=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.server.json','--outDir',output],{stdio:'inherit'});
 if(compiled.status!==0)throw new Error('Server compilation failed');
 writeFileSync(join(output,'package.json'),JSON.stringify({type:'module'}));
 symlinkSync(resolve('node_modules'),join(output,'node_modules'),'dir');
 const entry=pathToFileURL(join(output,'api/index.js')).href;
 const app=pathToFileURL(join(output,'server/app.js')).href;
 const check=spawnSync(process.execPath,['--input-type=module','-e',`
  import assert from 'node:assert/strict';
  const {default:handler}=await import(${JSON.stringify(entry)});
  assert.equal(typeof handler,'function');
  const {db}=await import(${JSON.stringify(app)});
  await db.$disconnect();
  console.log('PASS: compiled Vercel entry and entire backend import successfully in native Node ESM.');
 `],{stdio:'inherit',env:{...process.env,NODE_ENV:'production',VERCEL:'1',DATABASE_URL:'mysql://check:check@127.0.0.1:3306/check',DATABASE_CA_CERT:'',JWT_SECRET:'native-module-check-only-0123456789abcdef',APP_ORIGIN:'https://example.edu',DOTENV_CONFIG_PATH:join(output,'no-env')}});
 if(check.status!==0)throw new Error('Native server import failed');
} finally {rmSync(output,{recursive:true,force:true});}
