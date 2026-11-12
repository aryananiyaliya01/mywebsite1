/* ═══════════════════════════════════════════════════════
   HARIKRISHAN INDUSTRIES – GST BILLING SYSTEM  v2
   app.js  –  Complete application logic
   New in v2:
     • Bank detail preview bar on Create Invoice page
     • Payment tracking (paid / partial / pending)
     • Add Payment modal (both Admin & Billing User)
     • Admin-only invoice edit; Billing user can only add payment
     • Bill History: per-row paid / balance / status
     • Bill History search: shows aggregate totals
     • User Management: search + invoice count
     • Dashboard: Collected & Pending stats
     • Bank Settings & Business Settings properly save/load
═══════════════════════════════════════════════════════ */
'use strict';

/* ─── SUPABASE INITIALIZATION ─── */
const SUPABASE_URL = 'https://dkfpoeuyhqmotlfjxscr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8J6XdUAXI-lUIGFV0c27WA_4Feo5p8j';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
/* ─── DEFAULTS ─── */
const USERS_DEFAULT = [
  { id:'u1', username:'ARUU',    password:'Aruu@123', role:'admin',   active:true },
  { id:'u2', username:'billing', password:'Bill@123', role:'billing', active:true }
];
const COMPANY_DEFAULT = {
  name:'HARIKRISHAN INDUSTRIES',
  address:"A-39, Shiv Shakti Ind. Estate, Nr. Maruti Estate,\nOpp. Kirti Tools, Bombay Conductor Road,\nPhase-1, G.I.D.C., Vatva, Ahmedabad-382445",
  phone:'98986 55255', gstin:'24ACXPF0471B1ZW', pan:'ACXPF0471B',
  state:'GUJARAT', stateCode:'24', email:''
};
const BANK_DEFAULT = {
  name:'CANARA BANK', branch:"VATVA, A'BAD.",
  acNo:'3251201000469', ifsc:'CNRB0003251', accType:'Current Account'
};
const BIZ_DEFAULT = {
  invPrefix:'', nextInvNum:1, finYear:'2025-26',
  terms:"1) Goods once sold will not be accepted back.\n2) Interest @18% p.a. will be charged if invoice is not paid on or before due date.\n3) Subject to Ahmedabad Jurisdiction.",
  signatoryLabel:'Proprietor/Authorised Signatory'
};

/* ─── STATE ─── */
let currentUser   = null;
let productRowIdx = 0;

/* ─── STORAGE ─── */
const save  = (k,v)  => localStorage.setItem(k, JSON.stringify(v));
const load  = (k,d)  => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch{ return d; } };
const getUsers    = ()  => load('hk_users',    USERS_DEFAULT);
const saveUsers   = u   => save('hk_users', u);
const getInvoices = ()  => load('hk_invoices', []);
const saveInvoices= i   => save('hk_invoices', i);
const getCompany  = ()  => ({ ...COMPANY_DEFAULT, ...load('hk_company',{}) });
const getBank     = ()  => ({ ...BANK_DEFAULT,    ...load('hk_bank',{})    });
const getBiz      = ()  => ({ ...BIZ_DEFAULT,     ...load('hk_biz',{})     });

/* ─── PAYMENT HELPERS ─── */
function getPaid(inv)    { return (inv.payments||[]).reduce((s,p)=>s+p.amount,0); }
function getBalance(inv) { return (inv.netAmount||0) - getPaid(inv); }
function getStatus(inv)  {
  const paid = getPaid(inv), net = inv.netAmount||0;
  if(paid<=0) return 'pending';
  if(paid>=net) return 'paid';
  return 'partial';
}

/* ══════════════════════════════════════════════════════
   LOGIN / LOGOUT
══════════════════════════════════════════════════════ */
function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const match = getUsers().find(x => x.username===u && x.password===p && x.active);
  if (!match) {
    document.getElementById('loginError').classList.remove('hidden');
    document.getElementById('loginPass').value = '';
    return;
  }
  document.getElementById('loginError').classList.add('hidden');
  currentUser = match;
  startApp();
}

function doLogout() {
  currentUser = null;
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  showScreen('loginScreen');
}

function togglePass() {
  const el = document.getElementById('loginPass');
  el.type = el.type==='password' ? 'text' : 'password';
}

document.addEventListener('keydown', e => {
  if (e.key==='Enter' && document.getElementById('loginScreen').classList.contains('active')) doLogin();
});

/* ══════════════════════════════════════════════════════
   APP INIT
══════════════════════════════════════════════════════ */
function showScreen(id) {
  ['loginScreen','appScreen'].forEach(s => {
    document.getElementById(s).classList.toggle('active', s===id);
  });
}

function startApp() {
  showScreen('appScreen');
  applyRoleVisibility();
  updateSidebarUser();
  loadCompanySettings();
  loadBankSettings();
  loadBusinessSettings();
  initInvoiceForm();
  renderDashboard();
  navigate('dashboard');
}

function applyRoleVisibility() {
  const isAdmin = currentUser.role==='admin';
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
}

function updateSidebarUser() {
  document.getElementById('userAvatar').textContent    = currentUser.username.charAt(0).toUpperCase();
  document.getElementById('sidebarUserName').textContent = currentUser.username;
  document.getElementById('sidebarUserRole').textContent = currentUser.role==='admin' ? 'Administrator' : 'Billing User';
  document.getElementById('topbarUser').textContent    = currentUser.username;
  document.getElementById('topbarBadge').textContent   = currentUser.role.toUpperCase();
}

/* ══════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════ */
const PAGE_TITLES = {
  dashboard:'Dashboard', createInvoice:'Create Invoice',
  billHistory:'Invoice History', companySettings:'Company Profile',
  bankSettings:'Bank Details', userManagement:'User Management',
  businessSettings:'Business Settings'
};

