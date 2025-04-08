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

  // Helper Functions
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
  // Helper to remove all double quotes and trim whitespace (for CSV parsing)
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

  // Data Arrays and Counters
  let licitacoes = [];
  let licitacaoIdCounter = 1;

  // DOM Elements
  const fab = document.querySelector('.fab');
  const fabMenu = document.getElementById('fabMenu');
  const btnNewLicitacao = document.getElementById('btnNewLicitacao');
  const licitacaoCards = document.getElementById('licitacaoCards');
  const fileEstoqueInput = document.getElementById('fileEstoque');
  const btnImportEstoque = document.getElementById('btnImportEstoque');
  const fileOCInput = document.getElementById('fileOC');
  const btnImportOC = document.getElementById('btnImportOC');
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

  // Modal Show/Close functions
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

  // FAB Menu Toggle
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

  // CSV Export Function
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

  // Import Estoque (updates disp.p/lib via spreadsheet)
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
          // Update all licitações with matching PI using a for-of loop
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

  // Import OC (now matching first by PI and then by NUMERO_PROCESSO)
  if (btnImportOC && fileOCInput) {
    btnImportOC.addEventListener('click', function() {
      fileOCInput.click();
    });
    fileOCInput.addEventListener('change', async function() {
      const file = fileOCInput.files[0];
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
        // Get index for PI and NUMERO_PROCESSO along with others
        const piIndex = headers.indexOf("PI");
        const procIndex = headers.indexOf("NUMERO_PROCESSO");
        const codIndex = headers.indexOf("CODIGO");
        const qtdeCompIndex = headers.indexOf("QTDE_COMPRADA");
        const qtdeArrIndex = headers.indexOf("QTDE_ARRECADADA");
        const qtdePericiaIndex = headers.indexOf("QTDE_PERICIA_ESTOCAGEM");
        if (piIndex < 0 || procIndex < 0 || codIndex < 0 || qtdeCompIndex < 0 ||
            qtdeArrIndex < 0 || qtdePericiaIndex < 0) {
          alert("Uma ou mais colunas (PI, NUMERO_PROCESSO, CODIGO, QTDE_COMPRADA, QTDE_ARRECADADA, QTDE_PERICIA_ESTOCAGEM) não foram encontradas.");
          hideImportLoadingModal();
          return;
        }
        let errorMessages = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",");
          if (row.length < headers.length) continue;
          const piValue = removeExtraQuotes(row[piIndex]).toUpperCase();
          const numProc = removeExtraQuotes(row[procIndex]).toUpperCase();
          const codigo = removeExtraQuotes(row[codIndex]);
          const qtdeComp = parseNumber(removeExtraQuotes(row[qtdeCompIndex]));
          const qtdeArr = parseNumber(removeExtraQuotes(row[qtdeArrIndex]));
          const qtdePericia = parseNumber(removeExtraQuotes(row[qtdePericiaIndex]));
          // Find licitação by first matching PI and then matching process number
          const lic = licitacoes.find(l =>
            l.pi && l.pi.toUpperCase() === piValue &&
            l.numeroProcesso && l.numeroProcesso.toUpperCase() === numProc
          );
          if (!lic) {
            errorMessages.push(`Licitação com PI ${piValue} e Processo ${numProc} não encontrada. Linha ${i+1}`);
            continue;
          }
          if (!lic.ocs) lic.ocs = [];
          const existingOC = lic.ocs.find(oc => oc.codigo === codigo);
          if (existingOC) {
            existingOC.qtdeComprada = qtdeComp;
            existingOC.qtdeArrecadada = qtdeArr;
            existingOC.qtdePericia = qtdePericia;
            // Update process number if needed
            existingOC.numeroProcesso = numProc;
          } else {
            lic.ocs.push({
              codigo,
              qtdeComprada: qtdeComp,
              qtdeArrecadada: qtdeArr,
              qtdePericia,
              numeroProcesso: numProc
            });
          }
        }
        // Recalculate totals for OC-related fields
        licitacoes.forEach(lic => {
          if (lic.ocs && lic.ocs.length > 0) {
            lic.ocTotal = lic.ocs.reduce((acc, oc) => acc + oc.qtdeComprada, 0);
            lic.ocConsumed = lic.ocs.reduce((acc, oc) => acc + oc.qtdeArrecadada, 0);
          }
        });
        // Update Firestore for each licitação that has OCs
        for (const lic of licitacoes) {
          if (lic.ocs) {
            try {
              await db.collection("licitacoes").doc(lic.docId).update({
                ocTotal: lic.ocTotal,
                ocConsumed: lic.ocConsumed,
                ocs: lic.ocs
              });
            } catch (err) {
              console.error("Erro ao atualizar Firestore (OC):", err);
              errorMessages.push(`Erro ao atualizar licitação com Processo ${lic.numeroProcesso}`);
            }
          }
        }
        renderLicitacoes();
        if (errorMessages.length > 0) {
          alert("Alguns itens não foram importados:\n" + errorMessages.join("\n"));
        } else {
          alert("Planilha de OC importada com sucesso!");
        }
      } catch (error) {
        console.error(error);
        alert("Erro ao importar OC: " + error.message);
      } finally {
        hideImportLoadingModal();
        fileOCInput.value = "";
        const lastUpdateElem = document.getElementById("lastUpdateInfo");
        if (lastUpdateElem) {
          const now = new Date();
          lastUpdateElem.textContent = "Última atualização: " + now.toLocaleString();
        }
      }
    });
  }

  // Group licitações by PI using updated aggregation for newCommentCount
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
        // Overwrite imported fields with latest values (assumed identical for the group)
        map[piKey].balance = lic.balance || 0;
        map[piKey].comprometido = lic.comprometido || 0;
        // Instead of summing, take the maximum newCommentCount
        map[piKey].newCommentCount = Math.max(map[piKey].newCommentCount, lic.newCommentCount || 0);
        map[piKey].comentarios = map[piKey].comentarios.concat(lic.comentarios || []);
        map[piKey].licitations.push(lic);
      }
    });
    return Object.values(map);
  }

  // Render item cards
  function renderLicitacoes() {
    if (!licitacaoCards) return;
    licitacaoCards.innerHTML = "";
    // Flex layout settings
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
    items.forEach(item => {
      const total = item.totalQuantity;
      const used = item.ocConsumed;
      const remaining = total - used;
      let usageHTML = "";
      if (item.licitations && item.licitations.length > 0) {
        usageHTML = item.licitations.map(lic => {
          const usedLic = lic.ocConsumed || 0;
          const totalLic = lic.totalQuantity || 0;
          const percent = totalLic > 0 ? Math.round((usedLic / totalLic) * 100) : 0;
          let colorClass = "usage-green";
          if (percent >= 80) colorClass = "usage-red";
          else if (percent >= 50) colorClass = "usage-orange";
          return `
            <div class="usage-row ${colorClass}">
              <span>${percent}% used</span>
              <span>Licitação ${lic.numeroProcesso}</span>
              <span>${formatDate(lic.vencimentoAta)}</span>
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
        <p style="margin-bottom: 0.75rem;">
          Restam <strong>${formatNumber(remaining)}KG</strong> de <strong>${formatNumber(total)}KG</strong>
        </p>
        <div class="lic-usage-list">
          ${usageHTML}
        </div>
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
          <button onclick="addNewLicitacaoForPI('${item.pi}')" title="Adicionar nova licitação para este PI">
            <i class="bi bi-plus"></i>
          </button>
          <button onclick="editItemByPI('${item.pi}')" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button onclick="deleteItemByPI('${item.pi}')" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `;
      licitacaoCards.appendChild(card);
    });
  }

  // Chat functions
  window.openComentariosByItem = function(pi) {
    // Use the first licitação's comments for the given PI
    const lic = licitacoes.find(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
    if (!lic) return;
    
    chatMessages.innerHTML = "";
    (lic.comentarios || []).forEach((msg, index) => {
      const bubble = document.createElement('div');
      bubble.className = "chat-bubble";
      bubble.innerHTML = `
        <p>${msg.text}</p>
        <span class="chat-time">${formatTime(msg.time)}</span>
        <button onclick="deleteChatMessage('${pi}', ${index})">Delete</button>
      `;
      chatMessages.appendChild(bubble);
    });
    if (formComentarios.elements["licitacaoId"]) {
      formComentarios.elements["licitacaoId"].value = pi;
    }
    openModal(modalComentarios);
  };

  window.deleteChatMessage = async function(pi, index) {
    // Find all licitações with this PI (assumed to share the same comments)
    const group = licitacoes.filter(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
    if (!group || group.length === 0) return;
    group.forEach(lic => {
      if (lic.comentarios && lic.comentarios.length > index) {
        lic.comentarios.splice(index, 1);
        lic.newCommentCount = lic.newCommentCount > 0 ? lic.newCommentCount - 1 : 0;
      }
    });
    // Update Firestore for each licitação in the group
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

  // OC Dashboard for group by PI (delete button already includes a confirm)
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
    // Attach delete listeners with confirmation
    dashboardDiv.querySelectorAll('.delete-oc-btn').forEach(button => {
      button.addEventListener('click', function(e) {
        e.stopPropagation();
        const pi = this.getAttribute('data-pi');
        const codigo = this.getAttribute('data-codigo');
        if (confirm("Tem certeza que deseja excluir esta OC?")) {
          deleteOC(pi, codigo);
        }
      });
    });
    openModal(modalVerificarOCs);
  };

  // Function to delete a specific OC for all licitações with the given PI
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
  };

  // Edit / Delete licitação by PI
  window.editItemByPI = function(pi) {
    const lic = licitacoes.find(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
    if (!lic) return;
    if (formEditLicitacao) formEditLicitacao.reset();
    if (formEditLicitacao.elements['id']) formEditLicitacao.elements['id'].value = lic.id;
    formEditLicitacao.elements['numeroProcesso'].value = lic.numeroProcesso;
    formEditLicitacao.elements['nomeEmpresa'].value = lic.nomeEmpresa;
    formEditLicitacao.elements['telefoneEmpresa'].value = lic.telefoneEmpresa;
    formEditLicitacao.elements['itemSolicitado'].value = lic.itemSolicitado;
    formEditLicitacao.elements['pi'].value = lic.pi;
    formEditLicitacao.elements['vencimentoAta'].value = lic.vencimentoAta;
    formEditLicitacao.elements['status'].value = lic.status;
    formEditLicitacao.elements['balance'].value = lic.totalQuantity || 0;
    formEditLicitacao.elements['categoria'].value = lic.categoria;
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

  // New function: Add New Licitação for existing PI
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

  // Form Submission: Nova Licitação
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
        balance: 0, // Manually added licitações do not update "Disp.p/lib"
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

  // Form Submission: Edit Licitação
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

  // Form Submission: Comentários (Chat)
  if (formComentarios) {
    formComentarios.addEventListener("submit", async function(e) {
      e.preventDefault();
      const pi = formComentarios.elements["licitacaoId"].value.toUpperCase();
      const group = licitacoes.filter(l => l.pi && l.pi.toUpperCase() === pi);
      if (group.length === 0) return;
      const newMsg = {
        text: formComentarios.elements["newMessage"].value,
        time: new Date()
      };
      group.forEach(lic => {
        lic.comentarios.push(newMsg);
        lic.newCommentCount = (lic.newCommentCount || 0) + 1;
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

  // Load Data from Firestore
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

  // Attach event listeners for search & category filter
  if (licitacoesSearch) {
    licitacoesSearch.addEventListener("input", renderLicitacoes);
  }
  if (filterCategoryRadios) {
    filterCategoryRadios.forEach(radio => {
      radio.addEventListener('change', renderLicitacoes);
    });
  }
});

// Profile Menu & Auth Logic
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
