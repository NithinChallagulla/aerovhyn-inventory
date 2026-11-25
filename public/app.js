const $ = s => document.querySelector(s);
const state = { user:null, data:{}, page:"dashboard", editing:null, toastTimer:null };
const config = {
  assets:{title:"Fixed assets",subtitle:"Register and track individually identifiable company property.",prefix:"AST",fields:[
    ["name","Asset name","text",true],["category","Category","select",true,["IT & Office","Drone Hardware","RF & Communication","Tools & Equipment","Electronics","Other"]],["model","Make / model","text"],["serialNumber","Serial number","text"],["purchaseDate","Purchase date","date"],["purchaseCost","Purchase cost (₹)","number"],["vendor","Vendor","text"],["warrantyExpiry","Warranty expiry","date"],["location","Location / bin","text"],["assignedTo","Assigned to","text"],["projectId","Project","text"],["condition","Condition","select",false,["New","Good","Needs repair","Damaged","Retired"]],["notes","Notes","textarea"]]},
  stock:{title:"Consumable stock",subtitle:"Track quantities, reorder levels, stock inward and outward.",prefix:"STK",fields:[
    ["name","Item name","text",true],["sku","SKU / part number","text"],["category","Category","select",true,["Electronic Components","Drone Hardware","RF & Communication","Fasteners & Cables","Packaging","Office Supplies","Other"]],["unit","Unit","select",true,["pcs","set","meter","kg","box","roll","liter"]],["quantity","Available quantity","number",true],["reorderLevel","Reorder level","number"],["unitCost","Unit cost (₹)","number"],["location","Bin / location","text"],["vendor","Preferred vendor","text"],["notes","Notes","textarea"]]},
  movements:{title:"Stock movements",subtitle:"A traceable ledger of every inward, outward, return and adjustment.",prefix:"MOV",fields:[
    ["stockId","Stock item ID","select",true,[]],["type","Movement type","select",true,["Inward","Outward","Return","Adjustment"]],["quantity","Quantity / counted quantity","number",true],["reference","Reference / challan / invoice","text"],["project","Project / allocation reference","text"],["notes","Notes","textarea"]]},
  locations:{title:"Locations & bins",subtitle:"Map office, racks, shelves, cabinets and numbered storage bins.",prefix:"LOC",fields:[
    ["name","Location name / bin number","text",true],["type","Location type","select",true,["Site","Room","Rack","Shelf","Cabinet","Bin","Drawer","Other"]],["parentId","Parent location ID","text"],["capacity","Capacity / description","text"],["notes","Notes","textarea"]]},
  projects:{title:"Projects",subtitle:"Track company projects and allocate assets or stock.",prefix:"PRJ",fields:[
    ["name","Project name","text",true],["code","Project code","text"],["owner","Project owner","text"],["status","Status","select",true,["Planning","Active","On hold","Completed","Cancelled"]],["startDate","Start date","date"],["endDate","Target end date","date"],["notes","Notes","textarea"]]},
  procurement:{title:"Procurement",subtitle:"Purchase orders, vendors, invoices and warranty records.",prefix:"PO",fields:[
    ["poNumber","PO number","text"],["vendor","Vendor name","text",true],["description","Purchase description","text",true],["orderDate","Order date","date"],["amount","Total amount (₹)","number"],["invoiceNumber","Invoice number","text"],["invoiceFile","Invoice file name / reference","text"],["paymentStatus","Payment status","select",false,["Pending","Partially paid","Paid"]],["warrantyExpiry","Warranty expiry","date"],["status","Order status","select",false,["Requested","Ordered","Received","Cancelled"]],["notes","Notes","textarea"]]},
  maintenance:{title:"Maintenance",subtitle:"Schedule maintenance tasks, repairs, servicing and calibration.",prefix:"MNT",fields:[
    ["title","Task / equipment","text",true],["assetId","Asset ID","text"],["taskType","Task type","select",true,["Preventive","Corrective repair","Calibration","Inspection","Battery health","Other"]],["priority","Priority","select",true,["Low","Medium","High","Critical"]],["dueDate","Due date","date"],["assignedTo","Assigned to","text"],["status","Status","select",true,["Open","In progress","Completed","Overdue","Cancelled"]],["recurrence","Recurrence","select",false,["None","Weekly","Monthly","Quarterly","Half-yearly","Yearly"]],["cost","Estimated / actual cost (₹)","number"],["notes","Work notes","textarea"]]}
};
const titles={dashboard:"Overview",assets:"Fixed assets",stock:"Consumable stock",movements:"Stock movements",locations:"Locations & bins",projects:"Projects",procurement:"Procurement",maintenance:"Maintenance",activity:"Audit activity",users:"Users"};
async function api(route,options={}) {
  const res=await fetch(`/api/${route}`,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data=await res.json().catch(()=>({error:"Unexpected server response"}));
  if(!res.ok) throw new Error(data.error||`Request failed (${res.status})`);
  return data;
}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove("show"),2800)}
function esc(value=""){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(v){return "₹"+Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
function date(v){if(!v)return "—";const d=new Date(v);return isNaN(d)?"—":d.toLocaleDateString("en-IN")}
function tag(value){const s=String(value||"—");const cls=/completed|paid|good|received|active/i.test(s)?"good":/overdue|critical|damaged|cancelled|retired/i.test(s)?"bad":/pending|high|in progress|needs repair|on hold/i.test(s)?"warn":"";return `<span class="tag ${cls}">${esc(s)}</span>`}
function setUser(user){state.user=user;$("#userName").textContent=user.displayName||user.username;$("#userRole").textContent=user.role;$("#userAvatar").textContent=(user.displayName||user.username).slice(0,1).toUpperCase()}
async function login(e){e.preventDefault();$("#loginError").textContent="";const btn=$("#loginForm button");btn.disabled=true;btn.textContent="Signing in…";try{const result=await api("login",{method:"POST",body:JSON.stringify({username:$("#username").value,password:$("#password").value})});setUser(result.user);await loadData();showApp();toast("Welcome to Aerovhyn Inventory")}catch(err){$("#loginError").textContent=err.message}finally{btn.disabled=false;btn.innerHTML='Sign in <span>→</span>'}}
function showApp(){$("#loginView").classList.add("hidden");$("#appView").classList.remove("hidden");renderPage()}
function showLogin(){$("#appView").classList.add("hidden");$("#loginView").classList.remove("hidden")}
async function loadData(){state.data=await api("bootstrap")}
async function logout(){try{await api("logout",{method:"POST",body:"{}"})}catch{}state.user=null;showLogin()}
function go(page){state.page=page;$("#sidebar").classList.remove("open");document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));renderPage()}
function pageHead(title,subtitle,button=""){return `<div class="page-head"><div><h3>${title}</h3><p>${subtitle}</p></div><div class="head-actions">${button}</div></div>`}
function stat(label,value,note,icon){return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`}
function renderDashboard(){
 const assets=state.data.assets||[],stock=state.data.stock||[],maintenance=state.data.maintenance||[],projects=state.data.projects||[];
 const low=stock.filter(x=>Number(x.quantity||0)<=Number(x.reorderLevel||0)).length;
 const open=maintenance.filter(x=>!["Completed","Cancelled"].includes(x.status)).length;
 const value=assets.reduce((s,x)=>s+Number(x.purchaseCost||0),0)+stock.reduce((s,x)=>s+Number(x.quantity||0)*Number(x.unitCost||0),0);
 const activity=(state.data.activity||[]).slice(0,7);
 return `${pageHead("Company overview","A live view of Aerovhyn's physical assets, inventory and operations.")}
 <div class="stats-grid">${stat("Registered assets",assets.length,"Individually tracked property","▣")}${stat("Stock line items",stock.length,"Consumable inventory records","▤")}${stat("Low-stock alerts",low,low?"Items at or below reorder level":"No items below reorder level","!")}${stat("Open maintenance",open,"Tasks requiring attention","⚙")}</div>
 <div class="dashboard-grid"><section class="panel"><div class="panel-head"><h3>Quick actions</h3><small>COMMON WORKFLOWS</small></div><div class="quick-grid"><button class="quick-link" data-new="assets"><b>＋ Register an asset</b><small>Add a laptop, drone, tool or equipment</small></button><button class="quick-link" data-new="stock"><b>＋ Add stock item</b><small>Create a new SKU and opening quantity</small></button><button class="quick-link" data-new="maintenance"><b>＋ Schedule maintenance</b><small>Create a service or inspection task</small></button><button class="quick-link" data-new="procurement"><b>＋ Record purchase</b><small>Register PO, vendor and invoice details</small></button></div><div class="panel-head" style="margin-top:25px"><h3>Inventory valuation</h3><small>RECORDED PURCHASE COST</small></div><div class="stat-value">${money(value)}</div><div class="stat-note">Assets purchase cost + available stock value</div></section>
 <section class="panel"><div class="panel-head"><h3>Recent activity</h3><small>LAST 7 EVENTS</small></div><div class="activity-list">${activity.length?activity.map(a=>`<div class="activity-row"><i class="activity-bullet"></i><div><b>${esc(a.action)} · ${esc(a.entity)}</b><small>${esc(a.username)} · ${date(a.at)} ${esc(a.details||"")}</small></div></div>`).join(""):`<div class="empty">No activity recorded yet.</div>`}</div></section></div>`;
}
function renderTable(page){
 const rows=state.data[page]||[],cfg=config[page];
 const cols=page==="assets"?[["id","Asset ID"],["name","Asset"],["category","Category"],["serialNumber","Serial no."],["location","Location"],["condition","Condition"]]:
 page==="stock"?[["id","SKU ID"],["name","Item"],["sku","Part no."],["quantity","Available"],["unit","Unit"],["reorderLevel","Reorder at"],["location","Location"]]:
 page==="movements"?[["id","Movement ID"],["itemName","Item"],["type","Movement"],["quantity","Qty"],["beforeQuantity","Before"],["afterQuantity","After"],["reference","Reference"],["performedBy","By"],["createdAt","Date"]]:
 page==="locations"?[["id","Location ID"],["name","Location / bin"],["type","Type"],["parentId","Parent"],["capacity","Description"]]:
 page==="projects"?[["id","Project ID"],["name","Project"],["code","Code"],["owner","Owner"],["status","Status"],["startDate","Start date"]]:
 page==="procurement"?[["id","Record ID"],["poNumber","PO number"],["vendor","Vendor"],["description","Description"],["amount","Amount"],["paymentStatus","Payment"],["status","Status"]]:
 [["id","Task ID"],["title","Task"],["assetId","Asset ID"],["taskType","Type"],["priority","Priority"],["dueDate","Due date"],["assignedTo","Assigned to"],["status","Status"]];
 return `${pageHead(cfg.title,cfg.subtitle,`${page==="stock"?`<button class="secondary" data-page="movements">View movement ledger</button>`:""}<button class="primary" data-new="${page}">＋ Add ${page==="assets"?"asset":page==="stock"?"stock item":page==="locations"?"location":page==="projects"?"project":page==="procurement"?"purchase":page==="movements"?"movement":"task"}</button>`)}
 <section class="table-panel"><div class="table-toolbar"><input class="search" id="tableSearch" placeholder="Search ${cfg.title.toLowerCase()}…"><span class="muted">${rows.length} records</span></div><div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join("")}<th>Actions</th></tr></thead><tbody id="tableBody">${rows.length?rows.map(row=>`<tr data-row="${esc(row.id)}">${cols.map(c=>`<td>${c[0]==="condition"||c[0]==="status"||c[0]==="priority"?tag(row[c[0]]):c[0]==="amount"?money(row[c[0]]):c[0].toLowerCase().includes("date")?date(row[c[0]]):esc(row[c[0]]||"—")}</td>`).join("")}<td>${page==="movements"?'<span class="tag">Ledger</span>':`<div class="row-actions"><button class="mini-btn" data-edit="${esc(row.id)}">Edit</button><button class="mini-btn" data-delete="${esc(row.id)}">Delete</button></div>`}</td></tr>`).join(""):`<tr><td colspan="${cols.length+1}"><div class="empty">No records yet. Use “Add” to create your first record.</div></td></tr>`}</tbody></table></div></section>`;
}
function renderMovements(){
 const rows=state.data.movements||[];
 const body=renderTable("movements");
 return body.replace(
   `<button class="primary" data-new="movements">＋ Add movement</button>`,
   `<button class="primary" data-new="movements">＋ Record movement</button>`
 );
}
function renderMaintenance(){
 const rows=state.data.maintenance||[];
 return `${pageHead("Maintenance","Plan recurring tasks, inspections, repairs and calibration.",`<button class="primary" data-new="maintenance">＋ Schedule task</button>`)}
 <div class="stats-grid">${stat("Total tasks",rows.length,"All maintenance records","⚙")}${stat("Open",rows.filter(x=>x.status==="Open").length,"Awaiting work","○")}${stat("In progress",rows.filter(x=>x.status==="In progress").length,"Currently being worked on","◷")}${stat("Completed",rows.filter(x=>x.status==="Completed").length,"Closed tasks","✓")}</div>
 <section class="panel"><div class="panel-head"><h3>Maintenance schedule</h3><small>${rows.length} TASKS</small></div>${rows.length?rows.map(x=>`<div class="maintenance-card"><div style="display:flex;justify-content:space-between;gap:12px"><b>${esc(x.title)}</b>${tag(x.status)}</div><p>${esc(x.taskType)} · ${esc(x.assetId||"No asset linked")} · Due ${date(x.dueDate)}</p><div class="maintenance-meta">${tag(x.priority)}<span class="tag">Assigned: ${esc(x.assignedTo||"Unassigned")}</span><span class="tag">ID: ${esc(x.id)}</span></div><div class="row-actions" style="margin-top:12px"><button class="mini-btn" data-edit="${esc(x.id)}" data-edit-page="maintenance">Edit task</button><button class="mini-btn" data-delete="${esc(x.id)}" data-delete-page="maintenance">Delete</button></div></div>`).join(""):`<div class="empty">No maintenance tasks scheduled.</div>`}</section>`;
}
function renderActivity(){
 const rows=state.data.activity||[];
 return `${pageHead("Audit activity","A chronological record of actions performed in the system.")}<section class="panel"><div class="activity-list">${rows.length?rows.map(a=>`<div class="activity-row"><i class="activity-bullet"></i><div><b>${esc(a.action)} · ${esc(a.entity)} · ${esc(a.details||"")}</b><small>${esc(a.username)} · ${new Date(a.at).toLocaleString("en-IN")}</small></div></div>`).join(""):`<div class="empty">No activity yet.</div>`}</div></section>`;
}
function renderUsers(){
 const users=state.data.users||[];
 return `${pageHead("User access","Initial accounts are managed from data/users.json during local development. User administration UI will be enabled after role policy is finalized.")}<section class="table-panel"><div class="table-wrap"><table><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.username)}</td><td>${esc(u.displayName)}</td><td>${tag(u.role)}</td><td>${tag(u.active?"Active":"Inactive")}</td></tr>`).join("")}</tbody></table></div></section>`;
}
function renderPage(){
 $("#pageTitle").textContent=titles[state.page]||"Overview";$("#pageCrumb").textContent=titles[state.page]||"Overview";
 const root=$("#pageContent");
 root.innerHTML=state.page==="dashboard"?renderDashboard():state.page==="activity"?renderActivity():state.page==="users"?renderUsers():state.page==="maintenance"?renderMaintenance():state.page==="movements"?renderMovements():renderTable(state.page);
}
function openDialog(page,id=null){
 const cfg=config[page];if(!cfg)return;
 const row=id?(state.data[page]||[]).find(x=>x.id===id):{};
 state.editing={page,id};$("#dialogTitle").textContent=id?`Edit ${cfg.title.slice(0,-1)}`:`Add ${cfg.title.slice(0,-1)}`;$("#dialogEyebrow").textContent=id?`EDIT ${id}`:`NEW ${page.toUpperCase()}`;
 $("#dialogFields").innerHTML=cfg.fields.map(([key,label,type,required,options])=>{
   const value=row?.[key]??"";
   let control=type==="select"?`<select name="${key}" ${required?"required":""}><option value="">Select…</option>${(options||[]).map(o=>`<option ${value===o?"selected":""}>${esc(o)}</option>`).join("")}</select>`:type==="textarea"?`<textarea name="${key}" rows="3">${esc(value)}</textarea>`:`<input name="${key}" type="${type}" value="${esc(value)}" ${required?"required":""} ${type==="number"?'step="any"':''}>`;
   return `<label class="field ${type==="textarea"?"full-width":""}">${label}${control}</label>`;
 }).join("");
 $("#recordDialog").showModal();
}
async function saveRecord(e){
 e.preventDefault();const {page,id}=state.editing||{};if(!page)return;
 const form=new FormData($("#recordForm"));const body=Object.fromEntries(form.entries());
 for(const [k,v] of Object.entries(body)) if(v==="") body[k]="";
 for(const [k,v] of Object.entries(body)) if(["quantity","reorderLevel","unitCost","purchaseCost","purchaseDate","amount","cost"].includes(k)&&v!==""&&k!=="purchaseDate") body[k]=Number(v);
 try{
   if(id) await api(`${page}/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify(body)});
   else await api(page,{method:"POST",body:JSON.stringify(body)});
   await loadData();$("#recordDialog").close();renderPage();toast(id?"Record updated":"Record created");
 }catch(err){toast(err.message)}
}
async function deleteRecord(page,id){
 if(!confirm(`Delete ${id}? This action cannot be undone.`))return;
 try{await api(`${page}/${encodeURIComponent(id)}`,{method:"DELETE"});await loadData();renderPage();toast("Record deleted")}catch(e){toast(e.message)}
}
document.addEventListener("click",e=>{
 const nav=e.target.closest("[data-page]");if(nav){go(nav.dataset.page);return}
 const add=e.target.closest("[data-new]");if(add){openDialog(add.dataset.new);return}
 const edit=e.target.closest("[data-edit]");if(edit){openDialog(edit.dataset.editPage||state.page,edit.dataset.edit);return}
 const del=e.target.closest("[data-delete]");if(del){deleteRecord(del.dataset.deletePage||state.page,del.dataset.delete);return}
});
$("#loginForm").addEventListener("submit",login);
$("#recordForm").addEventListener("submit",saveRecord);
$("#closeDialog").addEventListener("click",()=>$("#recordDialog").close());
$("#cancelDialog").addEventListener("click",()=>$("#recordDialog").close());
$("#logoutBtn").addEventListener("click",logout);
$("#refreshBtn").addEventListener("click",async()=>{try{await loadData();renderPage();toast("Data refreshed")}catch(e){toast(e.message)}});
$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
document.addEventListener("input",e=>{
 if(e.target.id==="tableSearch"){const q=e.target.value.toLowerCase();document.querySelectorAll("#tableBody tr[data-row]").forEach(tr=>tr.hidden=!tr.textContent.toLowerCase().includes(q))}
});
(async()=>{try{const me=await api("me");setUser(me.user);await loadData();showApp()}catch{showLogin()}})();
