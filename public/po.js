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
   Global Variables
============================ */
let agendamentos = [];        
let ocListData = [];          
let selectedAgendamento = null;

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
  today.setHours(0, 0, 0, 0);
  if (d < today) {
    dateContent += ` <i class="bi bi-exclamation-triangle-fill text-warning" title="Data expirada"></i>`;
  }
  return dateContent;
}

function openModal(modalElem) {
  if (modalElem) {
    const modalInstance = new bootstrap.Modal(modalElem);
    modalInstance.show();
  }
}

// Render status badge with color
function renderStatusBadge(status) {
  if (status === "Pendente") {
    return '<span class="badge bg-warning text-dark">Pendente</span>';
  } else if (status === "Arrecadado") {
    return '<span class="badge bg-success">Arrecadado</span>';
  } else if (status === "Em pericia") {
    return '<span class="badge bg-info text-dark">Em perícia</span>';
  } else {
    return '<span class="badge bg-secondary">' + status + '</span>';
  }
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
      if (lic.ocs && lic.ocs.length > 0) {
        lic.ocs.forEach(oc => {
          ocListData.push({
            licDocId: doc.id,
            oc: oc.codigo,
            numeroProcesso: lic.numeroProcesso || "",
            pi: lic.pi || "",
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
    const searchStr = `oc ${obj.oc} pi ${obj.pi} ${obj.itemSolicitado}`.toLowerCase();
    if (!searchInput || searchStr.includes(searchInput)) {
      const option = document.createElement("option");
      option.value = JSON.stringify(obj);
      option.textContent = `OC ${obj.oc} - PI ${obj.pi}`;
      select.appendChild(option);
      matches++;
    }
  });
  if (matches === 0) {
    const noMatch = document.createElement("option");
    noMatch.value = "";
    noMatch.textContent = "Nenhum resultado para a busca.";
    select.appendChild(noMatch);
  }
}

/* ============================
   Load & Render Agendamentos
============================ */
async function loadAgendamentos() {
  try {
    agendamentos = [];
    const snapshot = await db.collection("pos").get();
    snapshot.forEach(doc => {
      const ag = doc.data();
      ag.docId = doc.id;
      agendamentos.push(ag);
    });
    renderAgendamentos();
  } catch (err) {
    console.error("Erro ao carregar agendamentos:", err);
  }
}

function renderAgendamentos() {
  // Ordena por dataPrevista (mais recente primeiro)
  agendamentos.sort((a, b) => new Date(b.dataPrevista) - new Date(a.dataPrevista));

  const tbody = document.getElementById("agendaTbody");
  tbody.innerHTML = "";

  agendamentos.forEach((ag) => {
    // Botões de ações: 1) Editar, 2) Excluir, 3) Recebimento (se Pendente), 4) Perícia (se Arrecadado e sem dataPericia)
    let actionButtons = `
      <button class="btn btn-sm btn-secondary me-1" data-bs-toggle="tooltip" data-bs-container="body" title="Editar" onclick="toggleEditRow('${ag.docId}', this)">
        <i class="bi bi-pencil-square"></i>
      </button>
      <button class="btn btn-sm btn-danger me-1" data-bs-toggle="tooltip" data-bs-container="body" title="Excluir" onclick="deleteAgendamento('${ag.docId}')">
        <i class="bi bi-trash"></i>
      </button>
    `;
    if (ag.status === "Pendente") {
      actionButtons += `
        <button class="btn btn-sm btn-primary me-1" data-bs-toggle="tooltip" data-bs-container="body" title="Recebimento" onclick="openRecebimentoModal('${ag.docId}')">
          <i class="bi bi-box-seam"></i>
        </button>
      `;
    } else if (ag.status === "Arrecadado" && !ag.dataPericia) {
      actionButtons += `
        <button class="btn btn-sm btn-warning me-1" data-bs-toggle="tooltip" data-bs-container="body" title="Perícia" onclick="openPericiaModal('${ag.docId}')">
          <i class="bi bi-question-octagon"></i>
        </button>
      `;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateWithAlert(ag.dataPrevista)}</td>
      <td contenteditable="false" data-field="itemSolicitado">${ag.itemSolicitado || ""}</td>
      <td contenteditable="false" data-field="qtd">${parseNumberBR(ag.qtd)}</td>
      <td contenteditable="false" data-field="oc">${ag.oc || ""}</td>
      <td contenteditable="false" data-field="fornecedor">${ag.fornecedor || ""}</td>
      <td contenteditable="false" data-field="notaFiscal">${ag.notaFiscal || ""}</td>
      <td contenteditable="false" data-field="obs">${ag.obs || ""}</td>
      <td contenteditable="false" data-field="status">${renderStatusBadge(ag.status)}</td>
      <td>${ag.dataRecebimento ? formatDateBR(ag.dataRecebimento) : ""}</td>
      <td>${ag.dataPericia ? formatDateBR(ag.dataPericia) : ""}</td>
      <td class="text-center">${actionButtons}</td>
    `;
    tbody.appendChild(tr);
  });

  // Reativa os tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(el => new bootstrap.Tooltip(el));
}

/**
 * Exclui um agendamento após confirmação.
 */
async function deleteAgendamento(docId) {
  if (!confirm("Tem certeza de que deseja excluir este agendamento?")) return;
  try {
    await db.collection("pos").doc(docId).delete();
    agendamentos = agendamentos.filter(ag => ag.docId !== docId);
    renderAgendamentos();
    alert("Agendamento excluído com sucesso!");
  } catch (err) {
    console.error("Erro ao excluir agendamento:", err);
    alert("Erro ao excluir agendamento.");
  }
}

/**
 * Alterna o modo de edição de uma linha.
 */
function toggleEditRow(poId, btn) {
  const tr = btn.closest("tr");
  const isEditing = tr.classList.contains("editing");
  
  if (!isEditing) {
    tr.classList.add("editing");
    btn.innerHTML = '<i class="bi bi-check-circle"></i>';
    btn.setAttribute("title", "Confirmar");
    btn.setAttribute("data-bs-original-title", "Confirmar");
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      cell.contentEditable = "true";
      cell.classList.add("editable");
    });
  } else {
    if (!confirm("Deseja salvar as alterações deste registro?")) {
      tr.classList.remove("editing");
      btn.innerHTML = '<i class="bi bi-pencil-square"></i>';
      btn.setAttribute("title", "Editar");
      btn.setAttribute("data-bs-original-title", "Editar");
      tr.querySelectorAll("[contenteditable]").forEach(cell => {
        cell.contentEditable = "false";
        cell.classList.remove("editable");
      });
      renderAgendamentos();
      return;
    }
    saveRowChanges(poId, tr);
    tr.classList.remove("editing");
    btn.innerHTML = '<i class="bi bi-pencil-square"></i>';
    btn.setAttribute("title", "Editar");
    btn.setAttribute("data-bs-original-title", "Editar");
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      cell.contentEditable = "false";
      cell.classList.remove("editable");
    });
  }
}

/**
 * Salva as alterações de edição no Firestore e atualiza o painel OC.
 */
async function saveRowChanges(poId, tr) {
  let updateObj = {};
  tr.querySelectorAll("[contenteditable]").forEach(cell => {
    const field = cell.getAttribute("data-field");
    if (!field) return;
    if (field === "qtd") {
      updateObj[field] = parseFloat(cell.textContent.replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      updateObj[field] = cell.textContent.trim();
    }
  });
  
  try {
    await db.collection("pos").doc(poId).update(updateObj);
    agendamentos = agendamentos.map(ag => ag.docId === poId ? { ...ag, ...updateObj } : ag);
    alert("Registro atualizado com sucesso!");
    // ----- CHAMADA DE INTEGRAÇÃO -----
    const updatedAg = agendamentos.find(ag => ag.docId === poId);
    if (updatedAg && updatedAg.pi && typeof window.verificarOCsByItem === "function") {
      window.verificarOCsByItem(updatedAg.pi);
    }
  } catch (err) {
    console.error("Erro ao salvar alterações:", err);
    alert("Erro ao salvar alterações.");
  }
  renderAgendamentos();
}

/* ============================
   Form Submission: Adicionar Agendamento
============================ */
document.getElementById("formAgendamento").addEventListener("submit", async function(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const ocVal = document.getElementById("selectOC").value;
  if (!ocVal) {
    alert("Selecione um OC!");
    return;
  }
  const ocData = JSON.parse(ocVal);
  const newAg = {
    dataPrevista: fd.get("dataPrevista"),
    qtd: parseFloat(fd.get("qtd")) || 0,
    fornecedor: fd.get("fornecedor"),
    notaFiscal: fd.get("notaFiscal"),
    obs: fd.get("obs"),
    status: "Pendente",
    oc: ocData.oc,
    itemSolicitado: ocData.itemSolicitado || "",
    pi: ocData.pi
  };
  try {
    const docRef = await db.collection("pos").add(newAg);
    newAg.docId = docRef.id;
    agendamentos.push(newAg);
    renderAgendamentos();
    e.target.reset();
    bootstrap.Modal.getInstance(document.getElementById("addModal")).hide();
    if (newAg.pi && typeof window.verificarOCsByItem === "function") {
      window.verificarOCsByItem(newAg.pi);
    }
  } catch (err) {
    console.error("Erro ao adicionar agendamento:", err);
    alert("Erro ao adicionar. Tente novamente.");
  }
});

/* ============================
   Recebimento => Atualização de OC
============================ */
function openRecebimentoModal(docId) {
  selectedAgendamento = docId;
  document.getElementById("formRecebimento").reset();
  openModal(document.getElementById("recebimentoModal"));
}

document.getElementById("formRecebimento").addEventListener("submit", async function(e) {
  e.preventDefault();
  if (!selectedAgendamento) return;
  const fd = new FormData(e.target);
  const dataRecebimento = fd.get("dataRecebimento");
  const qtdRecebida = parseFloat(fd.get("qtdRecebida")) || 0;
  if (!dataRecebimento) {
    alert("Preencha a data de recebimento.");
    return;
  }
  const updateObj = {
    status: "Arrecadado",
    dataRecebimento,
    qtd: qtdRecebida,
    qtdRecebida
  };
  try {
    await db.collection("pos").doc(selectedAgendamento).update(updateObj);
    agendamentos = agendamentos.map(ag =>
      ag.docId === selectedAgendamento ? { ...ag, ...updateObj } : ag
    );
    renderAgendamentos();
    const updatedAg = agendamentos.find(ag => ag.docId === selectedAgendamento);
    // Integration: update corresponding OC for RECEBIMENTO by adding the received quantity to qtdePericia.
    if (updatedAg && updatedAg.pi) {
      await updateOCForRecebimento(updatedAg.pi, updatedAg.oc, qtdRecebida);
      if (typeof window.verificarOCsByItem === "function") {
        window.verificarOCsByItem(updatedAg.pi);
      }
    }
    selectedAgendamento = null;
    bootstrap.Modal.getInstance(document.getElementById("recebimentoModal")).hide();
  } catch (err) {
    console.error("Erro ao atualizar recebimento:", err);
    alert("Erro ao atualizar recebimento.");
  }
});

/* ============================
   Perícia => Atualização de OC
============================ */
function openPericiaModal(docId) {
  selectedAgendamento = docId;
  openModal(document.getElementById("periciaModal"));
}

document.getElementById("btnPericiaOk").addEventListener("click", async function() {
  if (!selectedAgendamento) return;
  const now = new Date().toISOString().split("T")[0];
  const updateObj = { status: "Arrecadado", dataPericia: now };
  try {
    await db.collection("pos").doc(selectedAgendamento).update(updateObj);
    agendamentos = agendamentos.map(ag =>
      ag.docId === selectedAgendamento ? { ...ag, ...updateObj } : ag
    );
    renderAgendamentos();
    const updatedAg = agendamentos.find(ag => ag.docId === selectedAgendamento);
    // Integration: move the received quantity from Pericia to Arrecadado.
    const quantidade = updatedAg.qtdRecebida || 0;
    if (updatedAg && updatedAg.pi) {
      await updateOCForPericia(updatedAg.pi, updatedAg.oc, quantidade);
      if (typeof window.verificarOCsByItem === "function") {
        window.verificarOCsByItem(updatedAg.pi);
      }
    }
    selectedAgendamento = null;
    bootstrap.Modal.getInstance(document.getElementById("periciaModal")).hide();
  } catch (err) {
    console.error("Erro ao atualizar perícia:", err);
    alert("Erro ao atualizar perícia.");
  }
});

document.getElementById("btnPericiaPendencia").addEventListener("click", async function() {
  if (!selectedAgendamento) return;
  const now = new Date().toISOString().split("T")[0];
  const updateObj = { status: "Pendente", dataPericia: now };
  try {
    await db.collection("pos").doc(selectedAgendamento).update(updateObj);
    agendamentos = agendamentos.map(ag =>
      ag.docId === selectedAgendamento ? { ...ag, ...updateObj } : ag
    );
    renderAgendamentos();
    const updatedAg = agendamentos.find(ag => ag.docId === selectedAgendamento);
    if (updatedAg && updatedAg.pi && typeof window.verificarOCsByItem === "function") {
      window.verificarOCsByItem(updatedAg.pi);
    }
    selectedAgendamento = null;
    bootstrap.Modal.getInstance(document.getElementById("periciaModal")).hide();
  } catch (err) {
    console.error("Erro ao atualizar pendência:", err);
    alert("Erro ao atualizar pendência.");
  }
});

/* ============================
   Table Filtering
============================ */
function applyTableFilter() {
  const searchVal = document.getElementById("tableSearchInput").value.toLowerCase();
  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo = document.getElementById("dateTo").value;
  
  const filtered = agendamentos.filter(ag => {
    const haystack = `
      ${ag.dataPrevista} 
      ${ag.itemSolicitado} 
      ${ag.oc} 
      ${ag.fornecedor} 
      ${ag.notaFiscal} 
      ${ag.obs}
    `.toLowerCase();
    if (searchVal && !haystack.includes(searchVal)) return false;
    if (dateFrom && ag.dataPrevista && ag.dataPrevista < dateFrom) return false;
    if (dateTo && ag.dataPrevista && ag.dataPrevista > dateTo) return false;
    return true;
  });
  
  filtered.sort((a, b) => new Date(b.dataPrevista) - new Date(a.dataPrevista));
  
  const tbody = document.getElementById("agendaTbody");
  tbody.innerHTML = "";
  filtered.forEach(ag => {
    let actionButtons = `
      <button class="btn btn-sm btn-secondary me-1" data-bs-toggle="tooltip" data-bs-container="body" title="Editar" onclick="toggleEditRow('${ag.docId}', this)">
        <i class="bi bi-pencil-square"></i>
      </button>
      <button class="btn btn-sm btn-danger me-1" data-bs-toggle="tooltip" data-bs-container="body" title="Excluir" onclick="deleteAgendamento('${ag.docId}')">
        <i class="bi bi-trash"></i>
      </button>
    `;
    if (ag.status === "Pendente") {
      actionButtons += `
        <button class="btn btn-sm btn-primary me-1" data-bs-toggle="tooltip" data-bs-container="body" title="Recebimento" onclick="openRecebimentoModal('${ag.docId}')">
          <i class="bi bi-box-seam"></i>
        </button>
      `;
    } else if (ag.status === "Arrecadado" && !ag.dataPericia) {
      actionButtons += `
        <button class="btn btn-sm btn-warning me-1" data-bs-toggle="tooltip" data-bs-container="body" title="Perícia" onclick="openPericiaModal('${ag.docId}')">
          <i class="bi bi-question-octagon"></i>
        </button>
      `;
    }
  
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateWithAlert(ag.dataPrevista)}</td>
      <td contenteditable="false" data-field="itemSolicitado">${ag.itemSolicitado || ""}</td>
      <td contenteditable="false" data-field="qtd">${parseNumberBR(ag.qtd)}</td>
      <td contenteditable="false" data-field="oc">${ag.oc || ""}</td>
      <td contenteditable="false" data-field="fornecedor">${ag.fornecedor || ""}</td>
      <td contenteditable="false" data-field="notaFiscal">${ag.notaFiscal || ""}</td>
      <td contenteditable="false" data-field="obs">${ag.obs || ""}</td>
      <td contenteditable="false" data-field="status">${renderStatusBadge(ag.status)}</td>
      <td>${ag.dataRecebimento ? formatDateBR(ag.dataRecebimento) : ""}</td>
      <td>${ag.dataPericia ? formatDateBR(ag.dataPericia) : ""}</td>
      <td class="text-center">${actionButtons}</td>
    `;
    tbody.appendChild(tr);
  });
  
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(el => new bootstrap.Tooltip(el));
}

// Carrega os dados iniciais quando o DOM estiver pronto.
document.addEventListener("DOMContentLoaded", function() {
  loadAgendamentos();
  loadOcList();
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(el => new bootstrap.Tooltip(el));
});

/* ---------- New Functions for OC Integration ---------- */

// When the receiving process is done, add the received quantity to the OC's qtdePericia.
async function updateOCForRecebimento(pi, ocCode, quantidade) {
  try {
    const licQuery = await db.collection("licitacoes").where("pi", "==", pi).get();
    licQuery.forEach(async (doc) => {
      let lic = doc.data();
      let updated = false;
      if (lic.ocs && lic.ocs.length > 0) {
        lic.ocs = lic.ocs.map(oc => {
          if (oc.codigo === ocCode) {
            oc.qtdePericia = (oc.qtdePericia || 0) + quantidade;
            updated = true;
          }
          return oc;
        });
      }
      if (updated) {
        await db.collection("licitacoes").doc(doc.id).update({
          ocs: lic.ocs
        });
      }
    });
  } catch (err) {
    console.error("Erro ao atualizar OC para recebimento:", err);
  }
}

// When the pericia process is confirmed, move the quantity from qtdePericia to qtdeArrecadada.
async function updateOCForPericia(pi, ocCode, quantidade) {
  try {
    const licQuery = await db.collection("licitacoes").where("pi", "==", pi).get();
    licQuery.forEach(async (doc) => {
      let lic = doc.data();
      let updated = false;
      if (lic.ocs && lic.ocs.length > 0) {
        lic.ocs = lic.ocs.map(oc => {
          if (oc.codigo === ocCode) {
            oc.qtdePericia = Math.max(0, (oc.qtdePericia || 0) - quantidade);
            oc.qtdeArrecadada = (oc.qtdeArrecadada || 0) + quantidade;
            updated = true;
          }
          return oc;
        });
      }
      if (updated) {
        await db.collection("licitacoes").doc(doc.id).update({
          ocs: lic.ocs
        });
      }
    });
  } catch (err) {
    console.error("Erro ao atualizar OC para pericia:", err);
  }
}
