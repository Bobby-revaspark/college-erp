import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const db=new PrismaClient();
async function main(){
 const password=process.env.SEED_PASSWORD;
 if(!password||password.length<12)throw new Error('Set SEED_PASSWORD to a password of at least 12 characters');
 const passwordHash=await bcrypt.hash(password,12);
 const staff=[['admin','Dr. Meera Sharma','admin@campus.edu','ADMIN'],['accountant','Rajesh Kumar','accounts@campus.edu','ACCOUNTANT'],['faculty-1','Dr. Ananya Rao','ananya@campus.edu','FACULTY'],['faculty-2','Prof. Vikram Singh','vikram@campus.edu','FACULTY']] as const;
 for(const [id,name,email,role] of staff)await db.user.upsert({where:{id},update:{},create:{id,name,email,role,passwordHash}});
 const departments=[['dept-cse','Computer Science','CSE','course-cse','B.Tech Computer Science'],['dept-commerce','Commerce','COM','course-commerce','B.Com Accounting'],['dept-business','Business Administration','BBA','course-business','BBA Management']] as const;
 for(const [id,name,code,courseId,courseName] of departments){
 await db.department.upsert({where:{id},update:{},create:{id,name,code}});
 await db.course.upsert({where:{id:courseId},update:{},create:{id:courseId,name:courseName,departmentId:id}});
 for(let semester=1;semester<=8;semester++)await db.feeStructure.upsert({where:{courseId_semester:{courseId,semester}},update:{},create:{courseId,semester,tuition:60000,exam:5000,library:2000,lab:8000}});
 }
 const subjects=[['sub-1','Data Structures','CS201','course-cse'],['sub-2','Database Management','CS202','course-cse'],['sub-3','Financial Accounting','COM201','course-commerce'],['sub-4','Business Economics','BBA201','course-business']] as const;
 for(const [id,name,code,courseId]of subjects)await db.subject.upsert({where:{id},update:{},create:{id,name,code,courseId,semester:3}});
 const names=['Aarav Patel','Diya Sharma','Arjun Mehta','Ananya Gupta','Rohan Verma','Ishita Singh','Kabir Shah','Saanvi Joshi','Aditya Kumar','Meera Nair'];
 for(let i=0;i<names.length;i++){
 const id=`student-${i+1}`;const email=`student${i+1}@campus.edu`;const dept=departments[i%3];
 await db.user.upsert({where:{id:`user-${id}`},update:{},create:{id:`user-${id}`,name:names[i],email,passwordHash,role:'STUDENT'}});
 await db.student.upsert({where:{id},update:{},create:{id,userId:`user-${id}`,enrollment:`ERP2026${String(i+1).padStart(4,'0')}`,name:names[i],email,phone:`98765000${String(i).padStart(2,'0')}`,dob:new Date('2006-05-12'),gender:i%2?'Female':'Male',address:`${i+10}, College Road, Bengaluru`,guardianName:`Guardian of ${names[i]}`,guardianPhone:`98766000${String(i).padStart(2,'0')}`,departmentId:dept[0],courseId:dept[3],semester:3,batch:'2025–2029',admissionDate:new Date('2025-07-01'),totalFee:75000}});
 if(i!==8)await db.feeTransaction.upsert({where:{id:`payment-${i}`},update:{},create:{id:`payment-${i}`,receiptNumber:`RCP-2026-${String(i+1).padStart(4,'0')}`,studentId:id,amount:i%3===0?75000:35000,mode:i%2?'UPI':'BANK_TRANSFER',transactionId:`SEED-TXN-${i}`,date:new Date(Date.UTC(2026,6+i%5,5+i)),recordedById:'accountant'}});
 const subject=subjects[i%3===0?0:i%3===1?2:3];
 for(let d=1;d<=12;d++)await db.attendance.upsert({where:{studentId_subjectId_date:{studentId:id,subjectId:subject[0],date:new Date(Date.UTC(2026,10,d))}},update:{},create:{studentId:id,subjectId:subject[0],date:new Date(Date.UTC(2026,10,d)),status:(d+i)%5===0?'ABSENT':(d+i)%7===0?'LATE':'PRESENT'}});
 }
 for(let day=1;day<=6;day++)for(let i=0;i<subjects.length;i++){
 const s=subjects[i];await db.timetable.upsert({where:{id:`slot-${day}-${i}`},update:{},create:{id:`slot-${day}-${i}`,courseId:s[3],semester:3,subjectId:s[0],facultyId:i%2?'faculty-2':'faculty-1',day,startTime:`${String(9+i).padStart(2,'0')}:00`,endTime:`${String(10+i).padStart(2,'0')}:00`,room:`${201+i}`}});
 }
 console.log('Seed complete: admin@campus.edu, accounts@campus.edu, ananya@campus.edu, vikram@campus.edu, student1@campus.edu … student10@campus.edu. Password: configured SEED_PASSWORD. Existing records preserved.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
