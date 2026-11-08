// Trusted provisioning only. Never expose this operation in the public UI or API.
const crypto=require('crypto'); const Database=require('better-sqlite3'); const path=require('path');
const [email,name,password]=process.argv.slice(2);
if(!process.env.BOOTSTRAP_ADMIN_SECRET||!email||!name||!password||password.length<12){console.error('Set BOOTSTRAP_ADMIN_SECRET and provide email, name, and a 12+ character password.');process.exit(1);}
const salt=crypto.randomBytes(16).toString('hex'),hash=crypto.scryptSync(password,salt,64).toString('hex'),db=new Database(path.join(__dirname,'fieldlink.db'));
try{db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(),name,email.trim().toLowerCase(),`${salt}:${hash}`,'admin',null,new Date().toISOString());console.log('Administrator created through trusted local provisioning.');}catch{console.error('Could not create account: email may already exist.');process.exit(1);}
