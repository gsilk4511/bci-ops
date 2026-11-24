import mariadb from 'mariadb';
import {makeSecurityStore} from '../UserSecurity/store.js';
import {resetAuthenticator,securityConfig} from '../UserSecurity/enrollment.js';

const [email,typed]=process.argv.slice(2);
if(process.argv.length!==4||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||'')||typed!=='RESET '+email||email.trim().toLowerCase()!==email)
 throw Error('Usage: node scripts/reset-user-authenticator.js user@example.org "RESET user@example.org"');
if(process.env.DB_PROVIDER!=='mariadb')throw Error('Trusted MariaDB host access is required');
for(const name of ['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME'])if(!process.env[name])throw Error('Missing '+name);
const config=securityConfig(process.env);
if(config.mode!=='optional')throw Error('Select optional mode first; never reset a live required deployment in place');
const pool=mariadb.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,connectionLimit:1});
try{
 const store=await makeSecurityStore(pool);
 await store.transact(state=>resetAuthenticator(state,config,email));
 console.log('MFA reset recorded; a new verified invitation and enrollment are required.');
}catch(error){
 console.error(error.sqlState?'MariaDB operation failed':error.message);
 process.exitCode=1;
}finally{await pool.end();}
