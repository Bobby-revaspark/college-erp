import app, { db } from './app.js';
const server=app.listen(Number(process.env.PORT||3001),'0.0.0.0',()=>console.log('Campus API listening'));
process.on('SIGTERM',()=>server.close(()=>{void db.$disconnect();}));
