const domain=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
function isAddress(value){
 if(typeof value!=='string'||value.length>254)return false;
 const [local,host,...rest]=value.split('@');
 return rest.length===0&&typeof host==='string'&&domain.test(host)&&local.length<=64&&
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i.test(local);
}
export async function createEmailChannel(env=process.env,{createTransport}={}){
 const host=env.BCI_EMAIL_SMTP_HOST;
 const port=env.BCI_EMAIL_SMTP_PORT;
 const user=env.BCI_EMAIL_SMTP_USER;
 const pass=env.BCI_EMAIL_SMTP_PASSWORD;
 const from=env.BCI_EMAIL_FROM;
 if(typeof host!=='string'||!domain.test(host)||!['465','587'].includes(port)||
    typeof user!=='string'||!user.trim()||typeof pass!=='string'||!pass.trim()||!isAddress(from)){
  throw Error('Email sign-in delivery is not configured.');
 }
 if(!createTransport){
  try{const {default:mailer}=await import('nodemailer');createTransport=options=>mailer.createTransport(options);}
  catch{throw Error('Email sign-in delivery is not configured.');}
 }
 let transport;
 try{
  transport=createTransport({host,port:Number(port),secure:port==='465',requireTLS:port==='587',ignoreTLS:false,
   auth:{user,pass},tls:{servername:host,rejectUnauthorized:true,minVersion:'TLSv1.2'},
   connectionTimeout:5000,greetingTimeout:5000,socketTimeout:12000,dnsTimeout:5000,
   logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
 }catch{throw Error('Email sign-in delivery is not configured.');}
 return Object.freeze({
  // identity MUST come from the authenticated Cloudflare assertion, never POST data.
  async sendCode(identity,code){
   const email=identity?.email;
   if(!isAddress(email)||typeof code!=='string'||!/^\d{6}$/.test(code))throw Error('Unable to deliver a sign-in code.');
   try{
    const result=await transport.sendMail({from:{name:'BCI Operations',address:from},to:{address:email},
     envelope:{from,to:[email]},subject:'Your BCI Operations sign-in code',
     text:'Your BCI Operations sign-in code is '+code+'.\n\nEnter it in BCI Operations. Do not share this code. If you did not request it, disregard this message.'});
    if(result.accepted?.length!==1||String(result.accepted[0]).toLowerCase()!==email.toLowerCase())throw Error();
   }catch{throw Error('Unable to deliver a sign-in code.');}
  }
 });
}
