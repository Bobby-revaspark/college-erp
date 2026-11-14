import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, overlaps, attendancePercentage, resolveAppOrigin, collegeDate, isPastOrTodayDate } from '../server/security';
test('students cannot write administrative or financial records',()=>{
 for(const action of ['students','payments','attendance','timetables','departments','structures'])assert.equal(can('STUDENT',action),false);
});
test('staff duties remain separate',()=>{
 assert.equal(can('ACCOUNTANT','payments'),true);
 assert.equal(can('ACCOUNTANT','attendance'),false);
 assert.equal(can('FACULTY','payments'),false);
 assert.equal(can('FACULTY','attendance'),true);
 assert.equal(can('ADMIN','departments'),true);
 assert.equal(can('ADMIN','unknown'),false);
});
test('time overlap handles containment and adjoining lectures',()=>{
 assert.equal(overlaps('09:00','10:00','10:00','11:00'),false);
 assert.equal(overlaps('09:00','11:00','09:30','10:00'),true);
 assert.equal(overlaps('09:30','10:00','09:00','11:00'),true);
});
test('attendance includes late as attended and handles empty history',()=>{
 assert.equal(attendancePercentage(['PRESENT','LATE','ABSENT','PRESENT']),75);
 assert.equal(attendancePercentage([]),0);
});

test('Railway public domain configures the origin and explicit custom domain takes precedence',()=>{
 assert.equal(resolveAppOrigin({NODE_ENV:'production',RAILWAY_PUBLIC_DOMAIN:'campus.up.railway.app'}),'https://campus.up.railway.app');
 assert.equal(resolveAppOrigin({NODE_ENV:'production',RAILWAY_PUBLIC_DOMAIN:'campus.up.railway.app',APP_ORIGIN:'https://college.example/'}),'https://college.example');
});
test('production rejects missing or insecure origin; local development keeps its origin',()=>{
 assert.throws(()=>resolveAppOrigin({NODE_ENV:'production'}));
 assert.throws(()=>resolveAppOrigin({NODE_ENV:'production',APP_ORIGIN:'http://college.example'}));
 assert.equal(resolveAppOrigin({}),'http://localhost:5173');
});

test('India calendar dates work after midnight while the server is still on the previous UTC day',()=>{
 const now=new Date('2026-11-14T20:00:00Z');
 assert.equal(collegeDate(now),'2026-11-15');
 assert.equal(isPastOrTodayDate(new Date('2026-11-15'),now),true);
 assert.equal(isPastOrTodayDate(new Date('2026-11-16'),now),false);
});
