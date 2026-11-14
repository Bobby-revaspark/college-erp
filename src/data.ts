import { defaultInstitution, type Institution } from './institution';
export type Role = 'ADMIN' | 'ACCOUNTANT' | 'FACULTY' | 'STUDENT';
export type Entity = {
    id: string;
    [key: string]: any;
};
export type Data = {
    institution?: Institution;
    paymentRequests?: Entity[];
    users?: Entity[];
    students: Entity[];
    departments: Entity[];
    courses: Entity[];
    feeStructures: Entity[];
    transactions: Entity[];
    attendance: Entity[];
    timetables: Entity[];
    subjects: Entity[];
    faculty: Entity[];
};
export { today } from './lib/calendar';
export function seedData(): Data {
    const departments = [{ id: 'd1', name: 'Computer Science', code: 'CSE' }, { id: 'd2', name: 'Business & Commerce', code: 'COM' }, { id: 'd3', name: 'Engineering', code: 'ENG' }, { id: 'd4', name: 'Arts & Humanities', code: 'ART' }];
    const courses = departments.map((d, i) => ({ id: 'c' + (i + 1), name: ['B.Tech Computer Science', 'Bachelor of Commerce', 'B.Tech Mechanical', 'Bachelor of Arts'][i], departmentId: d.id }));
    const names = ['Aarav Sharma', 'Diya Patel', 'Arjun Mehta', 'Ananya Singh', 'Rohan Gupta', 'Ishita Rao', 'Kabir Verma', 'Meera Nair', 'Aditya Joshi', 'Sana Khan'];
    const students = names.map((name, i) => ({ id: 's' + (i + 1), name, enrollment: 'CP2026' + String(i + 1).padStart(3, '0'), email: name.toLowerCase().replace(' ', '.') + '@student.campus.edu', phone: '98765432' + String(i).padStart(2, '0'), departmentId: 'd' + (i % 4 + 1), courseId: 'c' + (i % 4 + 1), semester: 3, batch: '2025–2029', admissionDate: '2025-07-10', dob: '2006-05-14', gender: i % 2 ? 'Female' : 'Male', address: 'Bengaluru, Karnataka', guardianName: name.split(' ')[1] + ' Family', guardianPhone: '9876543210', totalFee: 85000, paid: [65000, 65000, 45000, 85000, 60000, 40000, 85000, 75000, 30000, 85000][i] }));
    const subjects = courses.flatMap((c, i) => [{ id: 'sub' + (i * 2 + 1), name: ['Data Structures', 'Financial Accounting', 'Applied Mechanics', 'Modern Literature'][i], code: ['CS201', 'BC201', 'ME201', 'BA201'][i], courseId: c.id, semester: 3 }, { id: 'sub' + (i * 2 + 2), name: ['Database Systems', 'Business Economics', 'Thermodynamics', 'Political Science'][i], code: ['CS202', 'BC202', 'ME202', 'BA202'][i], courseId: c.id, semester: 3 }]);
    const transactions = students.flatMap((s, i) => [{ id: 't' + i, receiptNumber: 'RCP-2026-' + String(i + 1).padStart(4, '0'), studentId: s.id, amount: s.paid, balanceAfter: s.totalFee - s.paid, mode: ['UPI', 'BANK_TRANSFER', 'CARD', 'CASH'][i % 4], date: new Date(Date.now() - i * 86400000).toISOString(), transactionId: 'TXN26' + i }]);
    const attendance = students.flatMap((s, i) => Array.from({ length: 20 }, (_, j) => ({ id: `a${i}-${j}`, studentId: s.id, subjectId: subjects.find(x => x.courseId === s.courseId)!.id, date: new Date(Date.now() - j * 86400000).toISOString().slice(0, 10), status: (i + j) % 7 === 0 ? 'ABSENT' : (i + j) % 9 === 0 ? 'LATE' : 'PRESENT' })));
    const faculty = [{ id: 'f1', name: 'Dr. Priya Menon' }, { id: 'f2', name: 'Prof. Vikram Rao' }];
    const timetables = Array.from({ length: 18 }, (_, i) => ({ id: 'tt' + i, courseId: 'c' + (i % 4 + 1), semester: 3, subjectId: subjects[(i % 4) * 2 + (i % 2)].id, facultyId: faculty[i % 2].id, day: i % 6 + 1, startTime: ['09:00', '10:00', '11:15'][Math.floor(i / 6)], endTime: ['09:50', '10:50', '12:05'][Math.floor(i / 6)], room: 'B-' + (201 + i % 4) }));
    return { institution: defaultInstitution(), departments, courses, students, subjects, transactions, attendance, timetables, faculty, feeStructures: courses.map((c, i) => ({ id: 'fs' + i, courseId: c.id, semester: 3, tuition: 70000, exam: 5000, library: 3000, lab: 7000 })) };
}
