document.addEventListener("DOMContentLoaded", async function() {
  // -------------------------
  // Firebase configuration – replace placeholders with your actual Firebase credentials!
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
  const db = firebase.firestore();
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
  const modalLicitacaoInfo = document.getElementById('modalLicitacaoInfo');

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

  // Category filter radios
  const filterCategoryRadios = document.querySelectorAll('input[name="filterCategory"]');

  // Buttons
  const btnNewLicitacao = document.getElementById('btnNewLicitacao');
  const btnNewPO = document.getElementById('btnNewPO');

  // -------------------------
  // CSV Export Helper Function
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
  if (document.getElementById("exportLicitacoesBtn")) {
    document.getElementById("exportLicitacoesBtn").addEventListener("click", function() {
      const headers = [
        "id", "numeroProcesso", "nomeEmpresa", "telefoneEmpresa", "itemSolicitado",
        "vencimentoAta", "status", "totalQuantity", "balance", "ocTotal", "categoria", "cmm"
      ];
      exportDataToCSV(licitacoes, headers, "licitacoes.xls");
    });
  }
  if (document.getElementById("exportPOBtn")) {
    document.getElementById("exportPOBtn").addEventListener("click", function() {
      const headers = [
        "id", "elemento", "prioridade", "data", "status", "creationDate",
        "ocDate", "acceptDate", "alertReason", "valor", "arquivos", "observacoes", "licitacaoId"
      ];
      exportDataToCSV(pos, headers, "pos.xls");
    });
  }

  // -------------------------
  // Import Estoque Functionality (CSV/Excel)
  // -------------------------
  if (btnImportEstoque && fileEstoqueInput) {
    btnImportEstoque.addEventListener('click', function() {
      fileEstoqueInput.click();
    });
    fileEstoqueInput.addEventListener('change', async function importarPlanilhaEstoque() {
      const file = fileEstoqueInput.files[0];
      if (!file) return;
      const ext = file.name.split('.').pop().toLowerCase();
      let text = "";
      if (ext === "csv") {
        text = await file.text();
      } else if (ext === "xls" || ext === "xlsx") {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        text = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        alert("Formato de arquivo não suportado. Use CSV ou Excel (xls/xlsx).");
        return;
      }
      const lines = text.split(/\r?\n/);
      const headers = lines[0].split(",").map(h => h.trim().toUpperCase());
      const nameIndex = headers.indexOf("NOME_ITEM");
      const qtdeIndex = headers.indexOf("QTDE_DISPONIVEL");
      if (nameIndex < 0 || qtdeIndex < 0) {
        alert("Colunas NOME_ITEM ou QTDE_DISPONIVEL não encontradas.");
        return;
      }
      const updates = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",");
        if (row.length < headers.length) continue;
        const nomeItem = row[nameIndex].trim();
        let qtdeStr = row[qtdeIndex].trim();
        qtdeStr = qtdeStr.replace(/\./g, "").replace(/,/g, ".");
        const qtde = parseFloat(qtdeStr) || 0;
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
      alert("Planilha importada e 'Disp. p/lib.' atualizado com sucesso!");
    });
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
  // Modal Show/Close Functions
  // -------------------------
  function openModal(modal) { modal.style.display = 'flex'; }
  function closeModal(modal) { modal.style.display = 'none'; }
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
  // Manual Edit of "Disp. p/lib." – Called when user clicks the pencil icon
  // -------------------------
  window.editBalance = async function(licId) {
    const lic = licitacoes.find(l => l.id === licId);
    if (!lic) return;
    const newValStr = prompt("Digite o novo valor para 'Disp. p/lib':", lic.balance);
    if (newValStr === null) return; // User cancelled
    const newVal = parseFloat(newValStr);
    if (isNaN(newVal)) {
      alert("Valor inválido.");
      return;
    }
    lic.balance = newVal;
    try {
      await db.collection("licitacoes").doc(lic.docId).update({ balance: newVal });
    } catch (error) {
      console.error("Error updating disp. p/lib:", error);
    }
    renderLicitacoes();
  };

  // -------------------------
  // PO Functions: markAsAccepted, convertToOC, deletePO, editPO
  // -------------------------
  window.markAsAccepted = async function(index) {
    const po = pos[index];
    if (!po || po.status !== "OC") return;
    po.status = "Accepted";
    po.acceptDate = new Date().toISOString();
    po.alertReason = "";
    po.alertAcknowledgedOC = false;
    try {
      await db.collection("pos").doc(po.docId).update(po);
    } catch (error) {
      console.error("Error updating PO in markAsAccepted:", error);
    }
    renderPOBoard();
  };

  window.convertToOC = async function(index) {
    const po = pos[index];
    if (!po || po.status !== "New") return;
    const ocNumber = prompt("Digite o número da OC:");
    if (!ocNumber) return;
    po.elemento = ocNumber;
    po.status = "OC";
    po.ocDate = new Date().toISOString();
    po.alertReason = "";
    po.alertAcknowledgedOC = false;
    const lic = licitacoes.find(l => l.id === po.licitacaoId);
    if (lic) {
      lic.ocTotal = (lic.ocTotal || 0) + po.valor;
      try {
        await db.collection("licitacoes").doc(lic.docId).update({ ocTotal: lic.ocTotal });
      } catch (error) {
        console.error("Error updating licitacao in convertToOC:", error);
      }
    }
    try {
      await db.collection("pos").doc(po.docId).update(po);
    } catch (error) {
      console.error("Error updating PO in convertToOC:", error);
    }
    renderPOBoard();
    renderLicitacoes();
  };

  window.deletePO = async function(index) {
    const po = pos[index];
    if (!po) return;
    if (!confirm(`Tem certeza de que deseja excluir o PO "${po.elemento}"?`)) return;
    if (po.status === "OC") {
      const lic = licitacoes.find(l => l.id === po.licitacaoId);
      if (lic) {
        lic.ocTotal = (lic.ocTotal || 0) - po.valor;
        try {
          await db.collection("licitacoes").doc(lic.docId).update({ ocTotal: lic.ocTotal });
        } catch (error) {
          console.error("Error updating licitacao in PO deletion:", error);
        }
      }
    }
    try {
      await db.collection("pos").doc(po.docId).delete();
    } catch (error) {
      console.error("Error deleting PO:", error);
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

  // -------------------------
  // Licitação Functions: edit, delete, show details
  // -------------------------
  window.editLicitacao = function(id) {
    const lic = licitacoes.find(l => l.id === id);
    if (!lic) return;
    formEditLicitacao.reset();
    formEditLicitacao.elements['id'].value = lic.id;
    formEditLicitacao.elements['numeroProcesso'].value = lic.numeroProcesso;
    formEditLicitacao.elements['nomeEmpresa'].value = lic.nomeEmpresa;
    formEditLicitacao.elements['telefoneEmpresa'].value = lic.telefoneEmpresa;
    formEditLicitacao.elements['itemSolicitado'].value = lic.itemSolicitado;
    formEditLicitacao.elements['vencimentoAta'].value = lic.vencimentoAta;
    formEditLicitacao.elements['status'].value = lic.status;
    // "balance" in the form represents totalQuantity (the original order quantity)
    formEditLicitacao.elements['balance'].value = lic.totalQuantity || 0;
    formEditLicitacao.elements['categoria'].value = lic.categoria;
    formEditLicitacao.elements['cmm'].value = lic.cmm || 0;
    openModal(modalEditLicitacao);
  };

  window.deleteLicitacao = async function(id) {
    const lic = licitacoes.find(l => l.id === id);
    if (!lic) return;
    if (!confirm(`Tem certeza de que deseja excluir a licitação "${lic.itemSolicitado}"?`)) return;
    try {
      await db.collection("licitacoes").doc(lic.docId).delete();
    } catch (error) {
      console.error("Error deleting licitacao:", error);
    }
    licitacoes = licitacoes.filter(l => l.id !== id);
    renderLicitacoes();
  };

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

  // -------------------------
  // Verificar OCs – now includes Accepted status as well
  // -------------------------
  window.verificarOCs = function(licitacaoId) {
    const ocList = pos.filter(po =>
      po.licitacaoId === licitacaoId &&
      (po.status === "OC" || po.status === "Accepted" || po.status === "Archived")
    );
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

  // -------------------------
  // Show PO Details
  // -------------------------
  function showPODetails(index) {
    const po = pos[index];
    const detailContent = document.getElementById('poDetailContent');
    const lic = licitacoes.find(l => l.id === po.licitacaoId);
    function formatDateBrazil(ds) {
      if (!ds) return "";
      const d = new Date(ds);
      return isNaN(d) ? ds : d.toLocaleDateString("pt-BR");
    }
    detailContent.innerHTML = `
      <div class="po-details">
        <div class="po-info">
          <p><strong>Elemento:</strong> ${po.elemento}</p>
          <p><strong>Data:</strong> ${formatDateBrazil(po.data)}</p>
          <p><strong>Valor:</strong> ${po.valor}</p>
          <p><strong>Observação:</strong> ${po.observacoes || ""}</p>
          <p><strong>Licitação:</strong> ${lic ? lic.itemSolicitado : ""}</p>
        </div>
        <div class="track-details">
          <h4>Rastreio</h4>
          <ul>
            <li><strong>Criado em:</strong> ${formatDateBrazil(po.creationDate)}</li>
            <li><strong>Virou OC em:</strong> ${formatDateBrazil(po.ocDate)}</li>
            <li><strong>Aceite em:</strong> ${formatDateBrazil(po.acceptDate)}</li>
          </ul>
        </div>
      </div>
    `;
    openModal(modalPODetails);
  }

  // -------------------------
  // Archive PO – removes from card but remains in Verificar OCs for control
  // -------------------------
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
  // Automatic PO Status Update (Alerts)
  // -------------------------
  function updatePOStatuses() {
    const now = new Date();
    pos.forEach(po => {
      if (po.status === "New") {
        if (!po.hasOwnProperty('alertAcknowledgedNew')) po.alertAcknowledgedNew = false;
        const creation = new Date(po.creationDate);
        if ((now - creation) > (2 * 24 * 60 * 60 * 1000) && !po.alertAcknowledgedNew) {
          po.alertReason = "Overdue to become OC";
        } else {
          po.alertReason = "";
        }
      } else if (po.status === "OC") {
        if (!po.hasOwnProperty('alertAcknowledgedOC')) po.alertAcknowledgedOC = false;
        if (po.ocDate) {
          const oc = new Date(po.ocDate);
          if ((now - oc) > (15 * 24 * 60 * 60 * 1000) && !po.alertAcknowledgedOC) {
            po.alertReason = "Overdue acceptance";
          } else {
            po.alertReason = "";
          }
        }
      } else {
        po.alertReason = "";
      }
    });
  }

  window.confirmAlert = async function(index) {
    const po = pos[index];
    if (!po) return;
    if (po.status === "New") {
      po.alertAcknowledgedNew = true;
    } else if (po.status === "OC") {
      po.alertAcknowledgedOC = true;
    }
    po.alertReason = "";
    try {
      await db.collection("pos").doc(po.docId).update({
        alertAcknowledgedNew: po.alertAcknowledgedNew,
        alertAcknowledgedOC: po.alertAcknowledgedOC,
        alertReason: ""
      });
    } catch (error) {
      console.error("Error confirming alert:", error);
    }
    renderPOBoard();
  };

  // -------------------------
  // Render PO Board (Kanban)
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
        ${po.alertReason ? `<p class="alert-text">${po.alertReason} <button class="confirm-alert-btn" onclick="confirmAlert(${index})">Confirmar</button></p>` : ""}
        <div class="po-actions">
          ${ po.status === "New"
              ? `<button onclick="convertToOC(${index})" title="Converter para OC"><i class="bi bi-arrow-right-circle"></i></button>`
              : po.status === "OC"
                ? `<button onclick="markAsAccepted(${index})" title="Aceitar"><i class="bi bi-check-circle"></i></button>`
                : "" }
          ${ po.status !== "Archived"
              ? `<button onclick="archivePO(${index})" title="Arquivar"><i class="bi bi-archive"></i></button>`
              : "" }
          <button onclick="editPO(${index})" title="Editar"><i class="bi bi-pencil"></i></button>
          <button onclick="deletePO(${index})" title="Excluir"><i class="bi bi-trash"></i></button>
        </div>
      `;
      card.addEventListener('click', function(e) {
        if (e.target.closest('.po-actions')) return;
        showPODetails(index);
      });
      if (po.status === 'Archived') {
        archivedPOsCol && archivedPOsCol.appendChild(card);
      } else if (po.alertReason) {
        alertPOsCol && alertPOsCol.appendChild(card);
      } else if (po.status === "New") {
        newPOsCol && newPOsCol.appendChild(card);
      } else if (po.status === "OC") {
        ocPOsCol && ocPOsCol.appendChild(card);
      } else if (po.status === "Accepted") {
        acceptedPOsCol && acceptedPOsCol.appendChild(card);
      } else {
        newPOsCol && newPOsCol.appendChild(card);
      }
    });
  }

  // -------------------------
  // Render Licitações (Cards)
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

      const total = lic.totalQuantity || 0;
      const used = lic.ocTotal || 0;
      const ratio = total > 0 ? (used / total) : 0;
      const pct = ratio * 100;
      let gaugeColor;
      if (pct <= 30) gaugeColor = "#3CB371";
      else if (pct <= 70) gaugeColor = "#FFD700";
      else gaugeColor = "#FF4500";

      // Calculate Autonomia (balance / cmm) if possible
      let autonomia = "N/A";
      if (lic.cmm && lic.cmm > 0) {
        autonomia = (lic.balance / lic.cmm).toFixed(2);
      }

      let vencStyle = "";
      if (isCloseToDue(lic.vencimentoAta)) {
        vencStyle = 'style="color: red;"';
      }

      // Wrap the licitação title in a span with truncated-value so that if it's too long, it shows ellipsis.
      const truncatedTitle = `<span class="truncated-value" title="${lic.itemSolicitado}">${lic.itemSolicitado}</span>`;

      const card = document.createElement("div");
      card.className = "item-card fancy-card";
      card.innerHTML = `
        <h2>${truncatedTitle}</h2>
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
        <p id="venc" ${vencStyle}>${formatDate(lic.vencimentoAta)}</p>
        <div class="info-icons two-columns">
          <div class="icon-with-label">
            <span class="label">Disp. p/lib:</span>
            <span class="value truncated-value" title="${lic.balance} KG">${lic.balance} KG</span>
            <button class="edit-disp-button" onclick="editBalance(${lic.id})" title="Editar Disp. p/lib">
              <i class="bi bi-pencil"></i>
            </button>
          </div>
          <div class="icon-with-label">
            <span class="label">CMM:</span>
            <span class="value truncated-value" title="${lic.cmm}">${lic.cmm}</span>
          </div>
          <div class="icon-with-label">
            <span class="label">Em OC:</span>
            <span class="value truncated-value" title="${lic.ocTotal} KG">${lic.ocTotal} KG</span>
          </div>
          <div class="icon-with-label">
            <span class="label">Autonomia:</span>
            <span class="value truncated-value" title="${autonomia} meses">${autonomia} meses</span>
          </div>
        </div>
        <button onclick="verificarOCs(${lic.id})" class="ocs-button">Verificar OCs</button>
        <div class="card-actions">
          <button class="comments-btn" onclick="openComentarios(${lic.id})" title="Comentários">
            <i class="bi bi-chat-dots"></i>
            ${lic.newCommentCount && lic.newCommentCount > 0 ? `<span class="new-comment-badge">${lic.newCommentCount}</span>` : ""}
          </button>
          <button onclick="editLicitacao(${lic.id})" title="Editar"><i class="bi bi-pencil"></i></button>
          <button onclick="deleteLicitacao(${lic.id})" title="Excluir"><i class="bi bi-trash"></i></button>
          <button onclick="showLicitacaoDetails(${lic.id})" title="Detalhes da Licitação"><i class="bi bi-info-circle"></i></button>
        </div>
      `;
      licitacaoCards && licitacaoCards.appendChild(card);
    });
  }

  // -------------------------
  // Render Chat (Comentários)
  // -------------------------
  function renderChat(lic) {
    if (!chatMessages) return;
    chatMessages.innerHTML = "";
    lic.comentarios.forEach((msg, idx) => {
      const bubble = document.createElement('div');
      bubble.className = "chat-bubble";
      bubble.innerHTML = `
        <p>${msg.text}</p>
        <span class="chat-time">${formatTime(msg.time)}</span>
        <button class="delete-comment-btn" onclick="deleteComment(${lic.id}, ${idx})" title="Excluir comentário">X</button>
      `;
      chatMessages.appendChild(bubble);
    });
  }
  window.openComentarios = function(licId) {
    const lic = licitacoes.find(l => l.id === licId);
    if (!lic) return;
    if (formComentarios.elements["licitacaoId"]) {
      formComentarios.elements["licitacaoId"].value = licId;
    }
    // Do not reset newCommentCount here so the badge remains until comments are manually cleared
    renderChat(lic);
    openModal(modalComentarios);
  };
  window.deleteComment = async function(licId, commentIndex) {
    const lic = licitacoes.find(l => l.id === licId);
    if (!lic) return;
    if (!confirm("Tem certeza que deseja excluir este comentário?")) return;
    lic.comentarios.splice(commentIndex, 1);
    // Update newCommentCount to the current number of comments
    lic.newCommentCount = lic.comentarios.length;
    try {
      await db.collection("licitacoes").doc(lic.docId).update({
        comentarios: lic.comentarios,
        newCommentCount: lic.newCommentCount
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
    renderChat(lic);
    renderLicitacoes();
  };

  // -------------------------
  // Form Submissions
  // -------------------------
  if (formLicitacao) {
    formLicitacao.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fd = new FormData(formLicitacao);
      const totalQty = parseFloat(fd.get('balance')) || 0;
      const newLic = {
        id: licitacaoIdCounter++,
        numeroProcesso: fd.get('numeroProcesso'),
        nomeEmpresa: fd.get('nomeEmpresa'),
        telefoneEmpresa: fd.get('telefoneEmpresa'),
        itemSolicitado: fd.get('itemSolicitado'),
        vencimentoAta: fd.get('vencimentoAta'),
        status: fd.get('status'),
        totalQuantity: totalQty,
        balance: 0, // initial "Disp. p/lib" is 0
        ocTotal: 0,
        comentarios: [],
        categoria: fd.get('categoria'),
        cmm: parseFloat(fd.get('cmm')) || 0
      };
      try {
        const docRef = await db.collection("licitacoes").add(newLic);
        newLic.docId = docRef.id;
      } catch (error) {
        console.error("Error adding licitacao:", error);
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
      if (!lic) return;
      lic.numeroProcesso = fd.get('numeroProcesso');
      lic.nomeEmpresa = fd.get('nomeEmpresa');
      lic.telefoneEmpresa = fd.get('telefoneEmpresa');
      lic.itemSolicitado = fd.get('itemSolicitado');
      lic.vencimentoAta = fd.get('vencimentoAta');
      lic.status = fd.get('status');
      lic.totalQuantity = parseFloat(fd.get('balance')) || 0;
      lic.categoria = fd.get('categoria');
      lic.cmm = parseFloat(fd.get('cmm')) || 0;
      try {
        await db.collection("licitacoes").doc(lic.docId).update(lic);
      } catch (error) {
        console.error("Error updating licitacao:", error);
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
        licitacaoId: parseInt(fd.get('licitacaoId')) || 0,
        alertAcknowledgedNew: false,
        alertAcknowledgedOC: false
      };
      try {
        const docRef = await db.collection("pos").add(newPO);
        newPO.docId = docRef.id;
      } catch (error) {
        console.error("Error adding PO:", error);
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
          oldLic.ocTotal -= oldValor;
          try {
            await db.collection("licitacoes").doc(oldLic.docId).update({ ocTotal: oldLic.ocTotal });
          } catch (error) {
            console.error("Error updating old lic in PO edit:", error);
          }
        }
      }
      if (oldPO.status === "OC") {
        oldPO.ocDate = new Date().toISOString();
        const newLic = licitacoes.find(l => l.id === oldPO.licitacaoId);
        if (newLic) {
          newLic.ocTotal += oldPO.valor;
          try {
            await db.collection("licitacoes").doc(newLic.docId).update({ ocTotal: newLic.ocTotal });
          } catch (error) {
            console.error("Error updating new lic in PO edit:", error);
          }
        }
      }
      try {
        await db.collection("pos").doc(oldPO.docId).update(oldPO);
      } catch (error) {
        console.error("Error updating PO:", error);
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
        text: formComentarios.elements["newMessage"].value,
        time: new Date()
      };
      lic.comentarios.push(newMsg);
      lic.newCommentCount = (lic.newCommentCount || 0) + 1;
      try {
        await db.collection("licitacoes").doc(lic.docId).update({
          comentarios: lic.comentarios,
          newCommentCount: lic.newCommentCount
        });
      } catch (error) {
        console.error("Error updating comentarios:", error);
      }
      formComentarios.elements["newMessage"].value = "";
      renderChat(lic);
      renderLicitacoes();
    });
  }

  if (licitacoesSearch) {
    licitacoesSearch.addEventListener("input", renderLicitacoes);
  }
  if (poSearch) {
    poSearch.addEventListener("input", renderPOBoard);
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
  // Load Data from Firestore
  // -------------------------
  async function loadData() {
    try {
      const licSnapshot = await db.collection("licitacoes").get();
      licSnapshot.forEach(doc => {
        const licData = doc.data();
        licData.docId = doc.id;
        if (!licData.comentarios) licData.comentarios = [];
        licitacoes.push(licData);
        if (licData.id >= licitacaoIdCounter) {
          licitacaoIdCounter = licData.id + 1;
        }
      });
      const posSnapshot = await db.collection("pos").get();
      posSnapshot.forEach(doc => {
        const poData = doc.data();
        poData.docId = doc.id;
        pos.push(poData);
        if (poData.id >= poIdCounter) {
          poIdCounter = poData.id + 1;
        }
      });
      renderLicitacoes();
      renderPOBoard();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }
  await loadData();

  // -------------------------
  // Helper: Open/Close Modal
  // -------------------------
  function openModal(modal) { modal.style.display = 'flex'; }
  function closeModal(modal) { modal.style.display = 'none'; }
});