function navigate(page) {
  const adminPages = ['companySettings','bankSettings','userManagement','businessSettings'];
  if (adminPages.includes(page) && currentUser.role!=='admin') { showToast('Access denied: Admin only.','error'); return; }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-'+page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page]||page;

  if (page==='dashboard')        renderDashboard();
  if (page==='billHistory')      renderHistoryTable();
  if (page==='userManagement')   loadUserTable();
  if (page==='createInvoice')  { refreshInvoiceNumber(); refreshBankPreviewBar(); }
  if (page==='companySettings')  loadCompanySettings();
  if (page==='bankSettings')     loadBankSettings();
  if (page==='businessSettings') loadBusinessSettings();

  if (window.innerWidth<768) closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════ */
function renderDashboard() {
  const invoices  = getInvoices();
  const totalBilled    = invoices.reduce((s,i)=>s+(i.netAmount||0),0);
  const totalCollected = invoices.reduce((s,i)=>s+getPaid(i),0);
  const totalPending   = invoices.reduce((s,i)=>s+Math.max(0,getBalance(i)),0);

  document.getElementById('totalInvoices').textContent = invoices.length;
  document.getElementById('totalRevenue').textContent  = '₹'+fmtNum(totalBilled);
  document.getElementById('totalCollected').textContent= '₹'+fmtNum(totalCollected);
  document.getElementById('totalPending').textContent  = '₹'+fmtNum(totalPending);

  const recent = [...invoices].reverse().slice(0,5);
  const tbody  = document.getElementById('recentInvoicesBody');
  if (!recent.length) { tbody.innerHTML='<tr><td colspan="5" class="no-data">No invoices yet. Create your first invoice!</td></tr>'; return; }
  tbody.innerHTML = recent.map(inv => {
    const st = getStatus(inv);
    return `<tr>
      <td><strong>${esc(inv.number)}</strong></td>
      <td>${esc(inv.customerName)}</td>
      <td><strong>₹${fmtNum(inv.netAmount)}</strong></td>
      <td>${statusBadge(st)}</td>
      <td>
        <button class="btn btn-sm btn-edit" onclick="previewInvoice('${inv.id}')">👁</button>
        <button class="btn btn-sm btn-pay"  onclick="openPaymentModal('${inv.id}')">💳</button>
      </td></tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════
   COMPANY SETTINGS
══════════════════════════════════════════════════════ */
function loadCompanySettings() {
  const c = getCompany();
  document.getElementById('coName').value      = c.name;
  document.getElementById('coAddress').value   = c.address;
  document.getElementById('coPhone').value     = c.phone;
  document.getElementById('coGstin').value     = c.gstin;
  document.getElementById('coPan').value       = c.pan;
  document.getElementById('coState').value     = c.state;
  document.getElementById('coStateCode').value = c.stateCode;
  document.getElementById('coEmail').value     = c.email||'';
}
function saveCompanySettings() {
  const c = {
    name:document.getElementById('coName').value.trim(),
    address:document.getElementById('coAddress').value.trim(),
    phone:document.getElementById('coPhone').value.trim(),
    gstin:document.getElementById('coGstin').value.trim().toUpperCase(),
    pan:document.getElementById('coPan').value.trim().toUpperCase(),
    state:document.getElementById('coState').value.trim().toUpperCase(),
    stateCode:document.getElementById('coStateCode').value.trim(),
    email:document.getElementById('coEmail').value.trim()
  };
  save('hk_company',c);
  showToast('Company profile saved!','success');
}

/* ══════════════════════════════════════════════════════
   BANK SETTINGS
══════════════════════════════════════════════════════ */
function loadBankSettings() {
  const b = getBank();
  document.getElementById('bankName').value    = b.name;
  document.getElementById('bankBranch').value  = b.branch;
  document.getElementById('bankAcNo').value    = b.acNo;
  document.getElementById('bankIfsc').value    = b.ifsc;
  document.getElementById('bankAccType').value = b.accType;
}
function saveBankSettings() {
  const b = {
    name:document.getElementById('bankName').value.trim(),
    branch:document.getElementById('bankBranch').value.trim(),
    acNo:document.getElementById('bankAcNo').value.trim(),
    ifsc:document.getElementById('bankIfsc').value.trim().toUpperCase(),
    accType:document.getElementById('bankAccType').value
  };
  save('hk_bank',b);
  showToast('Bank details saved!','success');
  refreshBankPreviewBar();
}

/* ══════════════════════════════════════════════════════
   BUSINESS SETTINGS
══════════════════════════════════════════════════════ */
function loadBusinessSettings() {
  const biz = getBiz();
  document.getElementById('invPrefix').value      = biz.invPrefix;
  document.getElementById('nextInvNum').value     = biz.nextInvNum;
  document.getElementById('finYear').value        = biz.finYear;
  document.getElementById('termsText').value      = biz.terms;
  document.getElementById('signatoryLabel').value = biz.signatoryLabel;
}
function saveBusinessSettings() {
  const biz = {
    invPrefix:document.getElementById('invPrefix').value.trim(),
    nextInvNum:parseInt(document.getElementById('nextInvNum').value)||1,
    finYear:document.getElementById('finYear').value.trim(),
    terms:document.getElementById('termsText').value.trim(),
    signatoryLabel:document.getElementById('signatoryLabel').value.trim()
  };
  save('hk_biz',biz);
  showToast('Business settings saved!','success');
  refreshInvoiceNumber();
}

/* ══════════════════════════════════════════════════════
   BANK PREVIEW BAR (on Create Invoice)
══════════════════════════════════════════════════════ */
function refreshBankPreviewBar() {
  const b = getBank();
  document.getElementById('bpName').textContent   = b.name;
  document.getElementById('bpBranch').textContent = b.branch;
  document.getElementById('bpAcNo').textContent   = b.acNo;
  document.getElementById('bpIfsc').textContent   = b.ifsc;
}

/* ══════════════════════════════════════════════════════
   USER MANAGEMENT
══════════════════════════════════════════════════════ */
function loadUserTable(filter) {
  let users   = getUsers();
  const invoices = getInvoices();
  const q = (filter || document.getElementById('searchUser')?.value || '').toLowerCase().trim();

  // Payment totals
  const totalBilled    = invoices.reduce((s,i)=>s+(i.netAmount||0),0);
  const totalCollected = invoices.reduce((s,i)=>s+getPaid(i),0);
  const totalPending   = invoices.reduce((s,i)=>s+Math.max(0,getBalance(i)),0);
  document.getElementById('usTotalUsers').textContent     = users.length;
  document.getElementById('usTotalBilled').textContent    = '₹'+fmtNum(totalBilled);
  document.getElementById('usTotalCollected').textContent = '₹'+fmtNum(totalCollected);
  document.getElementById('usTotalPending').textContent   = '₹'+fmtNum(totalPending);

  if (q) users = users.filter(u => u.username.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));

  const tbody = document.getElementById('userTableBody');
  tbody.innerHTML = users.map(u => {
    const invCount = invoices.filter(i => i.createdBy===u.username).length;
    return `<tr>
      <td><strong>${esc(u.username)}</strong></td>
      <td><span class="badge badge-${u.role}">${u.role==='admin'?'Admin':'Billing'}</span></td>
      <td><span class="badge ${u.active?'badge-active':''}">${u.active?'Active':'Inactive'}</span></td>
      <td>${invCount}</td>
      <td>
        ${u.id==='u1'
          ? '<span style="color:#aaa;font-size:12px">Protected</span>'
          : `<button class="btn btn-sm btn-edit" onclick="editUser('${u.id}')">✏️ Edit</button>
             <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">🗑️ Delete</button>`}
      </td></tr>`;
  }).join('');
}

function filterUsers()  { loadUserTable(); }
function clearUserSearch() { document.getElementById('searchUser').value=''; loadUserTable(); }

function showAddUserModal() {
  document.getElementById('userModalTitle').textContent='Add User';
  document.getElementById('modalUsername').value='';
  document.getElementById('modalPassword').value='';
  document.getElementById('modalRole').value='billing';
  document.getElementById('editingUserId').value='';
  document.getElementById('userModal').classList.remove('hidden');
}
function editUser(id) {
  const u = getUsers().find(x=>x.id===id); if(!u) return;
  document.getElementById('userModalTitle').textContent='Edit User';
  document.getElementById('modalUsername').value=u.username;
  document.getElementById('modalPassword').value=u.password;
  document.getElementById('modalRole').value=u.role;
  document.getElementById('editingUserId').value=id;
  document.getElementById('userModal').classList.remove('hidden');
}
function saveUser() {
  const username=document.getElementById('modalUsername').value.trim();
  const password=document.getElementById('modalPassword').value;
  const role=document.getElementById('modalRole').value;
  const editId=document.getElementById('editingUserId').value;
  if(!username||!password){ showToast('Username and password required.','error'); return; }
  let users=getUsers();
  if(editId) {
    users=users.map(u=>u.id===editId?{...u,username,password,role}:u);
    showToast('User updated!','success');
  } else {
    if(users.find(u=>u.username===username)){ showToast('Username already exists!','error'); return; }
    users.push({id:'u'+Date.now(),username,password,role,active:true});
    showToast('User added!','success');
  }
  saveUsers(users); loadUserTable(); closeModal('userModal');
}
function deleteUser(id) {
  if(!confirm('Delete this user?')) return;
  saveUsers(getUsers().filter(u=>u.id!==id));
  loadUserTable(); showToast('User deleted.','success');
}

/* ══════════════════════════════════════════════════════
   CREATE INVOICE FORM
══════════════════════════════════════════════════════ */
function initInvoiceForm() {
  refreshInvoiceNumber();
  refreshBankPreviewBar();
  document.getElementById('invDate').value=todayISO();
  productRowIdx=0;
  document.getElementById('productRows').innerHTML='';
  addProductRow();
  recalculate();
}

function refreshInvoiceNumber() {
  const biz=getBiz();
  const num=String(biz.nextInvNum).padStart(2,'0');
  document.getElementById('invNumber').value=(biz.invPrefix||'')+num;
}

function resetInvoiceForm() {
  if(!confirm('Reset all invoice data?')) return;
  initInvoiceForm();
  ['custName','custGst','custAddress','custState','placeOfSupply','challanNo','poNo'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('otherCharges').value='0';
}

function addProductRow() {
  productRowIdx++;
  const idx=productRowIdx;
  const tbody=document.getElementById('productRows');
  const tr=document.createElement('tr');
  tr.id='prow-'+idx;
  tr.innerHTML=`
    <td class="center"><strong>${tbody.children.length+1}</strong></td>
    <td><input type="text" placeholder="Product description..."/></td>
    <td><input type="text" placeholder="HSN/SAC" maxlength="12"/></td>
    <td><input type="number" min="0" step="0.01" value="1" oninput="calcRowAmount(${idx})"/></td>
    <td><input type="number" min="0" step="0.01" value="0" oninput="calcRowAmount(${idx})"/></td>
    <td><input type="number" id="amt-${idx}" readonly class="readonly-field" value="0"/></td>
    <td><button class="btn btn-danger btn-sm" onclick="removeRow(${idx})">✕</button></td>`;
  tbody.appendChild(tr);
  calcRowAmount(idx);
}

function removeRow(idx) {
  const tbody=document.getElementById('productRows');
  if(tbody.children.length<=1){ showToast('At least one product row required.','error'); return; }
  const tr=document.getElementById('prow-'+idx);
  if(tr) tr.remove();
  updateRowNum(); recalculate();
}

function updateRowNum() {
  document.querySelectorAll('#productRows tr').forEach((tr,i)=>{ if(tr.cells[0]) tr.cells[0].innerHTML=`<strong>${i+1}</strong>`; });
}

function calcRowAmount(idx) {
  const tr=document.getElementById('prow-'+idx); if(!tr) return;
  const qty=parseFloat(tr.cells[3].querySelector('input').value)||0;
  const rate=parseFloat(tr.cells[4].querySelector('input').value)||0;
  tr.cells[5].querySelector('input').value=(qty*rate).toFixed(2);
  recalculate();
}

function getProductRows() {
  const rows=[];
  document.querySelectorAll('#productRows tr').forEach((tr,i)=>{
    const inp=tr.querySelectorAll('input');
    rows.push({sr:i+1,desc:inp[0].value.trim(),hsn:inp[1].value.trim(),
      qty:parseFloat(inp[2].value)||0,rate:parseFloat(inp[3].value)||0,amount:parseFloat(inp[4].value)||0});
  });
  return rows;
}

function recalculate() {
  const products=getProductRows();
  const subTotal=products.reduce((s,p)=>s+p.amount,0);
  const otherCharges=parseFloat(document.getElementById('otherCharges').value)||0;
  const gstRate=parseFloat(document.getElementById('gstRate').value)||0;
  const gstType=document.getElementById('gstType').value;
  const taxableAmt=subTotal+otherCharges;
  const totalGst=taxableAmt*gstRate/100;
  const halfGst=totalGst/2;
  const raw=taxableAmt+totalGst;
  const rounded=Math.round(raw);
  const roundOff=rounded-raw;
  const halfRate=gstRate/2;
  const isIntra=gstType==='intra';

  document.getElementById('lblCGST').textContent=`CGST (${halfRate}%)`;
  document.getElementById('lblSGST').textContent=`SGST (${halfRate}%)`;
  document.getElementById('lblIGST').textContent=`IGST (${gstRate}%)`;
  document.getElementById('lblOtherCharges').textContent=document.getElementById('otherChargesLabel').value||'Other Charges';
  document.getElementById('rowCGST').style.display=isIntra?'':'none';
  document.getElementById('rowSGST').style.display=isIntra?'':'none';
  document.getElementById('rowIGST').style.display=isIntra?'none':'';
  document.getElementById('tSubTotal').textContent='₹'+fmtNum(subTotal);
  document.getElementById('tOtherCharges').textContent='₹'+fmtNum(otherCharges);
  document.getElementById('tCGST').textContent='₹'+fmtNum(halfGst);
  document.getElementById('tSGST').textContent='₹'+fmtNum(halfGst);
  document.getElementById('tIGST').textContent='₹'+fmtNum(totalGst);
  document.getElementById('tRoundOff').textContent=(roundOff>=0?'+':'')+fmtNum(roundOff);
  document.getElementById('tNetAmount').textContent='₹'+fmtNum(rounded);
}

/* ══════════════════════════════════════════════════════
   SAVE INVOICE
══════════════════════════════════════════════════════ */
function saveAndPreviewInvoice() {
  const custName=document.getElementById('custName').value.trim();
  if(!custName){ showToast('Please enter customer name.','error'); return; }
  const products=getProductRows();
  if(!products.some(p=>p.desc)){ showToast('Add at least one product.','error'); return; }

  const gstType=document.getElementById('gstType').value;
  const gstRate=parseFloat(document.getElementById('gstRate').value)||0;
  const subTotal=products.reduce((s,p)=>s+p.amount,0);
  const otherCharges=parseFloat(document.getElementById('otherCharges').value)||0;
  const taxableAmt=subTotal+otherCharges;
  const totalGst=taxableAmt*gstRate/100;
  const halfGst=totalGst/2;
  const raw=taxableAmt+totalGst;
  const rounded=Math.round(raw);
  const roundOff=rounded-raw;

  const inv = {
    id:'inv-'+Date.now(),
    number:document.getElementById('invNumber').value,
    date:document.getElementById('invDate').value,
    challanNo:document.getElementById('challanNo').value.trim(),
    poNo:document.getElementById('poNo').value.trim(),
    customerName:custName,
    customerAddr:document.getElementById('custAddress').value.trim(),
    customerGst:document.getElementById('custGst').value.trim().toUpperCase(),
    custState:document.getElementById('custState').value.trim(),
    placeOfSupply:document.getElementById('placeOfSupply').value.trim(),
    products,gstType,gstRate,otherCharges,
    otherChargesLabel:document.getElementById('otherChargesLabel').value.trim()||'Packing & Forwarding',
    subTotal,
    cgst:gstType==='intra'?halfGst:0,
    sgst:gstType==='intra'?halfGst:0,
    igst:gstType==='inter'?totalGst:0,
    roundOff,netAmount:rounded,
    payments:[],           // ← payment array
    createdBy:currentUser.username,
    createdAt:new Date().toISOString()
  };

  const invoices=getInvoices();
  invoices.push(inv);
  saveInvoices(invoices);

  const biz=getBiz();
  biz.nextInvNum=(parseInt(biz.nextInvNum)||1)+1;
  save('hk_biz',biz);
  document.getElementById('nextInvNum').value=biz.nextInvNum;

  showToast('Invoice saved!','success');
  openInvoicePreview(inv);
}

/* ══════════════════════════════════════════════════════
   PAYMENT SYSTEM
══════════════════════════════════════════════════════ */
function openPaymentModal(invId) {
  const inv=getInvoices().find(i=>i.id===invId);
  if(!inv){ showToast('Invoice not found.','error'); return; }

  const balance=getBalance(inv);
  editingPaymentIndex=null;

  document.getElementById('payInvId').value=invId;
  document.getElementById('payDate').value=todayISO();
  document.getElementById('payAmount').value=balance>0?balance.toFixed(2):'';
  document.getElementById('payMode').value='Cash';
  document.getElementById('payNote').value='';
  document.getElementById('paymentModalTitle').textContent=currentUser.role==='admin'?'Manage Payments':'Add Payment';

  renderPaymentModal(inv);

  document.getElementById('paymentModal').classList.remove('hidden');
}

let editingPaymentIndex=null;

function renderPaymentModal(inv) {
  const paid=getPaid(inv), balance=getBalance(inv), st=getStatus(inv);
  document.getElementById('payInvInfo').innerHTML=`
    <strong>${esc(inv.number)} — ${esc(inv.customerName)}</strong><br>
    Net Amount: ₹${fmtNum(inv.netAmount)} &nbsp;|&nbsp;
    Paid: ₹${fmtNum(paid)} &nbsp;|&nbsp;
    <span style="color:${balance>0?'#e74c3c':'#27ae60'}">Balance: ₹${fmtNum(balance)}</span>
    &nbsp;${statusBadge(st)}`;

  const prev=inv.payments||[];
  const sec=document.getElementById('payHistorySection');
  const list=document.getElementById('payHistoryList');
  if(prev.length){
    list.innerHTML=prev.map((p,index)=>`
      <div class="pay-entry${editingPaymentIndex===index?' pay-entry-editing':''}">
        <div>
          <div style="font-weight:600">${formatDate(p.date)}</div>
          <div class="pay-entry-mode">${esc(p.mode)} ${p.note?'— '+esc(p.note):''}</div>
        </div>
        <div class="pay-entry-right">
          <div class="pay-entry-amt">+₹${fmtNum(p.amount)}</div>
          ${currentUser.role==='admin'?`<div class="pay-entry-actions">
            <button class="btn btn-sm btn-outline" onclick="editPayment(${index})">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deletePayment(${index})">🗑️ Delete</button>
          </div>`:''}
        </div>
      </div>`).join('');
    sec.classList.remove('hidden');
  } else {
    sec.classList.add('hidden');
  }

  const saveBtn=document.getElementById('savePaymentBtn');
  const isEditing=editingPaymentIndex!==null;
  saveBtn.disabled=!isEditing && balance<=0;
  saveBtn.style.opacity=saveBtn.disabled?'0.5':'';
  saveBtn.textContent=isEditing?'✅ Update Payment':balance<=0?'✅ Fully Paid':'✅ Save Payment';
}

function editPayment(paymentIndex) {
  if(currentUser.role!=='admin'){ showToast('Only Admin can edit payments.','error'); return; }
  const inv=getInvoices().find(i=>i.id===document.getElementById('payInvId').value);
  const payment=inv?.payments?.[paymentIndex];
  if(!payment){ showToast('Payment not found.','error'); return; }

  editingPaymentIndex=paymentIndex;
  document.getElementById('payDate').value=payment.date;
  document.getElementById('payAmount').value=payment.amount;
  document.getElementById('payMode').value=payment.mode;
  document.getElementById('payNote').value=payment.note||'';
  renderPaymentModal(inv);
}

function deletePayment(paymentIndex) {
  if(currentUser.role!=='admin'){ showToast('Only Admin can delete payments.','error'); return; }
  const invoices=getInvoices();
  const invIndex=invoices.findIndex(i=>i.id===document.getElementById('payInvId').value);
  if(invIndex===-1){ showToast('Invoice not found.','error'); return; }
  const inv=invoices[invIndex];
  if(!inv.payments?.[paymentIndex]){ showToast('Payment not found.','error'); return; }
  if(!confirm('Delete this payment permanently?')) return;

  inv.payments.splice(paymentIndex,1);
  invoices[invIndex]=inv;
  saveInvoices(invoices);
  editingPaymentIndex=null;
  document.getElementById('payDate').value=todayISO();
  document.getElementById('payAmount').value=getBalance(inv)>0?getBalance(inv).toFixed(2):'';
  document.getElementById('payMode').value='Cash';
  document.getElementById('payNote').value='';
  renderPaymentModal(inv);
  showToast('Payment deleted.','success');
  renderDashboard();
  if(document.getElementById('page-billHistory').classList.contains('active')) renderHistoryTable();
}

function savePayment() {
  const invId  = document.getElementById('payInvId').value;
  const date   = document.getElementById('payDate').value;
  const amount = parseFloat(document.getElementById('payAmount').value) || 0;
  const mode   = document.getElementById('payMode').value;
  const note   = document.getElementById('payNote').value.trim();

  if (!date)      { showToast('Select payment date.', 'error'); return; }
  if (amount <= 0){ showToast('Enter valid amount.', 'error');  return; }

  let invoices = getInvoices();
  const idx = invoices.findIndex(i => i.id === invId);
  if (idx === -1) { showToast('Invoice not found.', 'error'); return; }

  const inv     = invoices[idx];
  const editingPayment=editingPaymentIndex===null?null:inv.payments?.[editingPaymentIndex];
  if(editingPaymentIndex!==null && currentUser.role!=='admin'){
    showToast('Only Admin can edit payments.','error');
    return;
  }
  if(editingPaymentIndex!==null && !editingPayment){
    showToast('Payment not found.','error');
    return;
  }
  const balance = getBalance(inv)+(editingPayment?Number(editingPayment.amount)||0:0);
  const st      = getStatus(inv);

  // 🔒 Non-admin users CANNOT add payment to a fully paid invoice
  if (editingPaymentIndex===null && st === 'paid' && currentUser.role !== 'admin') {
    showToast('Payment already complete. Only Admin can modify payments.', 'error');
    return;
  }

  if (amount > balance + 0.01) {
    showToast(`Amount ₹${fmtNum(amount)} exceeds balance ₹${fmtNum(balance)}.`, 'error');
    return;
  }

  if (!inv.payments) inv.payments = [];
  if(editingPayment){
    inv.payments[editingPaymentIndex]={...editingPayment,date,amount,mode,note};
  } else {
    inv.payments.push({ id:'pay-'+Date.now(), date, amount, mode, note, addedBy: currentUser.username });
  }
  invoices[idx] = inv;
  saveInvoices(invoices);

  showToast(editingPayment
    ?'Payment updated!'
    :`Payment of ₹${fmtNum(amount)} saved! ${getBalance(inv)<=0?'Invoice fully paid! 🎉':''}`, 'success');
  editingPaymentIndex=null;
  closeModal('paymentModal');
  renderDashboard();
  if (document.getElementById('page-billHistory').classList.contains('active')) renderHistoryTable();
}

/* ══════════════════════════════════════════════════════
   BILL HISTORY
══════════════════════════════════════════════════════ */
let historyStatusFilter = 'all'; // 'all' | 'pending' | 'partial' | 'paid'

function renderHistoryTable() {
  let invoices = getInvoices();
  const q = (document.getElementById('searchInvoice')?.value || '').toLowerCase().trim();
  if (q) invoices = invoices.filter(inv => inv.number.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q));

  // Apply status filter
  if (historyStatusFilter !== 'all') {
    invoices = invoices.filter(inv => getStatus(inv) === historyStatusFilter);
  }

  // Summary stats (from filtered list)
  const totalAmt     = invoices.reduce((s,i) => s+(i.netAmount||0), 0);
  const totalPaid    = invoices.reduce((s,i) => s+getPaid(i), 0);
  const totalPending = invoices.reduce((s,i) => s+Math.max(0,getBalance(i)), 0);
  document.getElementById('hsTotalBills').textContent   = invoices.length;
  document.getElementById('hsTotalAmt').textContent     = '₹'+fmtNum(totalAmt);
  document.getElementById('hsTotalPaid').textContent    = '₹'+fmtNum(totalPaid);
  document.getElementById('hsTotalPending').textContent = '₹'+fmtNum(totalPending);

  // Customer-wise total
  const custMap = {};
  getInvoices().forEach(inv => {
    const name = inv.customerName || 'Unknown';
    if (!custMap[name]) custMap[name] = 0;
    custMap[name] += inv.netAmount || 0;
  });
  const custSummaryEl = document.getElementById('customerTotalSummary');
  if (custSummaryEl) {
    custSummaryEl.innerHTML = Object.entries(custMap)
      .sort((a,b) => b[1]-a[1])
      .map(([name, total]) => `<div class="cust-total-row"><span class="cust-name">${esc(name)}</span><span class="cust-amt">₹${fmtNum(total)}</span></div>`)
      .join('') || '<p style="color:#aaa;padding:8px">No data.</p>';
  }

  const tbody = document.getElementById('historyTableBody');
  if (!invoices.length) { tbody.innerHTML = '<tr><td colspan="8" class="no-data">No invoices found.</td></tr>'; return; }

  const isAdmin = currentUser.role === 'admin';

  tbody.innerHTML = [...invoices].reverse().map(inv => {
    const paid = getPaid(inv), balance = getBalance(inv), st = getStatus(inv);
    // Payment button: user can add payment if NOT fully paid; admin can always manage
    const canPay = isAdmin || st !== 'paid';
    const payBtn = canPay
      ? `<button class="btn btn-sm btn-pay" onclick="openPaymentModal('${inv.id}')">💳 Pay</button>`
      : `<span class="badge badge-paid" title="Fully paid – contact admin to modify">✅ Paid</span>`;
    return `<tr>
      <td><strong>${esc(inv.number)}</strong></td>
      <td>${formatDate(inv.date)}</td>
      <td>${esc(inv.customerName)}</td>
      <td><strong>₹${fmtNum(inv.netAmount)}</strong></td>
      <td style="color:#27ae60;font-weight:600">₹${fmtNum(paid)}</td>
      <td style="color:${balance>0?'#e74c3c':'#27ae60'};font-weight:600">₹${fmtNum(balance)}</td>
      <td>${statusBadge(st)}</td>
      <td>
        <button class="btn btn-sm btn-edit" onclick="previewInvoice('${inv.id}')">👁 View</button>
        ${payBtn}
        <button class="btn btn-sm btn-success" onclick="printSavedInvoice('${inv.id}')">🖨️</button>
        ${isAdmin?`<button class="btn btn-sm btn-outline" onclick="editInvoice('${inv.id}')">✏️</button>`:''}
        ${isAdmin?`<button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}')">🗑️</button>`:''}
      </td></tr>`;
  }).join('');
}

function setHistoryFilter(f) {
  historyStatusFilter = f;
  document.querySelectorAll('.hist-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  renderHistoryTable();
}

function filterInvoices()  { renderHistoryTable(); }
function clearSearch()     { document.getElementById('searchInvoice').value=''; renderHistoryTable(); }

function deleteInvoice(id) {
  if(currentUser.role!=='admin'){ showToast('Only admin can delete invoices.','error'); return; }
  if(!confirm('Delete this invoice permanently?')) return;
  saveInvoices(getInvoices().filter(i=>i.id!==id));
  renderHistoryTable(); showToast('Invoice deleted.','success');
}

/* ══════════════════════════════════════════════════════
   EDIT INVOICE  (Admin only – opens pre-filled form)
══════════════════════════════════════════════════════ */
function editInvoice(id) {
  if(currentUser.role!=='admin'){ showToast('Only admin can edit invoices.','error'); return; }
  const inv=getInvoices().find(i=>i.id===id);
  if(!inv){ showToast('Invoice not found.','error'); return; }

  navigate('createInvoice');

  // Pre-fill everything
  setTimeout(()=>{
    document.getElementById('invNumber').value     = inv.number;
    document.getElementById('invDate').value       = inv.date;
    document.getElementById('challanNo').value     = inv.challanNo||'';
    document.getElementById('poNo').value          = inv.poNo||'';
    document.getElementById('custName').value      = inv.customerName;
    document.getElementById('custAddress').value   = inv.customerAddr||'';
    document.getElementById('custGst').value       = inv.customerGst||'';
    document.getElementById('custState').value     = inv.custState||'';
    document.getElementById('placeOfSupply').value = inv.placeOfSupply||'';
    document.getElementById('gstType').value       = inv.gstType||'intra';
    document.getElementById('gstRate').value       = String(inv.gstRate||18);
    document.getElementById('otherCharges').value  = inv.otherCharges||0;
    document.getElementById('otherChargesLabel').value = inv.otherChargesLabel||'Packing & Forwarding';

    // Load products
    productRowIdx=0;
    document.getElementById('productRows').innerHTML='';
    (inv.products||[]).forEach(p=>{
      addProductRow();
      const rows=document.querySelectorAll('#productRows tr');
      const tr=rows[rows.length-1];
      const inp=tr.querySelectorAll('input');
      inp[0].value=p.desc; inp[1].value=p.hsn;
      inp[2].value=p.qty;  inp[3].value=p.rate;
      inp[4].value=p.amount;
    });
    recalculate();

    // Mark this as an edit — override save to update existing record
    window._editingInvoiceId = id;
    // Change button text
    const saveBtn=document.querySelector('[onclick="saveAndPreviewInvoice()"]');
    if(saveBtn) saveBtn.textContent='💾 Update Invoice';
    showToast('Invoice loaded for editing. Make changes and save.','success');
  }, 100);
}

/* Override save to handle update */
const _origSave = window.saveAndPreviewInvoice;
window.saveAndPreviewInvoice = function() {
  if (window._editingInvoiceId) {
    updateExistingInvoice(window._editingInvoiceId);
  } else {
    _origSave();
  }
};

function updateExistingInvoice(id) {
  const custName=document.getElementById('custName').value.trim();
  if(!custName){ showToast('Please enter customer name.','error'); return; }
  const products=getProductRows();
  if(!products.some(p=>p.desc)){ showToast('Add at least one product.','error'); return; }

  const gstType=document.getElementById('gstType').value;
  const gstRate=parseFloat(document.getElementById('gstRate').value)||0;
  const subTotal=products.reduce((s,p)=>s+p.amount,0);
  const otherCharges=parseFloat(document.getElementById('otherCharges').value)||0;
  const taxableAmt=subTotal+otherCharges;
  const totalGst=taxableAmt*gstRate/100;
  const halfGst=totalGst/2;
  const raw=taxableAmt+totalGst;
  const rounded=Math.round(raw);
  const roundOff=rounded-raw;

  let invoices=getInvoices();
  const idx=invoices.findIndex(i=>i.id===id);
  if(idx===-1){ showToast('Invoice not found.','error'); return; }
  const existing=invoices[idx];

  invoices[idx]={
    ...existing,
    date:document.getElementById('invDate').value,
    challanNo:document.getElementById('challanNo').value.trim(),
    poNo:document.getElementById('poNo').value.trim(),
    customerName:custName,
    customerAddr:document.getElementById('custAddress').value.trim(),
    customerGst:document.getElementById('custGst').value.trim().toUpperCase(),
    custState:document.getElementById('custState').value.trim(),
    placeOfSupply:document.getElementById('placeOfSupply').value.trim(),
    products,gstType,gstRate,otherCharges,
    otherChargesLabel:document.getElementById('otherChargesLabel').value.trim()||'Packing & Forwarding',
    subTotal,
    cgst:gstType==='intra'?halfGst:0,
    sgst:gstType==='intra'?halfGst:0,
    igst:gstType==='inter'?totalGst:0,
    roundOff,netAmount:rounded,
    updatedBy:currentUser.username,
    updatedAt:new Date().toISOString()
  };
  saveInvoices(invoices);

  // Reset edit mode
  window._editingInvoiceId=null;
  const saveBtn=document.querySelector('[onclick="saveAndPreviewInvoice()"]');
  if(saveBtn) saveBtn.textContent='💾 Save & Preview';

  showToast('Invoice updated!','success');
  openInvoicePreview(invoices[idx]);
  initInvoiceForm();
}

/* ══════════════════════════════════════════════════════
   INVOICE PREVIEW & PRINT
══════════════════════════════════════════════════════ */
function previewInvoice(id) {
  const inv=getInvoices().find(i=>i.id===id);
  if(!inv){ showToast('Invoice not found.','error'); return; }
  openInvoicePreview(inv);
}
function printSavedInvoice(id) { previewInvoice(id); setTimeout(printInvoice,400); }

function openInvoicePreview(inv) {
  document.getElementById('invoicePreviewBody').innerHTML=buildInvoiceHTML(inv);
  document.getElementById('invoiceModal').classList.remove('hidden');
}

function printInvoice() {
  const content=document.getElementById('invoicePreviewBody').innerHTML;
  const win=window.open('','_blank','width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head><title>Tax Invoice</title><style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#fff}
    .invoice-print-area{width:210mm;margin:0 auto;padding:8mm}
    .inv-title-bar{text-align:center;font-size:16px;font-weight:800;letter-spacing:3px;border:2px solid #c0392b;padding:6px;color:#c0392b;position:relative}
    .inv-copy-type{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:10px;color:#555;font-weight:500;letter-spacing:0}
    .inv-header-grid{display:grid;grid-template-columns:1.2fr 1fr;border:2px solid #c0392b;border-top:none}
    .inv-company-block{padding:10px 12px;border-right:1px solid #c0392b}
    .inv-meta-block{padding:0}
    .inv-company-logo{display:flex;align-items:center;gap:10px;margin-bottom:4px}
    .inv-logo-box{width:48px;height:48px;background:#c0392b;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .inv-logo-hi{color:#fff;font-size:18px;font-weight:900;font-style:italic}
    .inv-company-name{font-size:22px;font-weight:900;color:#c0392b;letter-spacing:1px;line-height:1}
    .inv-company-sub{font-size:12px;font-weight:700;color:#c0392b;letter-spacing:2px}
    .inv-company-addr{font-size:10.5px;color:#333;margin-top:5px;line-height:1.5}
    .inv-meta-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #c0392b}
    .inv-meta-row:last-child{border-bottom:none}
    .inv-meta-cell{padding:5px 8px;font-size:11px;border-right:1px solid #c0392b}
    .inv-meta-cell:last-child{border-right:none}
    .inv-meta-label{font-weight:700}
    .inv-billing-grid{display:grid;grid-template-columns:1.2fr 1fr;border:2px solid #c0392b;border-top:none}
    .inv-billing-left{padding:8px 12px;border-right:1px solid #c0392b}
    .inv-billing-right{padding:8px 12px}
    .inv-billing-right .inv-meta-row{border:none}
    .inv-billing-right .inv-meta-cell{padding:4px 6px;border-right:none}
    .inv-label-sm{font-size:10px;color:#777;font-weight:700}
    .inv-ms{font-size:12.5px;font-weight:700;margin-bottom:2px}
    .inv-addr-text{font-size:11px;line-height:1.45;margin-bottom:3px}
    .inv-gst-no{font-size:11px}
    .inv-product-table{width:100%;border-collapse:collapse;border-left:2px solid #c0392b;border-right:2px solid #c0392b}
    .inv-product-table th{background:#f5f5f5;text-align:center;font-size:11px;font-weight:700;padding:5px 4px;border:1px solid #c0392b}
    .inv-product-table td{font-size:11px;padding:5px 4px;border:1px solid #c0392b;vertical-align:top}
    .inv-product-table td.amount-col{text-align:right}
    .inv-product-table td.center{text-align:center}
    .inv-footer-grid{display:grid;grid-template-columns:1.2fr 1fr;border:2px solid #c0392b;border-top:1px solid #c0392b}
    .inv-footer-left{padding:8px 12px;border-right:1px solid #c0392b}
    .inv-footer-right{padding:0}
    .inv-totals-table{width:100%;border-collapse:collapse}
    .inv-totals-table tr td{padding:4px 8px;font-size:11px;border-bottom:1px solid #e0e0e0}
    .inv-totals-table tr:last-child td{border-bottom:none}
    .inv-totals-table .tot-label{font-weight:600}
    .inv-totals-table .tot-val{text-align:right;font-weight:600}
    .inv-totals-table .net-row td{background:#c0392b;color:#fff;font-weight:800;font-size:12px;padding:6px 8px}
    .inv-bank-section{margin-top:8px}
    .inv-bank-title{font-size:10px;font-weight:800;color:#c0392b;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}
    .inv-bank-detail{font-size:10.5px;line-height:1.55}
    .inv-rupees-section{margin-top:8px;padding-top:6px;border-top:1px dashed #ccc}
    .inv-rupees-label{font-size:10px;font-weight:800;color:#333}
    .inv-rupees-words{font-size:11.5px;font-weight:600}
    .inv-terms-section{border:2px solid #c0392b;border-top:none;padding:8px 12px;font-size:10px}
    .inv-terms-title{font-weight:800;font-size:10px;color:#c0392b;margin-bottom:4px}
    .inv-terms-list{padding-left:16px}
    .inv-terms-list li{margin-bottom:2px}
    .inv-signatory-section{border:2px solid #c0392b;border-top:none;padding:10px 12px;display:flex;justify-content:space-between;align-items:flex-end}
    .inv-eoe{font-size:10px;font-weight:700;color:#555}
    .inv-sign-block{text-align:right}
    .inv-sign-for{font-size:10px;color:#555}
    .inv-sign-company{font-size:11px;font-weight:800;color:#c0392b;margin-bottom:28px}
    .inv-sign-label{font-size:10.5px;font-weight:700;border-top:1px solid #333;padding-top:3px}
    @page{size:A4;margin:0}
    @media print{body{margin:0}.invoice-print-area{padding:8mm}}
  </style></head><body>${content}</body></html>`);
  win.document.close();
  setTimeout(()=>{ win.focus(); win.print(); },500);
}

function buildInvoiceHTML(inv) {
  const co=getCompany(), bk=getBank(), biz=getBiz();
  const gstRate=inv.gstRate||0, halfRate=gstRate/2, isIntra=inv.gstType==='intra';
  const terms=(biz.terms||'').split('\n').filter(Boolean);
  const signLabel=biz.signatoryLabel||'Proprietor/Authorised Signatory';
  const prods=inv.products||[];
  const minRows=8;
  const emptyCount=Math.max(0,minRows-prods.length);
  const emptyRows=Array(emptyCount).fill(null);

  return `
<div class="invoice-print-area">
  <div class="inv-title-bar">TAX INVOICE<span class="inv-copy-type">Original / Duplicate / Triplicate</span></div>
  <div class="inv-header-grid">
    <div class="inv-company-block">
      <div class="inv-company-logo">
        <div class="inv-logo-box"><span class="inv-logo-hi">Hi</span></div>
        <div><div class="inv-company-name">HARIKRISHAN</div><div class="inv-company-sub">INDUSTRIES</div></div>
      </div>
      <div class="inv-company-addr">${esc(co.address).replace(/\n/g,'<br>')}${co.phone?'<br><strong>M. : '+esc(co.phone)+'</strong>':''}</div>
      <div class="inv-co-reg">
        <div><span class="inv-meta-label">GSTIN No. :</span> ${esc(co.gstin)}</div>
        <div><span class="inv-meta-label">PAN No. :</span> ${esc(co.pan)}</div>
        <div><span class="inv-meta-label">STATE :</span> ${esc(co.state)} &nbsp; <span class="inv-meta-label">STATE CODE :</span> ${esc(co.stateCode)}</div>
        ${inv.placeOfSupply?`<div><span class="inv-meta-label">Place of Supply :</span> ${esc(inv.placeOfSupply)}</div>`:''}
      </div>
    </div>
    <div class="inv-meta-block">
      <div class="inv-meta-row"><div class="inv-meta-cell"><span class="inv-meta-label">Invoice No.</span></div><div class="inv-meta-cell">${esc(inv.number)}</div></div>
      <div class="inv-meta-row"><div class="inv-meta-cell"><span class="inv-meta-label">Date</span></div><div class="inv-meta-cell">${formatDate(inv.date)}</div></div>
      <div class="inv-meta-row"><div class="inv-meta-cell"><span class="inv-meta-label">Challan No.</span></div><div class="inv-meta-cell">${esc(inv.challanNo||'')}</div></div>
      <div class="inv-meta-row"><div class="inv-meta-cell"><span class="inv-meta-label">Date</span></div><div class="inv-meta-cell"></div></div>
      <div class="inv-meta-row"><div class="inv-meta-cell"><span class="inv-meta-label">P.O. No.</span></div><div class="inv-meta-cell">${esc(inv.poNo||'')}</div></div>
      <div class="inv-meta-row"><div class="inv-meta-cell"><span class="inv-meta-label">Date</span></div><div class="inv-meta-cell"></div></div>
    </div>
  </div>
  <div class="inv-billing-grid">
    <div class="inv-billing-left">
      <div class="inv-label-sm">Bill To / M/s</div>
      <div class="inv-ms">${esc(inv.customerName)}</div>
      <div class="inv-addr-text">${esc(inv.customerAddr||'').replace(/\n/g,'<br>')}</div>
      <div class="inv-gst-no"><strong>GST No. : ${esc(inv.customerGst||'')}</strong></div>
    </div>
    <div class="inv-billing-right" style="display:flex;align-items:center;justify-content:center;color:#aaa;font-size:11px;font-style:italic;padding:10px">
      &nbsp;
    </div>
  </div>
  <table class="inv-product-table">
    <thead><tr>
      <th style="width:36px">Sr.<br>No.</th>
      <th>Product Description</th>
      <th style="width:80px">SAC/HSN<br>Code</th>
      <th style="width:50px">Qty</th>
      <th style="width:80px">Rate</th>
      <th style="width:90px" colspan="2">Amount<br>Rs. &nbsp;&nbsp; Ps.</th>
    </tr></thead>
    <tbody>
      ${prods.map(p=>`<tr>
        <td class="center">${p.sr}</td><td>${esc(p.desc)}</td>
        <td class="center">${esc(p.hsn)}</td><td class="center">${p.qty}</td>
        <td class="center">${fmtNum(p.rate)}</td>
        <td class="amount-col" colspan="2">${fmtNum(p.amount)}/-</td></tr>`).join('')}
      ${emptyRows.map(()=>'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td colspan="2"></td></tr>').join('')}
    </tbody>
  </table>
  <div class="inv-footer-grid">
    <div class="inv-footer-left">
      <div class="inv-bank-section">
        <div class="inv-bank-title">Bank Details</div>
        <div class="inv-bank-detail">
          <strong>${esc(bk.name)}</strong><br>
          BRANCH : ${esc(bk.branch)}<br>
          A/C NO. ${esc(bk.acNo)}<br>
          IFSC Code : ${esc(bk.ifsc)}
        </div>
      </div>
      <div class="inv-rupees-section">
        <div class="inv-rupees-label">Rupees :</div>
        <div class="inv-rupees-words">${numberToWords(inv.netAmount)} only.</div>
      </div>
    </div>
    <div class="inv-footer-right">
      <table class="inv-totals-table">
        <tr><td class="tot-label">SUB TOTAL</td><td class="tot-val">${fmtNum(inv.subTotal)}/-</td></tr>
        <tr><td class="tot-label">${esc(inv.otherChargesLabel||'Packing Forwarding')}</td><td class="tot-val">${inv.otherCharges?fmtNum(inv.otherCharges)+'/-':''}</td></tr>
        ${isIntra?`
        <tr><td class="tot-label">SGST &nbsp; ${halfRate} %</td><td class="tot-val">${fmtNum(inv.sgst)}</td></tr>
        <tr><td class="tot-label">CGST &nbsp; ${halfRate} %</td><td class="tot-val">${fmtNum(inv.cgst)}</td></tr>`:`
        <tr><td class="tot-label">IGST &nbsp; ${gstRate} %</td><td class="tot-val">${fmtNum(inv.igst)}</td></tr>`}
        <tr><td class="tot-label">Roundoff</td><td class="tot-val">${inv.roundOff!==0?(inv.roundOff>0?'+':'')+fmtNum(inv.roundOff):''}</td></tr>
        <tr class="net-row"><td class="tot-label">NET AMOUNT</td><td class="tot-val">${fmtNum(inv.netAmount)}/-</td></tr>
      </table>
      <div style="padding:6px 8px;text-align:right;font-size:10.5px;border-top:1px solid #eee">For, <strong>${esc(co.name)}</strong></div>
    </div>
  </div>
  <div class="inv-terms-section">
    <div class="inv-terms-title">E. &amp; O. E. &nbsp;&nbsp; Terms &amp; Conditions :</div>
    <ol class="inv-terms-list">
      ${terms.length?terms.map(t=>`<li>${esc(t.replace(/^\d+[\).]?\s*/,''))}</li>`).join(''):'<li>Goods once sold will not be accepted back.</li><li>Subject to Ahmedabad Jurisdiction.</li>'}
    </ol>
  </div>
  <div class="inv-signatory-section">
    <div class="inv-eoe"></div>
    <div class="inv-sign-block">
      <div class="inv-sign-for">For,</div>
      <div class="inv-sign-company">${esc(co.name)}</div>
      <div class="inv-sign-label">${esc(signLabel)}</div>
    </div>
  </div>
</div>`;
}

/* ══════════════════════════════════════════════════════
   MODALS
══════════════════════════════════════════════════════ */
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.add('hidden'); });
});

