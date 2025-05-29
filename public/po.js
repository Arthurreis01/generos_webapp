/* ============================
   Firebase Initialization
============================ */
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyD80JCME8g97PD1fMu2xQWD6DRJp5bMFSg",
    authDomain: "generos-webapp.firebaseapp.com",
    projectId: "generos-webapp",
    storageBucket: "generos-webapp.firebasestorage.app",
    messagingSenderId: "874489491002",
    appId: "1:874489491002:web:46f893c170bbd944cb8f03",
    measurementId: "G-Y3VQW229XW"
  });
}
const db = firebase.firestore();

/* ============================
   Global Variables & Sorting State
============================ */
let agendamentos = [];
let ocListData = [];
let selectedAgendamento = null;
const sortDirection = {};  // track asc/desc per field

/* ============================
   Helper Functions
============================ */
function parseNumberBR(num) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatDateBR(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR");
}

function formatDateWithAlert(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  let dateContent = d.toLocaleDateString("pt-BR");
  const today = new Date();
  today.setHours(0,0,0,0);
  if (d < today) {
    dateContent += ` <i class="bi bi-exclamation-triangle-fill text-warning" title="Data expirada"></i>`;
  }
  return dateContent;
}

function renderStatusBadge(status) {
  if (status === "Pendente")    return '<span class="badge bg-warning text-dark">Pendente</span>';
  if (status === "Arrecadado")  return '<span class="badge bg-success">Arrecadado</span>';
  if (status === "Em pericia")  return '<span class="badge bg-info text-dark">Em perícia</span>';
  return `<span class="badge bg-secondary">${status}</span>`;
}

function openModal(el) {
  if (el) new bootstrap.Modal(el).show();
}

/* ============================
   Open “Adicionar Agendamento”
============================ */
function openAddModal() {
  document.getElementById("formAgendamento").reset();
  openModal(document.getElementById("addModal"));
}

/* ============================
   Load Licitação/OC Options
============================ */
async function loadOcList() {
  try {
    const licSnapshot = await db.collection("licitacoes").get();
    ocListData = [];
    licSnapshot.forEach(doc => {
      const lic = doc.data();
      if (lic.ocs && lic.ocs.length) {
        lic.ocs.forEach(oc => {
          ocListData.push({
            licDocId: doc.id,
            oc: oc.codigo,
            numeroProcesso: lic.numeroProcesso || "",
            pi: lic.pi       || "",
            itemSolicitado: lic.itemSolicitado || ""
          });
        });
      }
    });
    filterOcOptions();
  } catch (err) {
    console.error("Erro ao carregar OCs:", err);
  }
}

function filterOcOptions() {
  const searchInput = document.getElementById("ocSearchInput").value.toLowerCase();
  const select = document.getElementById("selectOC");
  select.innerHTML = "";
  let matches = 0;
  ocListData.forEach(obj => {
    const haystack = `oc ${obj.oc} pi ${obj.pi} ${obj.itemSolicitado}`.toLowerCase();
    if (!searchInput || haystack.includes(searchInput)) {
      const opt = document.createElement("option");
      opt.value = JSON.stringify(obj);
      opt.textContent = `OC ${obj.oc} – PI ${obj.pi} – ${obj.itemSolicitado}`;
      select.appendChild(opt);
      matches++;
    }
  });
  if (matches === 0) {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Nenhum resultado para a busca.";
    select.appendChild(none);
  }
}

/* ============================
   Load & Render Agendamentos
============================ */
async function loadAgendamentos() {
  try {
    agendamentos = [];
    const snap = await db.collection("pos").get();
    snap.forEach(doc => {
      const ag = doc.data();
      ag.docId = doc.id;
      agendamentos.push(ag);
    });
    renderAgendamentos();
  } catch (err) {
    console.error("Erro ao carregar agendamentos:", err);
  }
}

function showObs(docId) {
  const ag = agendamentos.find(a => a.docId === docId);
  if (!ag) return;
  document.getElementById('obsModalBody').textContent = ag.obs || '(sem observação)';
  openModal(document.getElementById('obsModal'));
}

