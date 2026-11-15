import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultInstitution,paymentReceiptBalances} from '../server/institution';
test('institution fallback exposes branding without private configuration',()=>{
 const settings=defaultInstitution();assert.equal(settings.id,'college');assert.equal(settings.logoUrl,'/college-logo.png');assert.match(settings.academicYear,/^\d{4}–\d{2}$/);assert.equal(settings.name,'Gandhi P.R. College');
});
test('old receipts derive their historical balance and preserve recorded snapshots',()=>{
 const date=new Date('2026-01-01');
 const payments=[{id:'later',studentId:'s',amount:25,date:new Date('2026-02-01'),createdAt:date},{id:'first',studentId:'s',amount:30,date,createdAt:date},{id:'snapshot',studentId:'t',amount:20,balanceAfter:123,date,createdAt:date}];
 const result=paymentReceiptBalances(payments,new Map([['s',100],['t',200]]));assert.equal(result.get('first'),70);assert.equal(result.get('later'),45);assert.equal(result.get('snapshot'),123);
});
