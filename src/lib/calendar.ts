export const COLLEGE_TIME_ZONE='Asia/Kolkata';
export function today(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:COLLEGE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=(type:string)=>parts.find(p=>p.type===type)?.value||'';return `${value('year')}-${value('month')}-${value('day')}`}
export function academicYear(){const [year,month]=today().split('-').map(Number);const start=year-(month<7?1:0);return `${start}–${String(start+1).slice(-2)}`}
export function collegeWeekday(){return new Date(today()+'T12:00:00+05:30').getUTCDay()}