function renderAgendamentos(list = agendamentos) {
  // default sort by date desc
  list.sort((a,b) => new Date(b.dataPrevista) - new Date(a.dataPrevista));
  const tbody = document.getElementById("agendaTbody");
  tbody.innerHTML = "";
  list.forEach(ag => {
    let btns = `
      <button class="btn btn-sm btn-secondary me-1" title="Editar"
              onclick="toggleEditRow('${ag.docId}', this)">
        <i class="bi bi-pencil-square"></i>
      </button>
      <button class="btn btn-sm btn-danger me-1" title="Excluir"
              onclick="deleteAgendamento('${ag.docId}')">
        <i class="bi bi-trash"></i>
      </button>
    `;
    if (ag.status === "Pendente") {
      btns += `
        <button class="btn btn-sm btn-primary me-1" title="Recebimento"
                onclick="openRecebimentoModal('${ag.docId}')">
          <i class="bi bi-box-seam"></i>
        </button>`;
    } else if (ag.status === "Em pericia") {
      btns += `
        <button class="btn btn-sm btn-warning me-1" title="Perícia"
                onclick="openPericiaModal('${ag.docId}')">
          <i class="bi bi-question-octagon"></i>
        </button>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateWithAlert(ag.dataPrevista)}</td>
      <td contenteditable="false" data-field="itemSolicitado">${ag.itemSolicitado}</td>
      <td contenteditable="false" data-field="qtd">${parseNumberBR(ag.qtd)}</td>
      <td contenteditable="false" data-field="oc">${ag.oc}</td>
      <td contenteditable="false" data-field="fornecedor">${ag.fornecedor}</td>
      <td contenteditable="false" data-field="notaFiscal">${ag.notaFiscal}</td>
      <td contenteditable="false" data-field="obs">${ag.obs||''}</td>
      <td contenteditable="false" data-field="status">${renderStatusBadge(ag.status)}</td>
      <td contenteditable="false" data-field="dataRecebimento">
        ${ag.dataRecebimento?formatDateBR(ag.dataRecebimento):''}
      </td>
      <td contenteditable="false" data-field="dataPericia">
        ${ag.dataPericia?formatDateBR(ag.dataPericia):''}
      </td>
      <td class="text-center">${btns}</td>
    `;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('[data-bs-toggle="tooltip"]')
          .forEach(el => new bootstrap.Tooltip(el));
}

/* ============================
   Sorting & Filtering Helpers
============================ */
function sortByField(field) {
  sortDirection[field] = !sortDirection[field];
  const sorted = [...agendamentos].sort((a,b) => {
    let va=a[field]||"", vb=b[field]||"";
    if (field==="qtd") { va=parseFloat(va); vb=parseFloat(vb); }
    if (va<vb) return sortDirection[field]? -1:1;
    if (va>vb) return sortDirection[field]? 1:-1;
    return 0;
  });
  renderAgendamentos(sorted);
}

function filterByMonth(name) {
  const months = ['january','february','march','april','may','june',
                  'july','august','september','october','november','december'];
  const m = months.indexOf(name.toLowerCase());
  if (m<0) { renderAgendamentos(); return; }
  const filtered = agendamentos.filter(ag => new Date(ag.dataPrevista).getMonth()===m);
  renderAgendamentos(filtered);
}

function applyTableFilter() {
  const text = document.getElementById("tableSearchInput").value.toLowerCase();
  const range= document.getElementById("dateRange").value;
  let from,to;
  if(range.includes(' - ')) [from,to] = range.split(' - ');
  const filtered = agendamentos.filter(ag => {
    const hay = `${ag.dataPrevista} ${ag.itemSolicitado} ${ag.oc} ${ag.fornecedor} ${ag.notaFiscal} ${ag.obs}`.toLowerCase();
    if (text && !hay.includes(text)) return false;
    if (from && to) {
      if (!ag.dataPrevista) return false;
      if (ag.dataPrevista<from||ag.dataPrevista>to) return false;
    }
    return true;
  });
  renderAgendamentos(filtered);
}

/* ============================
   CRUD & OC Updates
============================ */
async function deleteAgendamento(docId) {
  if (!confirm("Tem certeza de que deseja excluir este agendamento?")) return;
  try {
    await db.collection("pos").doc(docId).delete();
    agendamentos = agendamentos.filter(ag => ag.docId!==docId);
    renderAgendamentos();
    alert("Agendamento excluído com sucesso!");
  } catch(err) {
    console.error("Erro ao excluir agendamento:", err);
    alert("Erro ao excluir agendamento.");
  }
}

function toggleEditRow(poId,btn) {
  const tr = btn.closest("tr");
  const editing = tr.classList.contains("editing");
  const tip = bootstrap.Tooltip.getInstance(btn);
  if (!editing) {
    tr.classList.add("editing");
    btn.classList.replace("btn-secondary","btn-success");
    btn.setAttribute("title","Confirmar");
    if(tip) tip.dispose();
    new bootstrap.Tooltip(btn);
    btn.innerHTML = '<i class="bi bi-check-circle"></i>';
    tr.querySelectorAll("[contenteditable]").forEach(cell=>{
      cell.contentEditable="true";
      cell.classList.add("editable");
    });
  } else {
    if(btn.classList.contains("btn-success")) {
      if(!confirm("Deseja salvar as alterações deste registro?")) {
        tr.classList.remove("editing");
        btn.classList.replace("btn-success","btn-secondary");
        btn.setAttribute("title","Editar");
        if(tip) tip.dispose();
        new bootstrap.Tooltip(btn);
        btn.innerHTML = '<i class="bi bi-pencil-square"></i>';
        tr.querySelectorAll("[contenteditable]").forEach(cell=>{
          cell.contentEditable="false";
          cell.classList.remove("editable");
        });
        renderAgendamentos();
        return;
      }
      saveRowChanges(poId, tr);
    }
    tr.classList.remove("editing");
    btn.classList.replace("btn-success","btn-secondary");
    btn.setAttribute("title","Editar");
    if(tip) tip.dispose();
    new bootstrap.Tooltip(btn);
    btn.innerHTML = '<i class="bi bi-pencil-square"></i>';
    tr.querySelectorAll("[contenteditable]").forEach(cell=>{
      cell.contentEditable="false";
      cell.classList.remove("editable");
    });
  }
}

async function saveRowChanges(poId,tr) {
  const updateObj = {};
  tr.querySelectorAll("[contenteditable]").forEach(cell=>{
    const fld=cell.getAttribute("data-field");
    if(!fld) return;
    let val=cell.textContent.trim();
    if(fld==="qtd") val=parseFloat(val.replace(/\./g,"").replace(",","."))||0;
    updateObj[fld]=val;
  });
  try {
    await db.collection("pos").doc(poId).update(updateObj);
    agendamentos = agendamentos.map(ag=>ag.docId===poId?{...ag,...updateObj}:ag);
    alert("Registro atualizado com sucesso!");
  } catch(err) {
    console.error("Erro ao salvar alterações:", err);
    alert("Erro ao salvar alterações.");
  }
  renderAgendamentos();
}

document.getElementById("formAgendamento")
  .addEventListener("submit", async function(e){
    e.preventDefault();
    const fd = new FormData(e.target);
    const ocVal = document.getElementById("selectOC").value;
    if(!ocVal){ alert("Selecione um OC!"); return;}
    const ocData = JSON.parse(ocVal);
    const newAg = {
      dataPrevista: fd.get("dataPrevista"),
      qtd: parseFloat(fd.get("qtd"))||0,
      fornecedor: fd.get("fornecedor"),
      notaFiscal: fd.get("notaFiscal"),
      obs: fd.get("obs"),
      status: "Pendente",
      oc: ocData.oc,
      itemSolicitado: ocData.itemSolicitado||"",
      pi: ocData.pi
    };
    try {
      const docRef = await db.collection("pos").add(newAg);
      newAg.docId = docRef.id;
      agendamentos.push(newAg);
      renderAgendamentos();
      e.target.reset();
      bootstrap.Modal.getInstance(
        document.getElementById("addModal")
      ).hide();
      if(newAg.pi && typeof window.verificarOCsByItem==="function")
        window.verificarOCsByItem(newAg.pi);
    } catch(err){
      console.error("Erro ao adicionar agendamento:", err);
      alert("Erro ao adicionar. Tente novamente.");
    }
});

/* Recebimento */
function openRecebimentoModal(docId){
  selectedAgendamento = docId;
  document.getElementById("formRecebimento").reset();
  openModal(document.getElementById("recebimentoModal"));
}
document.getElementById("formRecebimento")
  .addEventListener("submit", async function(e){
    e.preventDefault();
    if(!selectedAgendamento) return;
    const fd = new FormData(e.target);
    const dataRec = fd.get("dataRecebimento");
    const qtdRec  = parseFloat(fd.get("qtdRecebida"))||0;
    if(!dataRec){ alert("Preencha a data de recebimento."); return;}
    const updateObj = {
      status: "Em pericia",
      dataRecebimento: dataRec,
      qtdRecebida: qtdRec
    };
    try {
      await db.collection("pos").doc(selectedAgendamento).update(updateObj);
      agendamentos = agendamentos.map(ag=>
        ag.docId===selectedAgendamento?{...ag,...updateObj}:ag
      );
      renderAgendamentos();
      const upd = agendamentos.find(ag=>ag.docId===selectedAgendamento);
      if(upd && upd.pi){
        await updateOCForRecebimento(upd.pi, upd.oc, qtdRec);
        if(typeof window.verificarOCsByItem==="function")
          window.verificarOCsByItem(upd.pi);
      }
      selectedAgendamento = null;
      bootstrap.Modal.getInstance(
        document.getElementById("recebimentoModal")
      ).hide();
    } catch(err){
      console.error("Erro ao atualizar recebimento:", err);
      alert("Erro ao atualizar recebimento.");
    }
});

/* Perícia */
function openPericiaModal(docId){
  selectedAgendamento = docId;
  openModal(document.getElementById("periciaModal"));
}
document.getElementById("btnPericiaOk")
  .addEventListener("click", async function(){
    if(!selectedAgendamento) return;
    const now = new Date().toISOString().split("T")[0];
    const updateObj = { status:"Arrecadado", dataPericia: now };
    try {
      await db.collection("pos").doc(selectedAgendamento).update(updateObj);
      agendamentos = agendamentos.map(ag=>
        ag.docId===selectedAgendamento?{...ag,...updateObj}:ag
      );
      renderAgendamentos();
      const upd = agendamentos.find(ag=>ag.docId===selectedAgendamento);
      const qtdRec = upd.qtdRecebida||0;
      if(upd && upd.pi){
        await updateOCForPericia(upd.pi, upd.oc, qtdRec);
        if(typeof window.verificarOCsByItem==="function")
          window.verificarOCsByItem(upd.pi);
      }
      selectedAgendamento = null;
      bootstrap.Modal.getInstance(
        document.getElementById("periciaModal")
      ).hide();
    } catch(err){
      console.error("Erro ao atualizar perícia:", err);
      alert("Erro ao atualizar perícia.");
    }
});
document.getElementById("btnPericiaPendencia")
  .addEventListener("click", async function(){
    if(!selectedAgendamento) return;
    const now = new Date().toISOString().split("T")[0];
    const updateObj = { status:"Pendente", dataPericia: now };
    try {
      await db.collection("pos").doc(selectedAgendamento).update(updateObj);
      agendamentos = agendamentos.map(ag=>
        ag.docId===selectedAgendamento?{...ag,...updateObj}:ag
      );
      renderAgendamentos();
      const upd = agendamentos.find(ag=>ag.docId===selectedAgendamento);
      if(upd && upd.pi && typeof window.verificarOCsByItem==="function")
        window.verificarOCsByItem(upd.pi);
      selectedAgendamento = null;
      bootstrap.Modal.getInstance(
        document.getElementById("periciaModal")
      ).hide();
    } catch(err){
      console.error("Erro ao atualizar pendência:", err);
      alert("Erro ao atualizar pendência.");
    }
});

/* Atualiza OC após recebimento */
async function updateOCForRecebimento(pi, ocCode, quantidade) {
  try {
    const licQ = await db.collection("licitacoes").where("pi","==",pi).get();
    licQ.forEach(async doc => {
      let lic = doc.data(), updated = false;
      lic.ocs = lic.ocs.map(oc => {
        if (oc.codigo === ocCode) {
          oc.qtdePericia = (oc.qtdePericia||0) + quantidade;
          updated = true;
        }
        return oc;
      });
      if (updated) await db.collection("licitacoes").doc(doc.id).update({ ocs: lic.ocs });
    });
  } catch(err) { console.error("Erro OC recebimento:",err); }
}

/* Atualiza OC após perícia */
async function updateOCForPericia(pi, ocCode, quantidade) {
  try {
    const licQ = await db.collection("licitacoes").where("pi","==",pi).get();
    licQ.forEach(async doc => {
      let lic = doc.data(), updated = false;
      lic.ocs = lic.ocs.map(oc => {
        if (oc.codigo === ocCode) {
          oc.qtdePericia    = Math.max(0,(oc.qtdePericia||0) - quantidade);
          oc.qtdeArrecadada = (oc.qtdeArrecadada||0) + quantidade;
          updated = true;
        }
        return oc;
      });
      if (updated) await db.collection("licitacoes").doc(doc.id).update({ ocs: lic.ocs });
    });
  } catch(err) { console.error("Erro OC perícia:",err); }
}

/* ============================
   Init on DOM Ready
============================ */
document.addEventListener("DOMContentLoaded", () => {
  loadAgendamentos();
  loadOcList();

  // month tabs filtering
  document.querySelectorAll('.nav-pills .nav-link').forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-pills .nav-link').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterByMonth(tab.textContent.trim());
    });
  });

  // column sorting
  document.querySelectorAll('.sort-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const fields = [
        'dataPrevista','itemSolicitado','qtd','oc','fornecedor',
        'notaFiscal','obs','status','dataRecebimento','dataPericia'
      ];
      sortByField(fields[idx]);
    });
  });

  // enable tooltips
  document.querySelectorAll('[data-bs-toggle="tooltip"]')
          .forEach(el => new bootstrap.Tooltip(el));

  // ───────── Export to XLSX ─────────
  document.getElementById('btnExportExcel')
          .addEventListener('click', () => exportTableToXLSX('agendamentos.xlsx'));
});

/* ============================
   Export Table to XLSX
   (requires include of xlsx.full.min.js in your HTML)
============================ */
function exportTableToXLSX(filename = 'agendamentos.xlsx') {
  const table = document.getElementById('agendaTable');
  const wb = XLSX.utils.table_to_book(table, { sheet: "Agendamentos" });
  XLSX.writeFile(wb, filename);
}
