import mariadb from 'mariadb';
import {seed} from '../Models/lib.js';
if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME)throw Error('Set DB_USER, DB_PASSWORD, DB_NAME');
if(process.env.ALLOW_DEMO_SEED!=='YES')throw Error('This inserts demo data. Set ALLOW_DEMO_SEED=YES after reviewing DB_NAME');
const conn=await mariadb.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
try {await conn.execute('INSERT INTO pilot_state (id,state_json) VALUES (1,?)',[JSON.stringify(seed())]);console.log('Demo state inserted into',process.env.DB_NAME);}finally{await conn.end();}
