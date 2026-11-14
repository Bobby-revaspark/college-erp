import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiRequestUrl} from '../server/vercel-routing';
import {resolveAppOrigin} from '../server/security';
test('Vercel rewrite restores nested API routes and preserves query filters',()=>{
 assert.equal(apiRequestUrl('/api?__erp_path=auth%2Flogin'),'/api/auth/login');
 assert.equal(apiRequestUrl('/api?__erp_path=bootstrap&semester=3'),'/api/bootstrap?semester=3');
 assert.equal(apiRequestUrl('/api?x=1',['users','abc','role']),'/api/users/abc/role?x=1');
 assert.equal(apiRequestUrl('/api/auth/me'),'/api/auth/me');
});
test('captured query delimiters remain inside path',()=>{
 assert.equal(apiRequestUrl('/api','students?admin=true'),'/api/students%3Fadmin%3Dtrue');
});
test('Vercel domain origin is exact and explicit custom domain takes precedence',()=>{
 assert.equal(resolveAppOrigin({NODE_ENV:'production',VERCEL_URL:'campus-123.vercel.app'}),'https://campus-123.vercel.app');
 assert.equal(resolveAppOrigin({NODE_ENV:'production',VERCEL_URL:'campus-123.vercel.app',APP_ORIGIN:'https://college.example'}),'https://college.example');
});
