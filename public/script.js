document.addEventListener("DOMContentLoaded", async function() {
  // -------------------------
  // Firebase configuration and initialization
  // -------------------------
  const firebaseConfig = {
    apiKey: "AIzaSyD80JCME8g97PD1fMu2xQWD6DRJp5bMFSg",
    authDomain: "generos-webapp.firebaseapp.com",
    projectId: "generos-webapp",
    storageBucket: "generos-webapp.firebasestorage.app",
    messagingSenderId: "874489491002",
    appId: "1:874489491002:web:46f893c170bbd944cb8f03",
    measurementId: "G-Y3VQW229XW"
  };
  firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore();

  // -------------------------
  // Security: Password check
  // -------------------------


  // -------------------------
  // Data arrays and counters
  // -------------------------
  let licitacoes = [];
  let pos = [];
  let licitacaoIdCounter = 1;
  let poIdCounter = 1;

  // -------------------------
  // DOM Elements
  // -------------------------
  const fab = document.querySelector('.fab');
  const fabMenu = document.getElementById('fabMenu');

  // Import Estoque elements
  const fileEstoqueInput = document.getElementById('fileEstoque');
  const btnImportEstoque = document.getElementById('btnImportEstoque');

  // Modals
  const modalLicitacao = document.getElementById('modalLicitacao');
  const modalEditLicitacao = document.getElementById('modalEditLicitacao');
  const modalPO = document.getElementById('modalPO');
  const modalEditPO = document.getElementById('modalEditPO');
  const modalVerificarOCs = document.getElementById('modalVerificarOCs');
  const modalComentarios = document.getElementById('modalComentarios');
  const modalPODetails = document.getElementById('modalPODetails');
  const modalLicitacaoInfo = document.getElementById('modalLicitacaoInfo'); // NEW

  // Forms
  const formLicitacao = document.getElementById('formLicitacao');
  const formEditLicitacao = document.getElementById('formEditLicitacao');
  const formPO = document.getElementById('formPO');
  const formEditPO = document.getElementById('formEditPO');
  const formComentarios = document.getElementById('formComentarios');

  // Dropdowns for PO forms
  const licitacaoSelect = document.getElementById('licitacaoSelect');
  const editLicitacaoSelect = document.getElementById('editLicitacaoSelect');

  // Chat fields
  const inputComentariosLicId = formComentarios ? formComentarios.elements['licitacaoId'] : null;
  const inputNewMessage = formComentarios ? formComentarios.elements['newMessage'] : null;
  const chatMessages = document.getElementById('chatMessages');

  // UI Containers
  const licitacaoCards = document.getElementById('licitacaoCards');
  const newPOsCol = document.getElementById('newPOs');
  const ocPOsCol = document.getElementById('ocPOs');
  const acceptedPOsCol = document.getElementById('acceptedPOs');
  const alertPOsCol = document.getElementById('alertPOs');
  const archivedPOsCol = document.getElementById('archivedPOs');

  // Search bars
  const licitacoesSearch = document.getElementById('licitacoesSearch');
  const poSearch = document.getElementById('poSearch');

  // Category filter radios (only on index.html)
  const filterCategoryRadios = document.querySelectorAll('input[name="filterCategory"]');

  // Buttons
  const btnNewLicitacao = document.getElementById('btnNewLicitacao');
  const btnNewPO = document.getElementById('btnNewPO');

  // -------------------------
  // Export CSV (Excel) Helper Function
  // -------------------------
  function exportDataToCSV(data, headers, fileName) {
    let csvContent = headers.join(",") + "\n";
    data.forEach(item => {
      const row = headers.map(header => `"${item[header] !== undefined ? item[header] : ''}"`).join(",");
      csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const exportLicitacoesBtn = document.getElementById("exportLicitacoesBtn");
  if (exportLicitacoesBtn) {
    exportLicitacoesBtn.addEventListener("click", function() {
      const headers = ["id", "numeroProcesso", "nomeEmpresa", "telefoneEmpresa", "itemSolicitado", "vencimentoAta", "status", "balance", "ocTotal", "categoria", "cmm"];
      exportDataToCSV(licitacoes, headers, "licitacoes.xls");
    });
  }
  const exportPOBtn = document.getElementById("exportPOBtn");
  if (exportPOBtn) {
    exportPOBtn.addEventListener("click", function() {
      const headers = ["id", "elemento", "prioridade", "data", "status", "creationDate", "ocDate", "acceptDate", "alertReason", "valor", "arquivos", "observacoes", "licitacaoId"];
      exportDataToCSV(pos, headers, "pos.xls");
    });
  }

  // -------------------------
  // Import Estoque CSV Functionality
  // -------------------------
  if (btnImportEstoque && fileEstoqueInput) {
    btnImportEstoque.addEventListener('click', function() {
      fileEstoqueInput.click();
    });
    fileEstoqueInput.addEventListener('change', importarPlanilhaEstoque);
  }
  async function importarPlanilhaEstoque() {
    const file = fileEstoqueInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      let headers = lines[0].split(",").map(h => h.trim().toUpperCase());
      const nameIndex = headers.indexOf("NOME_ITEM");
      const qtdeIndex = headers.indexOf("QTDE_DISPONIVEL");
      if (nameIndex < 0 || qtdeIndex < 0) {
        alert("Colunas NOME_ITEM ou QTDE_DISPONIVEL não encontradas no CSV.");
        return;
      }
      let updates = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",");
        if (row.length < headers.length) continue;
        const nomeItem = row[nameIndex].trim();
        const qtde = parseFloat(row[qtdeIndex]) || 0;
        if (nomeItem) {
          updates.push({ nomeItem, qtde });
        }
      }
      for (const up of updates) {
        const lic = licitacoes.find(l => l.itemSolicitado.trim().toUpperCase() === up.nomeItem.toUpperCase());
        if (lic) {
          lic.balance = up.qtde;
          try {
            await db.collection("licitacoes").doc(lic.docId).update({ balance: up.qtde });
          } catch (err) {
            console.error("Erro ao atualizar Firestore:", err);
          }
        }
      }
      renderLicitacoes();
      alert("Planilha importada e 'balance' atualizado com sucesso!");
    } catch (err) {
      console.error("Erro ao ler o arquivo CSV:", err);
      alert("Erro ao ler o arquivo CSV. Verifique o console para mais detalhes.");
    }
  }

  // -------------------------
  // FAB Menu Toggle
  // -------------------------
  fab.addEventListener('click', function(e) {
    e.stopPropagation();
    fabMenu.style.display = (fabMenu.style.display === 'flex') ? 'none' : 'flex';
  });
  document.addEventListener('click', function(e) {
    if (!fabMenu.contains(e.target) && e.target !== fab) {
      fabMenu.style.display = 'none';
    }
  });

  // -------------------------
  // Show/Close Modals
  // -------------------------
  function openModal(modal) {
    modal.style.display = 'flex';
  }
  function closeModal(modal) {
    modal.style.display = 'none';
  }
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal(overlay);
    });
  });
  document.querySelectorAll('.closeModal').forEach(btn => {
    btn.addEventListener('click', function() {
      const modalId = btn.getAttribute('data-modal');
      closeModal(document.getElementById(modalId));
    });
  });

  // -------------------------
  // Helper Functions for Dropdowns and Date Formatting
  // -------------------------
  function populateLicitacaoDropdown() {
    licitacaoSelect.innerHTML = '<option value="">Selecione a Licitação</option>';
    licitacoes.forEach(lic => {
      const option = document.createElement('option');
      option.value = lic.id;
      option.textContent = `${lic.itemSolicitado} (ID ${lic.id})`;
      licitacaoSelect.appendChild(option);
    });
  }
  function populateEditLicitacaoDropdown(selectedId) {
    editLicitacaoSelect.innerHTML = '<option value="">Selecione a Licitação</option>';
    licitacoes.forEach(lic => {
      const option = document.createElement('option');
      option.value = lic.id;
      option.textContent = `${lic.itemSolicitado} (ID ${lic.id})`;
      editLicitacaoSelect.appendChild(option);
    });
    editLicitacaoSelect.value = selectedId;
  }
  function isCloseToDue(dateStr) {
    if (!dateStr) return false;
    const now = new Date();
    const due = new Date(dateStr);
    if (isNaN(due.getTime())) return false;
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(now.getMonth() + 3);
    return due < threeMonthsFromNow;
  }
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  function formatTime(time) {
    const d = new Date(time);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // -------------------------
  // Global Functions for Inline Handlers
  // -------------------------
  window.markAsAccepted = async function(index) {
    const po = pos[index];
    if (po && po.status === "OC") {
      po.status = "Accepted";
      po.acceptDate = new Date().toISOString();
      po.alertReason = "";
      try {
        await db.collection("pos").doc(po.docId).update(po);
      } catch (error) {
        console.error("Error updating PO in markAsAccepted: ", error);
      }
      renderPOBoard();
    }
  };

  window.convertToOC = async function(index) {
    const po = pos[index];
    if (po && po.status === "New") {
      const ocNumber = prompt("Digite o número da OC:");
      if (!ocNumber) return;
      po.elemento = ocNumber;
      po.status = "OC";
      po.ocDate = new Date().toISOString();
      po.alertReason = "";
      const lic = licitacoes.find(l => l.id === po.licitacaoId);
      if (lic) {
        lic.balance -= po.valor;
        lic.ocTotal += po.valor;
        try {
          await db.collection("licitacoes").doc(lic.docId).update(lic);
        } catch (error) {
          console.error("Error updating licitacao in convertToOC: ", error);
        }
      }
      try {
        await db.collection("pos").doc(po.docId).update(po);
      } catch (error) {
        console.error("Error updating PO in convertToOC: ", error);
      }
      renderPOBoard();
      renderLicitacoes();
    }
  };

  window.deletePO = async function(index) {
    const po = pos[index];
    if (!confirm(`Tem certeza de que deseja excluir o PO "${po.elemento}"?`)) return;
    if (po && po.status === "OC") {
      const lic = licitacoes.find(l => l.id === po.licitacaoId);
      if (lic) {
        lic.balance += po.valor;
        lic.ocTotal -= po.valor;
        try {
          await db.collection("licitacoes").doc(lic.docId).update(lic);
        } catch (error) {
          console.error("Error updating licitacao in PO deletion: ", error);
        }
      }
    }
    try {
      await db.collection("pos").doc(po.docId).delete();
    } catch (error) {
      console.error("Error deleting PO: ", error);
    }
    pos.splice(index, 1);
    renderPOBoard();
    renderLicitacoes();
  };

  window.editPO = function(index) {
    const po = pos[index];
    if (!po) return;
    formEditPO.reset();
    formEditPO.elements['index'].value = index;
    formEditPO.elements['elemento'].value = po.elemento;
    formEditPO.elements['prioridade'].value = po.prioridade;
    formEditPO.elements['data'].value = po.data;
    formEditPO.elements['status'].value = po.status;
    formEditPO.elements['valor'].value = po.valor;
    formEditPO.elements['arquivos'].value = po.arquivos || "";
    formEditPO.elements['observacoes'].value = po.observacoes || "";
    populateEditLicitacaoDropdown(po.licitacaoId);
    openModal(modalEditPO);
  };

  window.editLicitacao = function(id) {
    // Find the licitação by id
    const lic = licitacoes.find(l => l.id === id);
    if (!lic) return;
    
    // Reset the edit form and populate it with the licitação's data
    formEditLicitacao.reset();
    formEditLicitacao.elements['id'].value = lic.id;
    formEditLicitacao.elements['numeroProcesso'].value = lic.numeroProcesso;
    formEditLicitacao.elements['nomeEmpresa'].value = lic.nomeEmpresa;
    formEditLicitacao.elements['telefoneEmpresa'].value = lic.telefoneEmpresa;
    formEditLicitacao.elements['itemSolicitado'].value = lic.itemSolicitado;
    formEditLicitacao.elements['vencimentoAta'].value = lic.vencimentoAta;
    formEditLicitacao.elements['status'].value = lic.status;
    formEditLicitacao.elements['balance'].value = lic.balance;
    formEditLicitacao.elements['categoria'].value = lic.categoria;
    
    // NEW: Set the CMM value in the edit form
    if(formEditLicitacao.elements['cmm']) {
      formEditLicitacao.elements['cmm'].value = lic.cmm;
    }
    
    // Open the modal for editing
    openModal(modalEditLicitacao);
  };
  
  window.deleteLicitacao = async function(id) {
    const lic = licitacoes.find(l => l.id === id);
    if (!lic) return;
    if (!confirm(`Tem certeza de que deseja excluir a licitação "${lic.itemSolicitado}"?`)) return;
    try {
      await db.collection("licitacoes").doc(lic.docId).delete();
    } catch (error) {
      console.error("Error deleting licitacao: ", error);
    }
    licitacoes = licitacoes.filter(l => l.id !== id);
    renderLicitacoes();
  };

  // New: Show Licitação Details
  window.showLicitacaoDetails = function(id) {
    const lic = licitacoes.find(l => l.id === id);
    if (!lic) return;
    const infoDiv = document.getElementById("licitacaoInfoContent");
    if (!infoDiv) return;
    infoDiv.innerHTML = `
      <p><strong>Número do Processo:</strong> ${lic.numeroProcesso}</p>
      <p><strong>Empresa:</strong> ${lic.nomeEmpresa}</p>
      <p><strong>Telefone:</strong> ${lic.telefoneEmpresa}</p>
    `;
    openModal(modalLicitacaoInfo);
  };

  window.verificarOCs = function(licitacaoId) {
    const ocList = pos.filter(po => po.licitacaoId === licitacaoId && po.status === "OC");
    const tableBody = document.querySelector('#tableVerificarOCs tbody');
    tableBody.innerHTML = "";
    ocList.forEach(oc => {
      const idx = pos.findIndex(p => p.id === oc.id);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${oc.elemento}</td>
        <td>${oc.prioridade}</td>
        <td>${oc.data}</td>
        <td>${oc.status}</td>
        <td>${oc.valor}</td>
        <td>${oc.arquivos || ""}</td>
        <td>${oc.observacoes || ""}</td>
        <td>
          <button onclick="editPO(${idx})" title="Editar"><i class="bi bi-pencil"></i></button>
        </td>
      `;
      tableBody.appendChild(row);
    });
    openModal(modalVerificarOCs);
  };

  // Enhanced: Show PO Details with tracking info
  function showPODetails(index) {
    const po = pos[index];
    const detailContent = document.getElementById('poDetailContent');
    // Lookup licitação info for the PO
    const lic = licitacoes.find(l => l.id === po.licitacaoId);
    function formatDateBrazil(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR");
    }
    detailContent.innerHTML = `
      <p><strong>Elemento:</strong> ${po.elemento}</p>
      <p><strong>Data:</strong> ${formatDateBrazil(po.data)}</p>
      <p><strong>Valor:</strong> ${po.valor}</p>
      <p><strong>Observação:</strong> ${po.observacoes || ""}</p>
      <p><strong>Licitação:</strong> ${lic ? lic.itemSolicitado : ""}</p>
      <h4>Rastreio</h4>
      <ul>
        <li><strong>Criado em:</strong> ${formatDateBrazil(po.creationDate)}</li>
        <li><strong>Virou OC em:</strong> ${formatDateBrazil(po.ocDate)}</li>
        <li><strong>Aceite em:</strong> ${formatDateBrazil(po.acceptDate)}</li>
        <!-- If you have an archive date, include it here -->
      </ul>
    `;
    openModal(modalPODetails);
  }

  // Archive PO
  window.archivePO = async function(index) {
    const po = pos[index];
    if (!po) return;
    if (!confirm(`Tem certeza de que deseja arquivar o PO "${po.elemento}"?`)) return;
    po.status = 'Archived';
    try {
      await db.collection("pos").doc(po.docId).update(po);
    } catch (error) {
      console.error("Error archiving PO:", error);
    }
    renderPOBoard();
  };

  // -------------------------
  // Automatic PO Status Update (Overdue Checks)
  // -------------------------
  function updatePOStatuses() {
    const now = new Date();
    pos.forEach(po => {
      if (po.status === "New") {
        const creation = new Date(po.creationDate);
        po.alertReason = (now - creation > 2 * 24 * 60 * 60 * 1000) ? "Overdue to become OC" : "";
      } else if (po.status === "OC") {
        if (po.ocDate) {
          const oc = new Date(po.ocDate);
          po.alertReason = (now - oc > 15 * 24 * 60 * 60 * 1000) ? "Overdue acceptance" : "";
        }
      } else {
        po.alertReason = "";
      }
    });
  }

  // -------------------------
  // Render PO Board (Kanban Style)
  // -------------------------
  function renderPOBoard() {
    updatePOStatuses();
    if (newPOsCol) newPOsCol.innerHTML = "";
    if (ocPOsCol) ocPOsCol.innerHTML = "";
    if (acceptedPOsCol) acceptedPOsCol.innerHTML = "";
    if (alertPOsCol) alertPOsCol.innerHTML = "";
    if (archivedPOsCol) archivedPOsCol.innerHTML = "";

    const searchTerm = poSearch ? poSearch.value.toLowerCase() : "";
    pos.forEach((po, index) => {
      if (searchTerm && !po.elemento.toLowerCase().includes(searchTerm)) return;

      const card = document.createElement('div');
      card.className = "po-card";
      card.innerHTML = `
        <p class="po-number">${po.elemento}</p>
        ${po.alertReason ? `<p class="alert-text">${po.alertReason}</p>` : ""}
        <div class="po-actions">
          ${
            po.status === "New"
              ? `<button onclick="convertToOC(${index})" title="Converter para OC"><i class="bi bi-arrow-right-circle"></i></button>`
              : po.status === "OC"
                ? `<button onclick="markAsAccepted(${index})" title="Aceitar"><i class="bi bi-check-circle"></i></button>`
                : ""
          }
          ${
            po.status !== "Archived"
              ? `<button onclick="archivePO(${index})" title="Arquivar"><i class="bi bi-archive"></i></button>`
              : ""
          }
          <button onclick="editPO(${index})" title="Editar"><i class="bi bi-pencil"></i></button>
          <button onclick="deletePO(${index})" title="Excluir"><i class="bi bi-trash"></i></button>
        </div>
      `;
      card.addEventListener('click', function(e) {
        if (e.target.closest('.po-actions')) return;
        showPODetails(index);
      });

      if (po.status === 'Archived') {
        if (archivedPOsCol) archivedPOsCol.appendChild(card);
      } else if (po.alertReason) {
        if (alertPOsCol) alertPOsCol.appendChild(card);
      } else if (po.status === "New") {
        if (newPOsCol) newPOsCol.appendChild(card);
      } else if (po.status === "OC") {
        if (ocPOsCol) ocPOsCol.appendChild(card);
      } else if (po.status === "Accepted") {
        if (acceptedPOsCol) acceptedPOsCol.appendChild(card);
      } else {
        if (newPOsCol) newPOsCol.appendChild(card);
      }
    });
  }

  // -------------------------
  // Render Licitações (Card UI) with Gauge and Details Button
  // -------------------------
  function renderLicitacoes() {
    if (licitacaoCards) licitacaoCards.innerHTML = "";
    const searchTerm = licitacoesSearch ? licitacoesSearch.value.toLowerCase() : "";
    let categoryFilter = 'all';
    if (filterCategoryRadios) {
      filterCategoryRadios.forEach(radio => {
        if (radio.checked) categoryFilter = radio.value;
      });
    }
    licitacoes.forEach(lic => {
      if (searchTerm && !lic.itemSolicitado.toLowerCase().includes(searchTerm)) return;
      if (categoryFilter !== 'all' && lic.categoria !== categoryFilter) return;
      
      // Compute gauge ratio and color
      const total = lic.balance + (lic.ocTotal || 0);
      const used = lic.ocTotal || 0;
      const ratio = total > 0 ? (used / total) : 0;
      let gaugeColor;
      const pct = ratio * 100;
      if (pct <= 30) {
        gaugeColor = "#3CB371"; // green
      } else if (pct <= 70) {
        gaugeColor = "#FFD700"; // yellow
      } else {
        gaugeColor = "#FF4500"; // red
      }
      
      // Autonomia calculation
      const autonomia = (lic.cmm && lic.balance) ? (lic.balance / lic.cmm) : 0;
      
      // Check if due date is within 3 months
      let vencStyle = "";
      if (isCloseToDue(lic.vencimentoAta)) {
        vencStyle = 'style="color: red;"';
      }
      
      const card = document.createElement("div");
      card.className = "item-card fancy-card";
      card.innerHTML = `
        <h2>${lic.itemSolicitado}</h2>
        <div class="gauge-container">
          <svg viewBox="0 0 36 18" class="semi-circle">
            <path d="M2,18 A16,16 0 0 1 34,18" stroke="#eee" stroke-width="4" fill="none"/>
            <path d="M2,18 A16,16 0 0 1 34,18"
                  stroke="${gaugeColor}"
                  stroke-dasharray="${57 * ratio}, 57"
                  stroke-width="4"
                  fill="none"
                  stroke-linecap="round"
            />
          </svg>
          <p>${used}KG de ${total}KG</p>
        </div>
        <p id="venc" ${vencStyle}> ${formatDate(lic.vencimentoAta)}</p>
        <div class="info-icons two-columns">
          <div class="icon-with-label">
            <span class="icon">🛒</span>
            <span>Disp. p/ lib: ${lic.balance}KG</span>
          </div>
          <div class="icon-with-label">
            <span class="icon">📅</span>
            <span>CMM: ${lic.cmm}</span>
          </div>
          <div class="icon-with-label">
            <span class="icon">🚚</span>
            <span>Em OC: ${lic.ocTotal}KG</span>
          </div>
          <div class="icon-with-label">
            <span class="icon">⏳</span>
            <span>Autonomia: ${autonomia.toFixed(2)} meses</span>
          </div>
        </div>
        <button onclick="verificarOCs(${lic.id})" class="ocs-button">Verificar OCs</button>
        <div class="card-actions">
          <button onclick="openComentarios(${lic.id})" title="Comentários"><i class="bi bi-chat-dots"></i></button>
          <button onclick="editLicitacao(${lic.id})" title="Editar"><i class="bi bi-pencil"></i></button>
          <button onclick="deleteLicitacao(${lic.id})" title="Excluir"><i class="bi bi-trash"></i></button>
          <button onclick="showLicitacaoDetails(${lic.id})" title="Detalhes da Licitação">
            <i class="bi bi-info-circle"></i>
          </button>
        </div>
      `;
      if (licitacaoCards) licitacaoCards.appendChild(card);
    });
  }
  

  // -------------------------
  // Render Chat (Comentários)
  // -------------------------
  function renderChat(lic) {
    if (!chatMessages) return;
    chatMessages.innerHTML = "";
    lic.comentarios.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = "chat-bubble";
      bubble.innerHTML = `
        <p>${msg.text}</p>
        <span class="chat-time">${formatTime(msg.time)}</span>
      `;
      chatMessages.appendChild(bubble);
    });
  }
  window.openComentarios = function(licId) {
    const lic = licitacoes.find(l => l.id === licId);
    if (!lic) return;
    if (inputComentariosLicId) inputComentariosLicId.value = licId;
    renderChat(lic);
    openModal(modalComentarios);
  };

  // -------------------------
  // Event Listeners for Forms and Search
  // -------------------------
  if (formLicitacao) {
    formLicitacao.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fd = new FormData(formLicitacao);
      const newLic = {
        id: licitacaoIdCounter++,
        numeroProcesso: fd.get('numeroProcesso'),
        nomeEmpresa: fd.get('nomeEmpresa'),
        telefoneEmpresa: fd.get('telefoneEmpresa'),
        itemSolicitado: fd.get('itemSolicitado'),
        vencimentoAta: fd.get('vencimentoAta'),
        status: fd.get('status'),
        balance: parseFloat(fd.get('balance')) || 0,
        ocTotal: 0,
        comentarios: [],
        categoria: fd.get('categoria'),
        cmm: parseFloat(fd.get('cmm')) || 0  // New CMM field
      };
      try {
        const docRef = await db.collection("licitacoes").add(newLic);
        newLic.docId = docRef.id;
      } catch (error) {
        console.error("Error adding licitacao: ", error);
      }
      licitacoes.push(newLic);
      renderLicitacoes();
      formLicitacao.reset();
      closeModal(modalLicitacao);
    });
  }

  if (formEditLicitacao) {
    formEditLicitacao.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fd = new FormData(formEditLicitacao);
      const id = parseInt(fd.get('id'));
      const lic = licitacoes.find(l => l.id === id);
      if (lic) {
        lic.numeroProcesso = fd.get('numeroProcesso');
        lic.nomeEmpresa = fd.get('nomeEmpresa');
        lic.telefoneEmpresa = fd.get('telefoneEmpresa');
        lic.itemSolicitado = fd.get('itemSolicitado');
        lic.vencimentoAta = fd.get('vencimentoAta');
        lic.status = fd.get('status');
        lic.balance = parseFloat(fd.get('balance')) || 0;
        lic.categoria = fd.get('categoria');
        lic.cmm = parseFloat(fd.get('cmm')) || 0;
        try {
          await db.collection("licitacoes").doc(lic.docId).update(lic);
        } catch (error) {
          console.error("Error updating licitacao: ", error);
        }
      }
      renderLicitacoes();
      formEditLicitacao.reset();
      closeModal(modalEditLicitacao);
    });
  }

  if (formPO) {
    formPO.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fd = new FormData(formPO);
      const newPO = {
        id: poIdCounter++,
        elemento: fd.get('elemento'),
        prioridade: fd.get('prioridade'),
        data: fd.get('data'),
        status: "New",
        creationDate: new Date().toISOString(),
        ocDate: null,
        acceptDate: null,
        alertReason: "",
        valor: parseFloat(fd.get('valor')) || 0,
        arquivos: fd.get('arquivos'),
        observacoes: fd.get('observacoes'),
        licitacaoId: parseInt(fd.get('licitacaoId')) || 0
      };
      try {
        const docRef = await db.collection("pos").add(newPO);
        newPO.docId = docRef.id;
      } catch (error) {
        console.error("Error adding PO: ", error);
      }
      pos.push(newPO);
      renderPOBoard();
      formPO.reset();
      closeModal(modalPO);
    });
  }

  if (formEditPO) {
    formEditPO.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fd = new FormData(formEditPO);
      const index = parseInt(fd.get('index'));
      const oldPO = pos[index];
      if (!oldPO) return;
      const oldStatus = oldPO.status;
      const oldLicitacaoId = oldPO.licitacaoId;
      const oldValor = oldPO.valor;

      oldPO.elemento = fd.get('elemento');
      oldPO.prioridade = fd.get('prioridade');
      oldPO.data = fd.get('data');
      oldPO.status = fd.get('status');
      oldPO.valor = parseFloat(fd.get('valor')) || 0;
      oldPO.arquivos = fd.get('arquivos');
      oldPO.observacoes = fd.get('observacoes');
      oldPO.licitacaoId = parseInt(fd.get('licitacaoId')) || 0;

      if (oldStatus === "OC") {
        const oldLic = licitacoes.find(l => l.id === oldLicitacaoId);
        if (oldLic) {
          oldLic.balance += oldValor;
          oldLic.ocTotal -= oldValor;
          try {
            await db.collection("licitacoes").doc(oldLic.docId).update(oldLic);
          } catch (error) {
            console.error("Error updating licitacao in PO edit: ", error);
          }
        }
      }
      if (oldPO.status === "OC") {
        oldPO.ocDate = new Date().toISOString();
        const newLic = licitacoes.find(l => l.id === oldPO.licitacaoId);
        if (newLic) {
          newLic.balance -= oldPO.valor;
          newLic.ocTotal += oldPO.valor;
          try {
            await db.collection("licitacoes").doc(newLic.docId).update(newLic);
          } catch (error) {
            console.error("Error updating licitacao in PO edit: ", error);
          }
        }
      }

      try {
        await db.collection("pos").doc(oldPO.docId).update(oldPO);
      } catch (error) {
        console.error("Error updating PO: ", error);
      }
      renderPOBoard();
      formEditPO.reset();
      closeModal(modalEditPO);
      renderLicitacoes();
    });
  }

  if (formComentarios) {
    formComentarios.addEventListener("submit", async function(e) {
      e.preventDefault();
      const licId = parseInt(formComentarios.elements["licitacaoId"].value);
      const lic = licitacoes.find(l => l.id === licId);
      if (!lic) return;
      const newMsg = {
        text: inputNewMessage.value,
        time: new Date()
      };
      lic.comentarios.push(newMsg);
      try {
        await db.collection("licitacoes").doc(lic.docId).update({ comentarios: lic.comentarios });
      } catch (error) {
        console.error("Error updating comentarios: ", error);
      }
      inputNewMessage.value = "";
      renderChat(lic);
    });
  }

  if (licitacoesSearch) {
    licitacoesSearch.addEventListener("input", function() {
      renderLicitacoes();
    });
  }
  if (poSearch) {
    poSearch.addEventListener("input", function() {
      renderPOBoard();
    });
  }
  if (filterCategoryRadios) {
    filterCategoryRadios.forEach(radio => {
      radio.addEventListener('change', renderLicitacoes);
    });
  }

  if (btnNewLicitacao) {
    btnNewLicitacao.addEventListener('click', function() {
      formLicitacao.reset();
      openModal(modalLicitacao);
    });
  }
  if (btnNewPO) {
    btnNewPO.addEventListener('click', function() {
      formPO.reset();
      populateLicitacaoDropdown();
      openModal(modalPO);
    });
  }

  // -------------------------
  // Load Data from Firestore and Render All
  // -------------------------
  async function loadData() {
    try {
      const licSnapshot = await db.collection("licitacoes").get();
      licSnapshot.forEach(doc => {
        let licData = doc.data();
        licData.docId = doc.id;
        if (!licData.comentarios) licData.comentarios = [];
        licitacoes.push(licData);
        if (licData.id >= licitacaoIdCounter) {
          licitacaoIdCounter = licData.id + 1;
        }
      });
      const posSnapshot = await db.collection("pos").get();
      posSnapshot.forEach(doc => {
        let poData = doc.data();
        poData.docId = doc.id;
        pos.push(poData);
        if (poData.id >= poIdCounter) {
          poIdCounter = poData.id + 1;
        }
      });
      renderLicitacoes();
      renderPOBoard();
    } catch (error) {
      console.error("Error loading data: ", error);
    }
  }
  await loadData();
});
