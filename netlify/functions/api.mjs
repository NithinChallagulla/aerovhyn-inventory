import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
// Netlify bundles this function; import.meta.url may be unavailable in its runtime bundle.
// Netlify Functions run with the deployed site root as the working directory.
const root = process.cwd();
const COOKIE = "avhyn_session";
const SESSION_HOURS = 12;
const COLLECTIONS = ["assets","stock","movements","projects","procurement","maintenance","locations","activity","users","settings"];
const safeEqual = (a,b) => {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa,bb);
};
const b64 = value => Buffer.from(value).toString("base64url");
const sign = value => crypto.createHmac("sha256", process.env.AUTH_SECRET || "local-development-only-change-before-deploy").update(value).digest("base64url");
function parseCookies(header="") {
  return Object.fromEntries(header.split(";").map(x=>x.trim()).filter(Boolean).map(x=>{
    const i=x.indexOf("="); return [x.slice(0,i), decodeURIComponent(x.slice(i+1))];
  }));
}
function issueSession(user) {
  const payload = b64(JSON.stringify({sub:user.id,username:user.username,role:user.role,exp:Date.now()+SESSION_HOURS*3600000}));
  return `${payload}.${sign(payload)}`;
}
function verifySession(token) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try { const data=JSON.parse(Buffer.from(payload,"base64url").toString()); return data.exp>Date.now()?data:null; } catch { return null; }
}
async function readCollection(name) {
  if (!COLLECTIONS.includes(name)) throw new Error("Unknown collection");
  if (process.env.NETLIFY) {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("aerovhyn-inventory-v1");
    const value = await store.get(name, {type:"json"});
    if (value !== null) return value;
    const seed = await fs.readFile(path.join(root,"data",`${name}.json`),"utf8").then(JSON.parse).catch(()=>name==="settings"?{}:[]);
    await store.setJSON(name,seed);
    return seed;
  }
  const file = path.join(root,"data",`${name}.json`);
  try { return JSON.parse(await fs.readFile(file,"utf8")); }
  catch { const seed = name==="settings"?{}:[]; await fs.writeFile(file,JSON.stringify(seed,null,2)); return seed; }
}
async function writeCollection(name,value) {
  if (!COLLECTIONS.includes(name)) throw new Error("Unknown collection");
  if (process.env.NETLIFY) {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("aerovhyn-inventory-v1");
    await store.setJSON(name,value);
  } else {
    await fs.writeFile(path.join(root,"data",`${name}.json`),JSON.stringify(value,null,2)+"\n");
  }
}
function response(statusCode,data,extraHeaders={}) {
  return {statusCode,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS",...extraHeaders},body:JSON.stringify(data)};
}
const idFor = (prefix,items) => `${prefix}-${String(items.length+1).padStart(4,"0")}`;
const publicUser = u => ({id:u.id,username:u.username,displayName:u.displayName,role:u.role,active:u.active});
async function addActivity(user,action,entity,details="") {
  const rows=await readCollection("activity");
  rows.unshift({id:idFor("ACT",rows),at:new Date().toISOString(),username:user?.username||"system",action,entity,details});
  await writeCollection("activity",rows.slice(0,500));
}
export async function handler(event) {
  if (event.httpMethod==="OPTIONS") return response(204,{});
  const url = new URL(event.rawUrl || `https://local.invalid${event.path||"/"}`);
  const route = (event.queryStringParameters?.route || url.searchParams.get("route") || event.path || "").replace(/^\/api\/?/,"").replace(/^\/+/,"").replace(/\/+$/,"");
  let body={};
  try { if(event.body) body=JSON.parse(event.isBase64Encoded?Buffer.from(event.body,"base64").toString():event.body); }
  catch { return response(400,{error:"Invalid JSON request body"}); }

  try {
    if (route==="health" && event.httpMethod==="GET") return response(200,{ok:true,service:"Aerovhyn Inventory API",storage:process.env.NETLIFY?"netlify-blobs":"local-json"});
    if (route==="login" && event.httpMethod==="POST") {
      const users=await readCollection("users");
      const user=users.find(u=>u.username.toLowerCase()===String(body.username||"").trim().toLowerCase() && u.active!==false);
      if (!user || !safeEqual(user.password,String(body.password||""))) return response(401,{error:"Invalid username or password"});
      const token=issueSession(user);
      await addActivity(user,"LOGIN","Session","User signed in");
      const secure = process.env.NETLIFY ? "; Secure" : "";
      return response(200,{ok:true,user:publicUser(user)},{ "Set-Cookie":`${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${SESSION_HOURS*3600}` });
    }
    if (route==="logout" && event.httpMethod==="POST") {
      const secure = process.env.NETLIFY ? "; Secure" : "";
      return response(200,{ok:true},{ "Set-Cookie":`${COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0` });
    }
    const cookies=parseCookies(event.headers?.cookie||event.headers?.Cookie||"");
    const session=verifySession(cookies[COOKIE]);
    if (!session) return response(401,{error:"Authentication required. Please sign in again."});
    const users=await readCollection("users");
    const current=users.find(u=>u.id===session.sub && u.active!==false);
    if (!current) return response(401,{error:"Account is inactive or no longer exists"});
    if (route==="me" && event.httpMethod==="GET") return response(200,{user:publicUser(current)});
    if (route==="bootstrap" && event.httpMethod==="GET") {
      const names=["assets","stock","movements","projects","procurement","maintenance","locations","activity","settings"];
      const data={}; for(const name of names) data[name]=await readCollection(name);
      data.users=users.map(publicUser);
      return response(200,data);
    }
    if (route==="stock-movement" && event.httpMethod==="POST") {
      const stockRows=await readCollection("stock");
      const item=stockRows.find(x=>x.id===String(body.stockId||""));
      if(!item) return response(404,{error:"Stock item not found"});
      const type=String(body.type||"");
      const amount=Number(body.quantity);
      if(!["Inward","Outward","Return","Adjustment"].includes(type) || !Number.isFinite(amount) || amount<0 || (type!=="Adjustment" && amount<=0))
        return response(400,{error:"Enter a valid movement type and quantity"});
      const before=Number(item.quantity||0);
      let after=before;
      if(type==="Inward" || type==="Return") after=before+amount;
      if(type==="Outward") after=before-amount;
      if(type==="Adjustment") after=amount;
      if(after<0) return response(409,{error:`Insufficient stock. Available quantity: ${before}`});
      item.quantity=after;
      item.updatedAt=new Date().toISOString();
      await writeCollection("stock",stockRows);
      const movements=await readCollection("movements");
      const movement={id:idFor("MOV",movements),stockId:item.id,itemName:item.name,type,quantity:amount,beforeQuantity:before,afterQuantity:after,reference:body.reference||"",project:body.project||"",performedBy:current.username,notes:body.notes||"",createdAt:new Date().toISOString()};
      movements.unshift(movement);
      await writeCollection("movements",movements);
      await addActivity(current,"STOCK "+type.toUpperCase(),"Stock movement",`${item.name}: ${before} → ${after}`);
      return response(201,movement);
    }
    const [collection,id] = route.split("/");
    if (!COLLECTIONS.includes(collection) || ["users","activity","settings","movements"].includes(collection)) return response(404,{error:"API route not found"});
    const rows=await readCollection(collection);
    if (event.httpMethod==="GET" && id) {
      const row=rows.find(x=>x.id===decodeURIComponent(id));
      return row?response(200,row):response(404,{error:"Record not found"});
    }
    if (event.httpMethod==="GET") return response(200,rows);
    if (event.httpMethod==="POST") {
      const row={...body,id:body.id||idFor(collection.slice(0,3).toUpperCase(),rows),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      rows.unshift(row);
      await writeCollection(collection,rows);
      if(collection==="stock" && Number(row.quantity||0)>0) {
        const movements=await readCollection("movements");
        movements.unshift({id:idFor("MOV",movements),stockId:row.id,itemName:row.name,type:"Opening Balance",quantity:Number(row.quantity),beforeQuantity:0,afterQuantity:Number(row.quantity),reference:"Initial stock registration",project:"",performedBy:current.username,notes:"Opening quantity captured when stock item was created",createdAt:new Date().toISOString()});
        await writeCollection("movements",movements);
      }
      await addActivity(current,"CREATE",collection,row.id);
      return response(201,row);
    }
    if (event.httpMethod==="PUT" && id) {
      const index=rows.findIndex(x=>x.id===decodeURIComponent(id));
      if(index<0) return response(404,{error:"Record not found"});
      if(collection==="stock" && Object.prototype.hasOwnProperty.call(body,"quantity") && Number(body.quantity)!==Number(rows[index].quantity||0))
        return response(409,{error:"Change stock quantities through Stock movements so every change is recorded in the ledger."});
      rows[index]={...rows[index],...body,id:rows[index].id,updatedAt:new Date().toISOString()};
      await writeCollection(collection,rows); await addActivity(current,"UPDATE",collection,rows[index].id);
      return response(200,rows[index]);
    }
    if (event.httpMethod==="DELETE" && id) {
      const index=rows.findIndex(x=>x.id===decodeURIComponent(id));
      if(index<0) return response(404,{error:"Record not found"});
      const [removed]=rows.splice(index,1); await writeCollection(collection,rows); await addActivity(current,"DELETE",collection,removed.id);
      return response(200,{ok:true});
    }
    return response(405,{error:"Method not allowed"});
  } catch (error) {
    console.error("API error:",error);
    return response(500,{error:"Internal server error",detail:process.env.NODE_ENV==="development"?error.message:undefined});
  }
}
