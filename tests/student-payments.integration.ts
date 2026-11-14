import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {configureDatabase} from '../server/database-config';
configureDatabase();const db=new PrismaClient();
const base=process.env.TEST_API_URL||'http://localhost:3001';const origin=process.env.APP_ORIGIN||'http://localhost:5173';
const cookies:string[]=[];let studentId:string|undefined,userId:string|undefined,subjectId:string|undefined,staffId:string|undefined;
async function request(route:string,method='GET',body?:unknown,cookie=''){
 const response=await fetch(base+'/api'+route,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};
}
async function login(email:string,password=process.env.SEED_PASSWORD){const result=await request('/auth/login','POST',{email,password});assert.equal(result.status,200,'Test login failed');cookies.push(result.cookie);return result.cookie;}
try{
 assert.equal((await request('/payment-requests')).status,401);
 const admin=await login(process.env.ADMIN_EMAIL||'admin@campus.edu',process.env.ADMIN_PASSWORD||process.env.SEED_PASSWORD);
 const accountant=await login('accounts@campus.edu');const faculty=await login('ananya@campus.edu');const otherStudent=await login('student1@campus.edu');
 const password=randomUUID();const email=`verify-${randomUUID()}@example.test`;
 const created=await request('/students','POST',{name:'Payment Verification Student',email,password,phone:'9876543210',dob:'2006-01-01',gender:'Other',address:'Temporary integration test',guardianName:'Verification Guardian',guardianPhone:'9876543211',departmentId:'dept-cse',courseId:'course-cse',semester:3,batch:'2025-2029',admissionDate:'2025-07-01'},admin);
 assert.equal(created.status,201,'Test student registration failed');studentId=created.data.id;userId=created.data.userId;
 const student=await login(email,password);
 const payload={requestId:randomUUID(),amount:500,mode:'UPI',transactionId:`VERIFY-${randomUUID()}`,date:'2026-11-01',studentNote:'Temporary automated fixture',proof:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII='};
 const submitted=await request('/payment-requests','POST',payload,student);assert.equal(submitted.status,201);assert.equal(submitted.data.status,'PENDING');assert.equal(submitted.data.studentId,studentId);
 assert.equal(await db.feeTransaction.count({where:{studentId}}),0);
 const replay=await request('/payment-requests','POST',payload,student);assert.equal(replay.status,200);assert.equal(replay.data.id,submitted.data.id);
 assert.equal((await request('/payment-requests','POST',{...payload,amount:501},student)).status,409);
 assert.equal((await request('/payment-requests/'+submitted.data.id,'GET',undefined,otherStudent)).status,403);
 assert.equal((await request('/payment-requests/'+submitted.data.id+'/review','POST',{action:'APPROVE',confirmedReceived:true},student)).status,403);
 assert.equal((await request('/payment-requests','GET',undefined,faculty)).status,403);
 assert.equal((await request('/payment-requests/'+submitted.data.id,'GET',undefined,faculty)).status,403);
 assert.equal((await request('/payment-requests/'+submitted.data.id+'/review','POST',{action:'APPROVE'},accountant)).status,400);
 const detail=await request('/payment-requests/'+submitted.data.id,'GET',undefined,accountant);assert.equal(detail.data.proof,payload.proof);
 const approved=await request('/payment-requests/'+submitted.data.id+'/review','POST',{action:'APPROVE',confirmedReceived:true},accountant);
 assert.equal(approved.status,200);assert.equal(approved.data.request.status,'APPROVED');assert.equal(approved.data.transaction.amount,500);assert.equal(approved.data.transaction.balanceAfter,74500);
 const repeated=await request('/payment-requests/'+submitted.data.id+'/review','POST',{action:'APPROVE',confirmedReceived:true},accountant);assert.equal(repeated.status,200);assert.equal(repeated.data.transaction.id,approved.data.transaction.id);assert.equal(await db.feeTransaction.count({where:{studentId}}),1);
 assert.equal((await request('/payment-requests/'+submitted.data.id+'/review','POST',{action:'REJECT',reviewNote:'invalid'},accountant)).status,409);
 assert.equal((await request('/payment-requests','POST',{...payload,requestId:randomUUID()},student)).status,409);
 const second=await request('/payment-requests','POST',{...payload,requestId:randomUUID(),amount:300,transactionId:`VERIFY-${randomUUID()}`},student);assert.equal(second.status,201);
 assert.equal((await request('/payment-requests/'+second.data.id+'/review','POST',{action:'REJECT'},accountant)).status,400);
 const rejected=await request('/payment-requests/'+second.data.id+'/review','POST',{action:'REJECT',reviewNote:'Could not match this transfer in the college account.'},accountant);assert.equal(rejected.data.request.status,'REJECTED');assert.equal(await db.feeTransaction.count({where:{studentId}}),1);
 const list=await request('/payment-requests','GET',undefined,student);assert.equal(list.data.requests.length,2);assert(list.data.requests.every((r:any)=>r.studentId===studentId&&!('proof' in r)));
 const live=await request('/bootstrap','GET',undefined,student);assert.equal(live.data.students[0].paid,500);assert.equal(live.data.paymentRequests.length,2);
 const branding=await request('/institution');assert.equal(branding.status,200);assert(!('paymentBankDetails' in branding.data));
 assert.equal((await request('/staff','POST',{},accountant)).status,403);
 const staff=await request('/staff','POST',{name:'Temporary Faculty',email:`staff-${randomUUID()}@example.test`,password:randomUUID(),role:'FACULTY'},admin);assert.equal(staff.status,201);staffId=staff.data.id;assert(!('passwordHash' in staff.data));
 const subject=await request('/subjects','POST',{name:'Temporary Test Subject',code:'VERIFY-'+randomUUID().slice(0,8),courseId:'course-cse',semester:3},admin);assert.equal(subject.status,201);subjectId=subject.data.id;
 console.log('PASS: student payment submission, pending ledger isolation, own-data scoping, proof access, staff-only approval, received confirmation, idempotent approval, rejection, duplicate references, dynamic bootstrap, public branding privacy and academic staff/subject setup.');
}finally{
 for(const cookie of cookies)await request('/auth/logout','POST',{},cookie).catch(()=>{});
 if(studentId){await db.studentPaymentRequest.deleteMany({where:{studentId}});await db.feeTransaction.deleteMany({where:{studentId}});await db.student.delete({where:{id:studentId}});}
 if(userId)await db.user.delete({where:{id:userId}});
 if(subjectId)await db.subject.delete({where:{id:subjectId}});
 if(staffId)await db.user.delete({where:{id:staffId}});
 await db.$disconnect();
}
