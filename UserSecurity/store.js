function deserialize(text){return typeof text==='string'?JSON.parse(text):text;}
export async function mutateSecurityInTransaction(conn,work,{missingTableAllowed=false}={}){
 let row;
 try{[row]=await conn.query('SELECT state_json FROM bci_user_security WHERE id=1 FOR UPDATE');}
 catch(error){if(missingTableAllowed&&error.code==='ER_NO_SUCH_TABLE')return;throw error;}
 if(!row){if(missingTableAllowed)return;throw Error('User Security storage unavailable');}
 const state=deserialize(row.state_json);
 const result=await work(state);
 await conn.query('UPDATE bci_user_security SET state_json=? WHERE id=1',[JSON.stringify(state)]);
 return result;
}
export async function makeSecurityStore(pool){
 if(!pool)throw Error('User Security requires MariaDB');
 const [first]=await pool.query('SELECT id FROM bci_user_security WHERE id=1');
 if(!first)throw Error('Run the User Security migration before enabling it');
 return {
  async read(){
   const [row]=await pool.query('SELECT state_json FROM bci_user_security WHERE id=1');
   if(!row)throw Error('User Security storage unavailable');
   return deserialize(row.state_json);
  },
  async transact(work){
   const conn=await pool.getConnection();
   try{
    await conn.beginTransaction();
    const result=await mutateSecurityInTransaction(conn,work);
    await conn.commit();
    return result;
   }catch(error){await conn.rollback();throw error;}
   finally{conn.release();}
  }
 };
}