/* ══════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════ */
let _toastTimer=null;
function showToast(msg, type='') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(type?' '+type:'');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>t.classList.add('hidden'),3400);
}

/* ══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════ */
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtNum(n) {
  return (parseFloat(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function todayISO() {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDate(iso) {
  if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`;
}
function statusBadge(st) {
  const map={paid:'badge-paid',partial:'badge-partial',pending:'badge-pending'};
  const lbl={paid:'✅ Paid',partial:'⏳ Partial',pending:'❌ Pending'};
  return `<span class="badge ${map[st]||''}">${lbl[st]||st}</span>`;
}
function numberToWords(num) {
  num=Math.round(num); if(num===0) return 'Zero';
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function convert(n){
    if(n<20) return ones[n];
    if(n<100) return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');
    if(n<1000) return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+convert(n%100):'');
    if(n<100000) return convert(Math.floor(n/1000))+' Thousand'+(n%1000?' '+convert(n%1000):'');
    if(n<10000000) return convert(Math.floor(n/100000))+' Lakh'+(n%100000?' '+convert(n%100000):'');
    return convert(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+convert(n%10000000):'');
  }
  return convert(num);
}

/* ══════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════ */
(function boot(){
  if(!localStorage.getItem('hk_users')) saveUsers(USERS_DEFAULT);
  showScreen('loginScreen');
})();

// Supabase CDN script already loaded via <script> tag in index.html
// Use window.supabase object if needed

