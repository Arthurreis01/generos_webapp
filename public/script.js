document.addEventListener("DOMContentLoaded", async function() {
  // Firebase Configuration and Initialization
  const firebaseConfig = {
    apiKey: "AIzaSyD80JCME8g97PD1fMu2xQWD6DRJp5bMFSg",
    authDomain: "generos-webapp.firebaseapp.com",
    projectId: "generos-webapp",
    storageBucket: "generos-webapp.firebasestorage.app",
    messagingSenderId: "874489491002",
    appId: "1:874489491002:web:46f893c170bbd944cb8f03",
    measurementId: "G-Y3VQW229XW"
  };
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.firestore();

  /* ---------- Helper Functions ---------- */
  function parseNumber(str) {
    if (!str) return 0;
    let s = str.trim().replace(/\s+/g, '');
    const commaIndex = s.lastIndexOf(',');
    const dotIndex = s.lastIndexOf('.');
    if (commaIndex > -1 && dotIndex > -1) {
      if (commaIndex > dotIndex) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (commaIndex > -1) {
      s = s.replace(',', '.');
    }
    s = s.replace(/[^0-9.\-]/g, '');
    return parseFloat(s) || 0;
  }
  
  function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
  
  function formatDate(dateStr) {
    if (!dateStr) return '';
    if (dateStr.indexOf("/") !== -1) return dateStr;
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
  
  function removeExtraQuotes(str) {
    return str.replace(/"/g, '').trim();
  }
  
  function showImportLoadingModal() {
    const modal = document.getElementById("importLoadingModal");
    if (modal) modal.style.display = 'flex';
  }
  
  function hideImportLoadingModal() {
    const modal = document.getElementById("importLoadingModal");
    if (modal) modal.style.display = 'none';
  }
  
  /* ---------- Data Arrays and Counters ---------- */
  let licitacoes = [];
  let licitacaoIdCounter = 1;
  
  /* ---------- DOM Elements ---------- */
  const fab = document.querySelector('.fab');
  const fabMenu = document.getElementById('fabMenu');
  const btnNewLicitacao = document.getElementById('btnNewLicitacao');
  const licitacaoCards = document.getElementById('licitacaoCards');
  const fileEstoqueInput = document.getElementById('fileEstoque');
  const btnImportEstoque = document.getElementById('btnImportEstoque');
  const modalLicitacao = document.getElementById('modalLicitacao');
  const modalEditLicitacao = document.getElementById('modalEditLicitacao');
  const modalComentarios = document.getElementById('modalComentarios');
  const modalVerificarOCs = document.getElementById('modalVerificarOCs');
  const formLicitacao = document.getElementById('formLicitacao');
  const formEditLicitacao = document.getElementById('formEditLicitacao');
  const formComentarios = document.getElementById('formComentarios');
  const chatMessages = document.getElementById('chatMessages');
  const licitacoesSearch = document.getElementById('licitacoesSearch');
  const filterCategoryRadios = document.querySelectorAll('input[name="filterCategory"]');
  
  // Modal for Manual OC Addition
  const modalNovaOC = document.getElementById("modalNovaOC");
  const formNovaOC = document.getElementById("formNovaOC");
  let newOC_pi = null;
  
  /* ---------- Modal Show/Close Functions ---------- */
  function openModal(modal) {
    if (modal) modal.style.display = 'flex';
  }
  
  function closeModal(modal) {
    if (modal) modal.style.display = 'none';
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
  
  /* ---------- FAB Menu ---------- */
  fab.addEventListener('click', function(e) {
    e.stopPropagation();
    fabMenu.style.display = (fabMenu.style.display === 'flex') ? 'none' : 'flex';
  });
  
  document.addEventListener('click', function(e) {
    if (!fabMenu.contains(e.target) && e.target !== fab) {
      fabMenu.style.display = 'none';
    }
  });
  
  if (btnNewLicitacao) {
    btnNewLicitacao.addEventListener('click', function() {
      if (formLicitacao) formLicitacao.reset();
      openModal(modalLicitacao);
    });
  }
  
  /* ---------- CSV Export ---------- */
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
        "vencimentoAta", "status", "totalQuantity", "balance", "ocTotal", "ocConsumed",
        "categoria", "cmm", "pi", "comprometido"
      ];
      exportDataToCSV(licitacoes, headers, "licitacoes.xls");
    });
  }
  
  /* ---------- Import Estoque ---------- */
  if (btnImportEstoque && fileEstoqueInput) {
    btnImportEstoque.addEventListener('click', function() {
      fileEstoqueInput.click();
    });
  
    fileEstoqueInput.addEventListener('change', async function() {
      const file = fileEstoqueInput.files[0];
      if (!file) return;
      showImportLoadingModal();
      try {
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
          hideImportLoadingModal();
          return;
        }
  
        const lines = text.split(/\r?\n/);
        const headers = lines[0].split(",").map(h => removeExtraQuotes(h.trim().toUpperCase()));
        const piIndex = headers.indexOf("PI");
        const dispIndex = headers.indexOf("QTDE_DISPONIVEL");
        const compIndex = headers.indexOf("QTDE_COMPROMETIDA");
  
        if (piIndex < 0 || dispIndex < 0 || compIndex < 0) {
          alert("Colunas PI, QTDE_DISPONIVEL ou QTDE_COMPROMETIDA não encontradas.");
          hideImportLoadingModal();
          return;
        }
  
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",");
          if (row.length < headers.length) continue;
          const pi = removeExtraQuotes(row[piIndex]).toUpperCase();
          const dispVal = parseNumber(removeExtraQuotes(row[dispIndex]));
          const compVal = parseNumber(removeExtraQuotes(row[compIndex]));
  
          const matchingLics = licitacoes.filter(l => l.pi && l.pi.toUpperCase() === pi);
          if (matchingLics.length > 0) {
            for (let lic of matchingLics) {
              lic.balance = dispVal;
              lic.comprometido = compVal;
              try {
                await db.collection("licitacoes").doc(lic.docId).update({
                  balance: dispVal,
                  comprometido: compVal
                });
              } catch (err) {
                console.error("Erro ao atualizar Firestore (Estoque):", err);
              }
            }
          }
        }
  
        renderLicitacoes();
        alert("Planilha de Estoque importada e valores atualizados com sucesso!");
      } catch (error) {
        console.error(error);
        alert("Erro ao importar Estoque: " + error.message);
      } finally {
        hideImportLoadingModal();
        fileEstoqueInput.value = "";
      }
    });
  }
  
  /* ---------- Manual OC Addition Per Card ---------- */
  // Now accepts both PI and itemSolicitado.
  window.openNovaOCModal = function(pi, itemSolicitado) {
    newOC_pi = pi;
    // Find the licitation matching both the PI and the item
    const lic = licitacoes.find(l =>
      l.pi && l.pi.toUpperCase() === pi.toUpperCase() &&
      l.itemSolicitado === itemSolicitado
    );
    if (!lic) {
      alert("Licitação não encontrada!");
      return;
    }
    // Set the Licitation Number field to be editable and assign the corresponding licitation number
    const numLicInput = document.getElementById("novaOC_numLic");
    numLicInput.removeAttribute("readonly");
    numLicInput.value = lic.numeroProcesso || lic.pi;
    document.getElementById("novaOC_ocNumber").value = "";
    document.getElementById("novaOC_balance").value = "";
    document.getElementById("novaOC_companyName").value = "";
    // Set the hidden itemSolicitado field
    document.getElementById("novaOC_itemSolicitado").value = lic.itemSolicitado;
    modalNovaOC.style.display = "flex";
  };
  
  if (formNovaOC) {
    formNovaOC.addEventListener("submit", async function(e) {
      e.preventDefault();
      saveNovaOC();
    });
  }
  
  async function saveNovaOC() {
    const ocNumber = document.getElementById("novaOC_ocNumber").value.trim();
    const ocBalance = parseFloat(document.getElementById("novaOC_balance").value);
    const companyName = document.getElementById("novaOC_companyName").value.trim();
    const licitationNumber = document.getElementById("novaOC_numLic").value.trim();
    const itemSolicitado = document.getElementById("novaOC_itemSolicitado").value.trim();
  
    if (!ocNumber || isNaN(ocBalance) || !companyName || !licitationNumber || !itemSolicitado) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }
  
    // Match licitations only for the specific licitation number and item
    const matchingLics = licitacoes.filter(l =>
      l.numeroProcesso === licitationNumber && l.itemSolicitado === itemSolicitado
    );
    if (matchingLics.length === 0) {
      alert("Licitação ou item não encontrados para atualização.");
      return;
    }
  
    for (const lic of matchingLics) {
      if (!lic.ocs) lic.ocs = [];
      const newOC = {
        codigo: ocNumber,
        qtdeComprada: ocBalance,
        qtdeArrecadada: ocBalance,
        qtdePericia: 0,
        numeroProcesso: licitationNumber,
        itemSolicitado: itemSolicitado
      };
      lic.ocs.push(newOC);
      lic.balance = Math.max(0, (lic.balance || 0) - ocBalance);
      lic.ocConsumed = (lic.ocConsumed || 0) + ocBalance;
  
      try {
        await db.collection("licitacoes").doc(lic.docId).update({
          ocs: lic.ocs,
          balance: lic.balance,
          ocConsumed: lic.ocConsumed
        });
      } catch (err) {
        console.error("Erro ao atualizar licitação com novo OC:", err);
      }
    }
    modalNovaOC.style.display = "none";
    renderLicitacoes();
  }
  
  /* ---------- Group Licitações by PI ---------- */
  function groupByItem(licitacoes) {
    const map = {};
    licitacoes.forEach(lic => {
      const piKey = (lic.pi || "").trim().toUpperCase();
      if (!map[piKey]) {
        map[piKey] = {
          pi: lic.pi,
          itemSolicitado: lic.itemSolicitado,
          categoria: lic.categoria,
          cmm: lic.cmm || 0,
          totalQuantity: lic.totalQuantity || 0,
          ocConsumed: lic.ocConsumed || 0,
          ocTotal: lic.ocTotal || 0,
          balance: lic.balance || 0,
          comprometido: lic.comprometido || 0,
          licitations: [lic],
          comentarios: lic.comentarios || [],
          newCommentCount: lic.newCommentCount || 0
        };
      } else {
        map[piKey].totalQuantity += lic.totalQuantity || 0;
        map[piKey].ocConsumed += lic.ocConsumed || 0;
        map[piKey].ocTotal += lic.ocTotal || 0;
        map[piKey].balance = lic.balance || 0;
        map[piKey].comprometido = lic.comprometido || 0;
        map[piKey].newCommentCount = Math.max(map[piKey].newCommentCount, lic.newCommentCount || 0);
        map[piKey].comentarios = map[piKey].comentarios.concat(lic.comentarios || []);
        map[piKey].licitations.push(lic);
      }
    });
    return Object.values(map);
  }
  
  /* ---------- Render Licitação Cards ---------- */
  function renderLicitacoes() {
    if (!licitacaoCards) return;
    licitacaoCards.innerHTML = "";
    licitacaoCards.style.display = "flex";
    licitacaoCards.style.flexWrap = "wrap";
    licitacaoCards.style.justifyContent = "flex-start";
  
    let items = groupByItem(licitacoes);
    const searchTerm = licitacoesSearch ? licitacoesSearch.value.toLowerCase() : "";
    if (searchTerm) {
      items = items.filter(item =>
        (item.itemSolicitado || "").toLowerCase().includes(searchTerm) ||
        (item.pi || "").toLowerCase().includes(searchTerm)
      );
    }
    let categoryFilter = "all";
    filterCategoryRadios.forEach(radio => {
      if (radio.checked) categoryFilter = radio.value;
    });
    if (categoryFilter !== "all") {
      items = items.filter(item => (item.categoria || "").toLowerCase() === categoryFilter.toLowerCase());
    }
    items.sort((a, b) => (a.itemSolicitado || "").localeCompare(b.itemSolicitado || ""));
  
    items.forEach((item, groupIdx) => {
      const total = item.totalQuantity;
      const used = item.ocConsumed;
      const remaining = total - used;
      let usageHTML = "";
      if (item.licitations && item.licitations.length > 0) {
        usageHTML = item.licitations.map((lic, licIndex) => {
          const usedLic = lic.ocConsumed || 0;
          const totalLic = lic.totalQuantity || 0;
          const percent = totalLic > 0 ? Math.round((usedLic / totalLic) * 100) : 0;
          let colorClass = "usage-green";
          if (percent >= 80) colorClass = "usage-red";
          else if (percent >= 50) colorClass = "usage-orange";
          const restamInfoId = `restamInfo_${lic.id}`;
          return `
            <div class="usage-row ${colorClass}" onclick="toggleLicDetail('${restamInfoId}', event)">
              <span>${percent}% used</span>
              <span>Licitação ${lic.numeroProcesso}</span>
              <span>${formatDate(lic.vencimentoAta)}</span>
            </div>
            <div id="${restamInfoId}" style="display:none; margin-left:1rem; font-size:0.85rem; color:#333;">
              Restam ${formatNumber(totalLic - usedLic)}KG de ${formatNumber(totalLic)}KG<br>
              <button class="edit-lic-btn" onclick="event.stopPropagation(); editSingleLicitacao(${lic.id});">Editar Licitação</button>
              <button class="delete-lic-btn" onclick="event.stopPropagation(); deleteSingleLicitacao(${lic.id});">Excluir Licitação</button>
            </div>
          `;
        }).join("");
      }
      let autonomia = "N/A";
      if (item.cmm > 0) {
        autonomia = item.balance / item.cmm;
      }
      const dispPlusComp = item.balance + item.comprometido;
      let autCob = "N/A";
      if (item.cmm > 0) {
        autCob = dispPlusComp / item.cmm;
      }
      const card = document.createElement("div");
      card.className = "item-card fancy-card";
      card.style.margin = "10px";
      card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      card.style.backgroundColor = "#fff";
      card.style.width = "300px";
      card.innerHTML = `
        <h2 class="item-name">${item.itemSolicitado || ""}</h2>
        <div class="lic-usage-list">${usageHTML}</div>
        <div class="item-stats">
          <p><strong>Autonomia:</strong> <span>${formatNumber(autonomia)} meses</span></p>
          <p><strong>CMM:</strong> <span>${formatNumber(item.cmm)}</span></p>
          <p><strong>Disp. p/lib:</strong> <span>${formatNumber(item.balance)} KG</span></p>
          <p><strong>Comprometido:</strong> <span>${formatNumber(item.comprometido)} KG</span></p>
          <p><strong>Disp. + comp.:</strong> <span>${formatNumber(dispPlusComp)} KG</span></p>
          <p><strong>Aut. c/ cob.:</strong> <span>${formatNumber(autCob)} meses</span></p>
          <p><strong>Em OC:</strong> <span>${formatNumber(item.ocConsumed)} KG</span></p>
        </div>
        <div class="card-actions">
          <button class="comments-btn" onclick="openComentariosByItem('${item.pi}')" title="Comentários">
            <i class="bi bi-chat-dots"></i>
            ${item.newCommentCount && item.newCommentCount > 0 ? `<span class="new-comment-badge">${item.newCommentCount}</span>` : ""}
          </button>
          <button onclick="verificarOCsByItem('${item.pi}')" title="Dashboard de OCs">
            <i class="bi bi-bar-chart"></i>
          </button>
          <!-- Pass both PI and itemSolicitado to openNovaOCModal -->
          <button onclick="openNovaOCModal('${item.pi}', '${item.itemSolicitado}')" title="Adicionar OC Manual">
            <i class="bi bi-plus-square"></i>
          </button>
          <button onclick="addNewLicitacaoForPI('${item.pi}')" title="Adicionar nova licitação para este PI">
            <i class="bi bi-plus"></i>
          </button>
          <button onclick="editItemByPI('${item.pi}')" title="Editar Licitação">
            <i class="bi bi-pencil"></i>
          </button>
          <button onclick="deleteItemByPI('${item.pi}')" title="Excluir Licitações deste PI">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `;
      licitacaoCards.appendChild(card);
    });
  }
  
  /* ---------- Toggle Detail ---------- */
  window.toggleLicDetail = function(elemId, event) {
    if (event) event.stopPropagation();
    const elem = document.getElementById(elemId);
    if (!elem) return;
    elem.style.display = (elem.style.display === 'none') ? 'block' : 'none';
  };
  
  /* ---------- Single Licitação Edit/Delete ---------- */
  window.editSingleLicitacao = function(licId) {
    if (!confirm("Deseja editar esta licitação?")) return;
    const lic = licitacoes.find(l => l.id === licId);
    if (!lic) return;
    if (formEditLicitacao) formEditLicitacao.reset();
    if (formEditLicitacao.elements['id']) formEditLicitacao.elements['id'].value = lic.id;
    formEditLicitacao.elements['numeroProcesso'].value = lic.numeroProcesso || "";
    formEditLicitacao.elements['nomeEmpresa'].value = lic.nomeEmpresa || "";
    formEditLicitacao.elements['telefoneEmpresa'].value = lic.telefoneEmpresa || "";
    formEditLicitacao.elements['itemSolicitado'].value = lic.itemSolicitado || "";
    formEditLicitacao.elements['pi'].value = lic.pi || "";
    formEditLicitacao.elements['vencimentoAta'].value = lic.vencimentoAta || "";
    formEditLicitacao.elements['status'].value = lic.status || "";
    formEditLicitacao.elements['balance'].value = lic.totalQuantity || 0;
    formEditLicitacao.elements['categoria'].value = lic.categoria || "";
    formEditLicitacao.elements['cmm'].value = lic.cmm || 0;
    openModal(modalEditLicitacao);
  };
  
  window.deleteSingleLicitacao = async function(licId) {
    if (!confirm("Tem certeza que deseja excluir APENAS esta licitação?")) return;
    const lic = licitacoes.find(l => l.id === licId);
    if (!lic) return;
    try {
      await db.collection("licitacoes").doc(lic.docId).delete();
      licitacoes = licitacoes.filter(x => x.id !== lic.id);
      renderLicitacoes();
    } catch (err) {
      console.error("Error deleting single licitacao:", err);
    }
  };
  
  /* ---------- Licitação Edit/Delete Group ---------- */
  window.editItemByPI = function(pi) {
    const lic = licitacoes.find(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
    if (!lic) return;
    if (formEditLicitacao) formEditLicitacao.reset();
    if (formEditLicitacao.elements['id']) formEditLicitacao.elements['id'].value = lic.id;
    formEditLicitacao.elements['numeroProcesso'].value = lic.numeroProcesso || "";
    formEditLicitacao.elements['nomeEmpresa'].value = lic.nomeEmpresa || "";
    formEditLicitacao.elements['telefoneEmpresa'].value = lic.telefoneEmpresa || "";
    formEditLicitacao.elements['itemSolicitado'].value = lic.itemSolicitado || "";
    formEditLicitacao.elements['pi'].value = lic.pi || "";
    formEditLicitacao.elements['vencimentoAta'].value = lic.vencimentoAta || "";
    formEditLicitacao.elements['status'].value = lic.status || "";
    formEditLicitacao.elements['balance'].value = lic.totalQuantity || 0;
    formEditLicitacao.elements['categoria'].value = lic.categoria || "";
    formEditLicitacao.elements['cmm'].value = lic.cmm || 0;
    openModal(modalEditLicitacao);
  };
  
  window.deleteItemByPI = async function(pi) {
    if (!confirm("Tem certeza que deseja excluir TODAS as licitações deste PI?")) return;
    const group = licitacoes.filter(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
    for (const lic of group) {
      try {
        await db.collection("licitacoes").doc(lic.docId).delete();
      } catch (err) {
        console.error("Error deleting licitacao:", err);
      }
      licitacoes = licitacoes.filter(x => x.id !== lic.id);
    }
    renderLicitacoes();
  };
  
  window.addNewLicitacaoForPI = function(pi) {
    if (formLicitacao) {
      formLicitacao.reset();
      formLicitacao.elements['pi'].value = pi;
      const lic = licitacoes.find(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
      if (lic) {
        formLicitacao.elements['itemSolicitado'].value = lic.itemSolicitado;
        formLicitacao.elements['categoria'].value = lic.categoria;
        formLicitacao.elements['balance'].value = lic.totalQuantity || 0;
        formLicitacao.elements['cmm'].value = lic.cmm || 0;
      }
      openModal(modalLicitacao);
    }
  };
  
  /* ---------- Form Submission: Nova Licitação ---------- */
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
        pi: fd.get('pi'),
        vencimentoAta: fd.get('vencimentoAta'),
        status: fd.get('status'),
        totalQuantity: totalQty,
        balance: 0,
        ocTotal: 0,
        ocConsumed: 0,
        comprometido: 0,
        ocs: [],
        comentarios: [],
        newCommentCount: 0,
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
  
  /* ---------- Form Submission: Edit Licitação ---------- */
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
      lic.pi = fd.get('pi');
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
  
  /* ---------- Form Submission: Comentários (Chat) ---------- */
  if (formComentarios) {
    formComentarios.addEventListener("submit", async function(e) {
      e.preventDefault();
      const piVal = formComentarios.elements["licitacaoId"].value.toUpperCase();
      const group = licitacoes.filter(l => l.pi && l.pi.toUpperCase() === piVal);
      if (group.length === 0) return;
      const newMsg = {
        text: formComentarios.elements["newMessage"].value,
        time: new Date()
      };
      group.forEach(lic => {
        lic.comentarios.push(newMsg);
        lic.newCommentCount = lic.comentarios.length;
      });
      for (const lic of group) {
        try {
          await db.collection("licitacoes").doc(lic.docId).update({
            comentarios: lic.comentarios,
            newCommentCount: lic.newCommentCount
          });
        } catch (err) {
          console.error("Erro ao atualizar comentarios:", err);
        }
      }
      formComentarios.elements["newMessage"].value = "";
      closeModal(modalComentarios);
      renderLicitacoes();
    });
  }
  
  /* ---------- Load Data from Firestore ---------- */
  async function loadData() {
    try {
      licitacoes = [];
      const licSnapshot = await db.collection("licitacoes").get();
      licSnapshot.forEach(doc => {
        const licData = doc.data();
        licData.docId = doc.id;
        if (!licData.comentarios) licData.comentarios = [];
        licData.ocConsumed = licData.ocConsumed || 0;
        licData.comprometido = licData.comprometido || 0;
        licData.newCommentCount = licData.newCommentCount || 0;
        licitacoes.push(licData);
        if (licData.id >= licitacaoIdCounter) {
          licitacaoIdCounter = licData.id + 1;
        }
      });
      renderLicitacoes();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }
  await loadData();
  
  if (licitacoesSearch) {
    licitacoesSearch.addEventListener("input", renderLicitacoes);
  }
  if (filterCategoryRadios) {
    filterCategoryRadios.forEach(radio => {
      radio.addEventListener('change', renderLicitacoes);
    });
  }
});

/* ---------- Additional Functions for Licitação Detail Editing ---------- */
function editSingleLicitacao(licId) {
  if (!confirm("Deseja editar esta licitação?")) return;
  const lic = licitacoes.find(l => l.id === licId);
  if (!lic) return;
  if (formEditLicitacao) formEditLicitacao.reset();
  if (formEditLicitacao.elements['id']) formEditLicitacao.elements['id'].value = lic.id;
  formEditLicitacao.elements['numeroProcesso'].value = lic.numeroProcesso || "";
  formEditLicitacao.elements['nomeEmpresa'].value = lic.nomeEmpresa || "";
  formEditLicitacao.elements['telefoneEmpresa'].value = lic.telefoneEmpresa || "";
  formEditLicitacao.elements['itemSolicitado'].value = lic.itemSolicitado || "";
  formEditLicitacao.elements['pi'].value = lic.pi || "";
  formEditLicitacao.elements['vencimentoAta'].value = lic.vencimentoAta || "";
  formEditLicitacao.elements['status'].value = lic.status || "";
  formEditLicitacao.elements['balance'].value = lic.totalQuantity || 0;
  formEditLicitacao.elements['categoria'].value = lic.categoria || "";
  formEditLicitacao.elements['cmm'].value = lic.cmm || 0;
  openModal(modalEditLicitacao);
}

function deleteSingleLicitacao(licId) {
  if (!confirm("Tem certeza que deseja excluir APENAS esta licitação?")) return;
  const lic = licitacoes.find(l => l.id === licId);
  if (!lic) return;
  db.collection("licitacoes").doc(lic.docId).delete().then(() => {
    licitacoes = licitacoes.filter(x => x.id !== lic.id);
    renderLicitacoes();
  }).catch(err => {
    console.error("Error deleting single licitacao:", err);
  });
}

/* ---------- Chat Functions ---------- */
window.openComentariosByItem = function(pi) {
  const lic = licitacoes.find(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
  if (!lic) return;
  chatMessages.innerHTML = "";
  (lic.comentarios || []).forEach((msg, index) => {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.innerHTML = `
      <p>${msg.text}</p>
      <span class="chat-time">${formatTime(msg.time)}</span>
      <button class="delete-comment-btn" onclick="deleteChatMessage('${pi}', ${index})">Delete</button>
    `;
    chatMessages.appendChild(bubble);
  });
  if (formComentarios.elements["licitacaoId"]) {
    formComentarios.elements["licitacaoId"].value = pi;
  }
  openModal(modalComentarios);
};
  
window.deleteChatMessage = async function(pi, index) {
  const group = licitacoes.filter(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
  if (!group || group.length === 0) return;
  group.forEach(lic => {
    if (lic.comentarios && lic.comentarios.length > index) {
      lic.comentarios.splice(index, 1);
      lic.newCommentCount = lic.comentarios.length;
    }
  });
  for (const lic of group) {
    try {
      await db.collection("licitacoes").doc(lic.docId).update({
        comentarios: lic.comentarios,
        newCommentCount: lic.newCommentCount
      });
    } catch (err) {
      console.error("Erro ao deletar comentário para PI " + pi, err);
    }
  }
  renderLicitacoes();
  window.openComentariosByItem(pi);
};
  
/* ---------- OC Dashboard ---------- */
window.verificarOCsByItem = function(pi) {
  const group = licitacoes.filter(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
  if (group.length === 0) return;
  let totalOC = 0;
  let totalArrecadado = 0;
  let totalPericia = 0;
  group.forEach(lic => {
    totalOC += lic.ocTotal || 0;
    totalArrecadado += lic.ocConsumed || 0;
    if (lic.ocs && lic.ocs.length > 0) {
      lic.ocs.forEach(oc => {
        totalPericia += (oc.qtdePericia || 0);
      });
    }
  });
  if (document.getElementById("ocTotalValue")) {
    document.getElementById("ocTotalValue").textContent = formatNumber(totalOC) + " KG";
  }
  if (document.getElementById("ocArrecadadoValue")) {
    document.getElementById("ocArrecadadoValue").textContent = formatNumber(totalArrecadado) + " KG";
  }
  if (document.getElementById("ocPericiaValue")) {
    document.getElementById("ocPericiaValue").textContent = formatNumber(totalPericia) + " KG";
  }
  const dashboardDiv = document.getElementById("ocDashboardContent");
  if (!dashboardDiv) return;
  let html = "";
  group.forEach(lic => {
    if (lic.ocs && lic.ocs.length > 0) {
      lic.ocs.sort((a, b) => a.codigo.localeCompare(b.codigo));
      const ocHtml = lic.ocs.map(oc => `
        <div class="oc-item">
          <p><strong>OC Código:</strong> ${oc.codigo}</p>
          <p><strong>OC Total:</strong> ${formatNumber(oc.qtdeComprada)} KG</p>
          <p><strong>Arrecadado:</strong> ${formatNumber(oc.qtdeArrecadada)} KG</p>
          <p><strong>Perícia:</strong> ${formatNumber(oc.qtdePericia)} KG</p>
          <p><strong>Número do Processo:</strong> ${oc.numeroProcesso}</p>
          <button class="delete-oc-btn" data-pi="${lic.pi}" data-codigo="${oc.codigo}" title="Excluir OC">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `).join("<hr>");
      html += ocHtml + "<br>";
    } else {
      html += `<div class="oc-item"><p>Nenhuma OC cadastrada para ${lic.numeroProcesso}</p></div><br>`;
    }
  });
  if (!html) html = "<p>Nenhuma OC cadastrada.</p>";
  dashboardDiv.innerHTML = html;
  dashboardDiv.querySelectorAll('.delete-oc-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const piVal = this.getAttribute('data-pi');
      const codigoVal = this.getAttribute('data-codigo');
      if (confirm("Tem certeza que deseja excluir esta OC?")) {
        deleteOC(piVal, codigoVal);
      }
    });
  });
  openModal(modalVerificarOCs);
};
  
window.deleteOC = async function(pi, codigo) {
  const matchingLics = licitacoes.filter(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
  if (matchingLics.length === 0) return;
  for (const lic of matchingLics) {
    if (lic.ocs) {
      lic.ocs = lic.ocs.filter(oc => oc.codigo !== codigo);
      lic.ocTotal = lic.ocs.reduce((acc, oc) => acc + oc.qtdeComprada, 0);
      lic.ocConsumed = lic.ocs.reduce((acc, oc) => acc + oc.qtdeArrecadada, 0);
      try {
        await db.collection("licitacoes").doc(lic.docId).update({
          ocs: lic.ocs,
          ocTotal: lic.ocTotal,
          ocConsumed: lic.ocConsumed
        });
      } catch (err) {
        console.error("Erro ao excluir OC para PI " + lic.pi, err);
      }
    }
  }
  renderLicitacoes();
  verificarOCsByItem(pi);
};
  
/* ---------- Profile Menu & Auth Logic ---------- */
const profileButton = document.getElementById('profileButton');
const profileDropdown = document.getElementById('profileDropdown');
const resetPasswordLink = document.getElementById('resetPasswordLink');
const logoutLink = document.getElementById('logoutLink');

profileButton.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown.style.display = (profileDropdown.style.display === 'block') ? 'none' : 'block';
});
  
document.addEventListener('click', (e) => {
  if (!profileDropdown.contains(e.target) && e.target !== profileButton) {
    profileDropdown.style.display = 'none';
  }
});
  
resetPasswordLink.addEventListener('click', async (e) => {
  e.preventDefault();
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Nenhum usuário logado. Faça login primeiro.");
    return;
  }
  try {
    await firebase.auth().sendPasswordResetEmail(user.email);
    alert("Email de redefinição de senha enviado para: " + user.email);
  } catch (error) {
    console.error(error);
    alert("Erro ao enviar redefinição de senha: " + error.message);
  }
  profileDropdown.style.display = 'none';
});
  
logoutLink.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await firebase.auth().signOut();
    window.location.href = "index.html";
  } catch (error) {
    console.error(error);
    alert("Erro ao fazer logout: " + error.message);
  }
  profileDropdown.style.display = 'none';
});
  
firebase.auth().onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
  }
});
