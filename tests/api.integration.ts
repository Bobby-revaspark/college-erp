import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { configureDatabase } from '../server/database-config';
configureDatabase();
const base=process.env.TEST_API_URL||'http://localhost:3001';
const origin=process.env.APP_ORIGIN||'http://localhost:5173';
const db=new PrismaClient();
async function request(route:string,method='GET',body?:unknown,cookie=''){
 const r=await fetch(base+'/api'+route,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});
 const data=await r.json();return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]||''};
}
async function login(email:string,password=process.env.SEED_PASSWORD){const r=await request('/auth/login','POST',{email,password});assert.equal(r.status,200,JSON.stringify(r.data));return r.cookie;}
let studentId:string|undefined;let userId:string|undefined;
try{
 assert.equal((await request('/bootstrap')).status,401);
 const branding=await request('/institution');assert.equal(branding.status,200);assert.equal(typeof branding.data.name,'string');
 const admin=await login(process.env.ADMIN_EMAIL||'admin@campus.edu',process.env.ADMIN_PASSWORD||process.env.SEED_PASSWORD);
 const accountant=await login('accounts@campus.edu');
 const faculty=await login('ananya@campus.edu');
 const student=await login('student1@campus.edu');
 const own=await request('/bootstrap','GET',undefined,student);
 assert.equal(own.data.students.length,1);assert.equal(own.data.students[0].email,'student1@campus.edu');
 assert.ok(own.data.transactions.every((t:any)=>t.studentId===own.data.students[0].id));
 assert.equal((await request('/institution','PATCH',{},student)).status,403);
 for(const route of ['/students','/payments','/attendance','/timetables','/departments','/fee-structures'])assert.equal((await request(route,'POST',{},student)).status,403);
 assert.equal((await request('/students','POST',{},accountant)).status,403);
 assert.equal((await request('/payments','POST',{},faculty)).status,403);
 const f=await request('/bootstrap','GET',undefined,faculty);assert.equal(f.data.transactions.length,0);assert.ok(f.data.timetables.every((t:any)=>t.facultyId==='faculty-1'));
 assert.equal((await request('/attendance','POST',{date:'2026-11-01',subjectId:'sub-2',records:[{studentId:'student-1',status:'PRESENT'}]},faculty)).status,403);
 assert.equal((await request('/attendance','POST',{date:'2026-11-01',subjectId:'sub-1',records:[{studentId:'student-2',status:'PRESENT'}]},faculty)).status,400);
 const created=await request('/students','POST',{name:'Integration Student',email:`test-${randomUUID()}@example.edu`,phone:'9876543210',dob:'2006-01-01',gender:'Other',address:'Integration test address',guardianName:'Test Guardian',guardianPhone:'9876543211',departmentId:'dept-cse',courseId:'course-cse',semester:3,batch:'2025-2029',admissionDate:'2025-07-01',password:randomUUID()},admin);
 assert.equal(created.status,201,JSON.stringify(created.data));studentId=created.data.id;userId=created.data.userId;
 const attempts=[1,2].map(i=>({studentId,amount:60000,mode:'UPI',requestId:randomUUID(),transactionId:`TEST-${randomUUID()}-${i}`,date:'2026-11-01'}));
 const payments=await Promise.all(attempts.map(input=>request('/payments','POST',input,accountant)));
 assert.deepEqual(payments.map(p=>p.status).sort(),[201,400]);
 const total=await db.feeTransaction.aggregate({where:{studentId},_sum:{amount:true}});assert.equal(Number(total._sum.amount),60000);
 const accepted=payments.find(p=>p.status===201)!;
 assert.equal(accepted.data.balanceAfter,15000);
 const acceptedInput=attempts[payments.findIndex(p=>p.status===201)];
 const replay=await request('/payments','POST',acceptedInput,accountant);assert.equal(replay.status,201);assert.equal(replay.data.id,accepted.data.id);
 assert.equal(await db.feeTransaction.count({where:{studentId}}),1);
 assert.equal((await request('/payments','POST',{...acceptedInput,amount:59999},accountant)).status,409);
 const duplicate=await request('/payments','POST',{studentId,amount:1,mode:'UPI',transactionId:accepted.data.transactionId,date:'2026-11-01'},accountant);assert.equal(duplicate.status,409);
 const balance=await request('/bootstrap','GET',undefined,accountant);const record=balance.data.students.find((s:any)=>s.id===studentId);assert.equal(record.totalFee-record.paid,15000);
 assert.equal((await request('/payments','POST',{studentId,amount:1,mode:'UPI',date:'2026-11-01'},accountant)).status,400);
 const table={courseId:'course-cse',semester:3,subjectId:'sub-1',facultyId:'faculty-1',day:1,startTime:'09:30',endTime:'10:30',room:'201'};
 assert.equal((await request('/timetables','POST',table,admin)).status,409);
 const noOrigin=await fetch(base+'/api/payments',{method:'POST',headers:{'Content-Type':'application/json',Cookie:accountant},body:'{}'});assert.equal(noOrigin.status,403);
 assert.equal((await request('/auth/logout','POST',{},student)).status,200);
 assert.equal((await request('/bootstrap','GET',undefined,student)).status,401);
 for(const cookie of [admin,accountant,faculty])await request('/auth/logout','POST',{},cookie);
 console.log('PASS: authentication, all role write boundaries, student scoping, faculty scoping, roster validation, student registration, concurrent overpayment protection, duplicate references, balances, idempotent payment retries, historical receipt balance, public branding and admin-only branding writes, timetable conflict, CSRF origin and logout revocation.');
}finally{
 if(studentId){await db.feeTransaction.deleteMany({where:{studentId}});await db.student.delete({where:{id:studentId}});}
 if(userId)await db.user.delete({where:{id:userId}});
 await db.$disconnect();
}
