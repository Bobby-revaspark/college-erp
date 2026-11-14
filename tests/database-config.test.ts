import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
import {mkdtempSync,readFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {configureDatabase} from '../server/database-config';
test('local database URL is unchanged',()=>{
 const env={DATABASE_URL:'mysql://local:password@localhost:3306/campus'};
 configureDatabase(env);assert.equal(env.DATABASE_URL,'mysql://local:password@localhost:3306/campus');
});
test('Aiven requires a CA and never leaks the URL in configuration errors',()=>{
 assert.throws(()=>configureDatabase({DATABASE_URL:'mysql://user:private-password@mysql.example.aivencloud.com:1234/defaultdb'}),/require DATABASE_CA_CERT/);
 assert.throws(()=>configureDatabase({DATABASE_URL:'invalid-private-password'}),{message:'DATABASE_URL is not a valid MySQL connection URL.'});
});
test('valid CA configures strict TLS, safe pool defaults and a private temporary file',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'campus-ca-test-'));
 try {
  const env={DATABASE_URL:'mysql://user:p%40ss@mysql.example.aivencloud.com:1234/campus?ssl-mode=REQUIRED&connection_limit=2',DATABASE_CA_CERT:rootCertificates[0].replaceAll('\n','\\n')};
  configureDatabase(env,dir);const url=new URL(env.DATABASE_URL);
  assert.equal(url.searchParams.get('sslaccept'),'strict');assert.equal(url.searchParams.get('connection_limit'),'2');assert.equal(url.searchParams.get('pool_timeout'),'20');assert(!url.searchParams.has('ssl-mode'));assert.equal(url.password,'p%40ss');
  const cert=url.searchParams.get('sslcert')!;assert.equal(statSync(cert).mode&0o777,0o600);assert.match(readFileSync(cert,'utf8'),/BEGIN CERTIFICATE/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
