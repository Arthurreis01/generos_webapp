// ===== Global Firebase Initialization & Global Variables =====
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

var licitacoes = [];           // Global array for licitações
var licitacaoIdCounter = 1;    // Global counter

// ===== Global Helper Functions =====
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

// Global openModal and closeModal functions
function openModal(modal) {
  if (modal) modal.style.display = 'flex';
}

function closeModal(modal) {
  if (modal) modal.style.display = 'none';
}

// ===== Main Code: Run after DOM is Loaded =====
document.addEventListener("DOMContentLoaded", async function() {
  // Restore persisted "Última atualização" on page load
  const saved = localStorage.getItem('lastUpdateInfo');
  if (saved) {
    const updEl = document.getElementById('lastUpdateInfo');
    if (updEl) updEl.textContent = saved;
  }

  const db = firebase.firestore();

  // ----- DOM Elements -----
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
  const exportOCsBtn = document.getElementById('exportOCsBtn');
  if (exportOCsBtn) {
    exportOCsBtn.addEventListener('click', exportAllOCs);
  }
    const CENTERS = [
    { code: '84810', name: 'CEIMBE'   },
    { code: '87010', name: 'CEIMBRA'  },
    { code: '86810', name: 'CEIMLA'   },
    { code: '88820', name: 'CEIMMA'   },
    { code: '83810', name: 'CEIMNA'   },
    { code: '91010', name: 'CEIMNI'   },
    { code: '31060', name: 'CEIMPL'   },
    { code: '85810', name: 'CEIMRG'   },
    { code: '82802', name: 'CEIMSA'   },
    { code: '91181', name: 'CEIMSPA'  }
  ];
  

  // Modal for Manual OC Addition
  const modalNovaOC = document.getElementById("modalNovaOC");
  const formNovaOC = document.getElementById("formNovaOC");
  let newOC_pi = null;

  // ----- Modal Show/Close Event Listeners -----
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

  // ----- FAB Menu Logic -----
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

// ===== Export all OCs across every PI as .xlsx =====
function exportAllOCs() {
  const allOCs = [];
  licitacoes.forEach(lic => {
    (lic.ocs || []).forEach(oc => {
      allOCs.push({
        Processo:      lic.numeroProcesso,
        Item:          lic.itemSolicitado,
        Código_OC:     oc.codigo,
        Comprada:      oc.qtdeComprada,
        Arrecadada:    oc.qtdeArrecadada,
        Pericia:       oc.qtdePericia
      });
    });
  });

  if (allOCs.length === 0) {
    alert('Não há OCs para exportar.');
    return;
  }

  const ws = XLSX.utils.json_to_sheet(allOCs);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'OCs');
  XLSX.writeFile(wb, 'ocs_export.xlsx');
}

/**
 * Export an array of objects to a true .xlsx file.
 * @param {Array<Object>} data    – your array of rows
 * @param {string[]}      headers – the columns, in order
 * @param {string}        fileName– the download filename (will append .xlsx if missing)
 */
function exportDataToXLSX(data, headers, fileName) {
  // 1) Build a 2D array: first row = headers, then one row per data item
  const worksheetData = [
    headers,
    ...data.map(item => headers.map(h => item[h] != null ? item[h] : ""))
  ];

  // 2) Create a worksheet & workbook
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  // 3) Write it out as an ArrayBuffer
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });

  // 4) Trigger download
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

document.getElementById("exportLicitacoesBtn")?.addEventListener("click", () => {
  const headers = [
    "id","numeroProcesso","nomeEmpresa","telefoneEmpresa","itemSolicitado",
    "vencimentoAta","status","totalQuantity","balance","ocTotal","ocConsumed",
    "categoria","cmm","pi","comprometido"
  ];
  exportDataToXLSX(licitacoes, headers, "licitacoes_export");
});


  // ----- Import Estoque -----
  if (btnImportEstoque && fileEstoqueInput) {
    btnImportEstoque.addEventListener('click', () => fileEstoqueInput.click());

    fileEstoqueInput.addEventListener('change', async function() {
      const file = this.files[0];
      if (!file) return;
      showImportLoadingModal();

      try {
        // Read workbook (csv or xls/xlsx)
        const ext = file.name.split('.').pop().toLowerCase();
        let data = ext === 'csv'
          ? await file.text()
          : await file.arrayBuffer();
        const readOpts = ext === 'csv'
          ? { type: 'string', raw: false }
          : { type: 'array',  raw: false };
        const workbook = XLSX.read(data, readOpts);

        // Extract rows
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        if (rows.length < 2) throw new Error('Planilha sem conteúdo.');

        // Find columns
        const headers = rows[0].map(h => h ? String(h).trim().toUpperCase() : '');
        const piIdx   = headers.indexOf('PI');
        const dispIdx = headers.indexOf('QTDE_DISPONIVEL');
        const compIdx = headers.findIndex(h => h.includes('COMPROMET'));
        if (piIdx < 0 || dispIdx < 0 || compIdx < 0) {
          throw new Error("Faltam colunas PI, QTDE_DISPONIVEL ou 'COMPROMET'.");
        }

        // Update in-memory + Firestore
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const pi   = String(row[piIdx]  || '').trim().toUpperCase();
          const disp = parseNumber(String(row[dispIdx]|| ''));
          const comp = parseNumber(String(row[compIdx]|| ''));

          licitacoes
            .filter(l => l.pi?.toUpperCase() === pi)
            .forEach(async lic => {
              lic.balance      = disp;
              lic.comprometido = comp;
              try {
                await db.collection('licitacoes')
                        .doc(lic.docId)
                        .update({ balance: disp, comprometido: comp });
              } catch (e) {
                console.error('Erro ao atualizar Firestore (Estoque):', e);
              }
            });
        }

        renderLicitacoes();

        // Persist “Última atualização”
        const now = new Date();
        const stamp = `Última atualização: ${formatDate(now.toISOString())} ${formatTime(now)}`;
        const updEl = document.getElementById('lastUpdateInfo');
        if (updEl) {
          updEl.textContent = stamp;
          localStorage.setItem('lastUpdateInfo', stamp);
        }

        alert('Planilha importada com sucesso!');
      } catch (err) {
        console.error(err);
        alert('Erro ao importar estoque: ' + err.message);
      } finally {
        hideImportLoadingModal();
        fileEstoqueInput.value = '';
      }
    });
  }
 
  // ----- Manual OC Addition Per Card -----
  window.openNovaOCModal = function(pi, itemSolicitado) {
    newOC_pi = pi;
    const lic = licitacoes.find(l =>
      l.pi && l.pi.toUpperCase() === pi.toUpperCase() &&
      l.itemSolicitado === itemSolicitado
    );
    if (!lic) {
      alert("Licitação não encontrada!");
      return;
    }
    const numLicInput = document.getElementById("novaOC_numLic");
    numLicInput.removeAttribute("readonly");
    numLicInput.value = lic.numeroProcesso || lic.pi;
    document.getElementById("novaOC_ocNumber").value = "";
    document.getElementById("novaOC_balance").value = "";
    document.getElementById("novaOC_companyName").value = "";
    document.getElementById("novaOC_itemSolicitado").value = lic.itemSolicitado;
    modalNovaOC.style.display = "flex";
  };
  
  if (formNovaOC) {
    formNovaOC.addEventListener("submit", async function(e) {
      e.preventDefault();
      saveNovaOC();
    });
  }
  
  // ----- Save New OC (Manual Addition) -----
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
  
    const matchingLics = licitacoes.filter(l =>
      l.numeroProcesso === licitationNumber && l.itemSolicitado === itemSolicitado
    );
    if (matchingLics.length === 0) {
      alert("Licitação ou item não encontrados para atualização.");
      return;
    }
  
    for (const lic of matchingLics) {
      if (!lic.ocs) lic.ocs = [];
    
      // Create new OC with planned quantity in qtdeComprada.
      // New OC is not marked as "arrecadado" until after pericia.
      const newOC = {
        codigo: ocNumber,
        qtdeComprada: ocBalance,
        qtdeArrecadada: 0,
        qtdePericia: 0,
        numeroProcesso: licitationNumber,
        itemSolicitado: itemSolicitado
      };
      lic.ocs.push(newOC);
    
      // Update only the OC total—do NOT touch lic.balance
      lic.ocTotal = (lic.ocTotal || 0) + ocBalance;
    
      try {
        await db.collection("licitacoes").doc(lic.docId).update({
          ocs: lic.ocs,
          ocTotal: lic.ocTotal
        });
      } catch (err) {
        console.error("Erro ao atualizar licitação com novo OC:", err);
      }
    }
    
    modalNovaOC.style.display = "none";
    renderLicitacoes();
  }    
  
  // ----- Group Licitações by PI -----
  function groupByItem(licitacoesArr) {
    const map = {};
    licitacoesArr.forEach(lic => {
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

 
  // ----- Group Licitações by PI -----
  function groupByItem(licitacoesArr) {
    const map = {};
    licitacoesArr.forEach(lic => {
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
  
// ----- Render Licitação Cards -----
function renderLicitacoes() {
  if (!licitacaoCards) return;

  // 0) Update "Disp. + Comp. Frigorificados" summary
  const totalFrigor = groupByItem(licitacoes)
    .filter(i => (i.categoria || '').toLowerCase() === 'frigorificados')
    .reduce((sum, i) => sum + (i.balance || 0) + (i.comprometido || 0), 0);
  const summaryEl = document.querySelector('#summaryFrigorContainer .summary-value');
  if (summaryEl) summaryEl.textContent = `${formatNumber(totalFrigor)} KG`;

  // 1) Group by PI and drop items without a name
  let items = groupByItem(licitacoes)
    .filter(item => item.itemSolicitado?.trim());

  // 2) Text search
  const term = (licitacoesSearch?.value || '').toLowerCase();
  if (term) {
    items = items.filter(i =>
      i.itemSolicitado.toLowerCase().includes(term) ||
      i.pi.toLowerCase().includes(term)
    );
  }

  // 3) Category & “Em Perícia” radios
  let categoryFilter = 'all';
  filterCategoryRadios.forEach(r => { if (r.checked) categoryFilter = r.value; });
  if (categoryFilter === 'pericia') {
    items = items.filter(i =>
      i.licitations.some(lic =>
        lic.ocs?.some(oc => (oc.qtdePericia || 0) > 0)
      )
    );
  } else if (categoryFilter !== 'all') {
    items = items.filter(i =>
      (i.categoria || '').toLowerCase() === categoryFilter.toLowerCase()
    );
  }

  // 4) Sort alphabetically
  items.sort((a, b) =>
    a.itemSolicitado.localeCompare(b.itemSolicitado)
  );

  // 5) Clear container and set grid styles
  licitacaoCards.innerHTML = '';
  licitacaoCards.style.display        = 'flex';
  licitacaoCards.style.flexWrap       = 'wrap';
  licitacaoCards.style.justifyContent = 'flex-start';

  // 6) Render each card
  items.forEach(item => {
    // --- usage bars ---
    let usageHTML = '';
    item.licitations.forEach(lic => {
      const used  = lic.ocTotal || 0;
      const total = lic.totalQuantity || 0;
      let pct = total ? Math.round((used/total)*100) : 0;
      pct = Math.min(pct, 100);
      const cls = pct >= 80 ? 'usage-red'
                : pct >= 50 ? 'usage-orange'
                : 'usage-green';
      const detailId = `restamInfo_${lic.id}`;
      usageHTML += `
        <div class="usage-row ${cls}" onclick="toggleLicDetail('${detailId}',event)">
          <span>${pct}% usado</span>
          <span>${lic.numeroProcesso}</span>
          <span>${formatDate(lic.vencimentoAta)}</span>
        </div>
        <div id="${detailId}" class="usage-detail" style="display:none; margin-left:1rem; font-size:0.85rem; color:#333;">
          Restam ${formatNumber(total - used)} KG de ${formatNumber(total)} KG<br>
          <button onclick="event.stopPropagation(); editSingleLicitacao(${lic.id});">Editar</button>
          <button onclick="event.stopPropagation(); deleteSingleLicitacao(${lic.id});">Excluir</button>
        </div>
      `;
    });

    // --- basic stats ---
    const autonomia    = item.cmm ? Math.round((item.balance/item.cmm)*30) : 'N/A';
    const dispPlusComp = (item.balance||0) + (item.comprometido||0);
    const autCob       = item.cmm ? Math.round((dispPlusComp/item.cmm)*30) : 'N/A';
    const alertIcon    = (item.cmm && autCob < 30) ? '🚨' : '';

    // --- perícia badge? ---
    const hasPericia = item.licitations.some(lic =>
      lic.ocs?.some(oc => (oc.qtdePericia || 0) > 0)
    );

    // --- due‐soon alert (≤ 90 days) ---
    const now = new Date();
    const dueSoonList = item.licitations
      .map(lic => {
        const due = new Date(lic.vencimentoAta);
        const diffDays = Math.ceil((due - now)/(1000*60*60*24));
        return { lic, diffDays };
      })
      .filter(x => x.diffDays > 0 && x.diffDays <= 90)
      .sort((a,b) => a.diffDays - b.diffDays);

    let dueBadgeHTML = '';
    if (dueSoonList.length > 0) {
      // build multi-line tooltip HTML
      const tooltipHtml = dueSoonList
        .map(({lic, diffDays}) =>
          `<div class="due-tooltip-line">
             <strong>Lic ${lic.numeroProcesso}:</strong> ${diffDays} dias
           </div>`
        ).join('');
      dueBadgeHTML = `
        <div class="due-alert">
          !
          <div class="due-tooltip">
            ${tooltipHtml}
          </div>
        </div>`;
    }

    // --- assemble card ---
    const card = document.createElement('div');
    card.className = 'item-card fancy-card';
    card.style.position = 'relative';
    card.style.margin   = '10px';
    card.style.width    = '300px';
    card.innerHTML = `
      ${dueBadgeHTML}
      ${hasPericia ? `<button class="pericia-btn" title="Em Perícia">P</button>` : ''}
      <h2 class="item-name">${item.itemSolicitado}</h2>
      <div class="lic-usage-list">${usageHTML}</div>
      <div class="item-stats">
        <p><strong>Autonomia:</strong> ${alertIcon}${autonomia} dias</p>
        <p><strong>CMM:</strong> ${formatNumber(item.cmm)}</p>
        <p><strong>Disp. p/lib:</strong> ${formatNumber(item.balance)} KG</p>
        <p><strong>Comprometido:</strong> ${formatNumber(item.comprometido)} KG</p>
        <p><strong>Disp. + comp.:</strong> ${formatNumber(dispPlusComp)} KG</p>
        <p><strong>Aut. c/ cob.:</strong> ${alertIcon}${autCob} dias</p>
        <p><strong>Em OC:</strong> ${formatNumber(item.ocTotal)} KG</p>
      </div>
      <div class="card-actions">
        <button class="comments-btn" onclick="openComentariosByItem('${item.pi}')" title="Comentários">
          <i class="bi bi-chat-dots"></i>
          ${item.newCommentCount>0
            ? `<span class="new-comment-badge">${item.newCommentCount}</span>`
            : ''}
        </button>
        <button onclick="verificarOCsByItem('${item.pi}')" title="Dashboard de OCs">
          <i class="bi bi-bar-chart"></i>
        </button>
        <button onclick="openNovaOCModal('${item.pi}','${item.itemSolicitado}')" title="Adicionar OC Manual">
          <i class="bi bi-plus-square"></i>
        </button>
        <button onclick="addNewLicitacaoForPI('${item.pi}')" title="Nova Licitação">
          <i class="bi bi-plus"></i>
        </button>
        <button onclick="editItemByPI('${item.pi}')" title="Editar Licitação">
          <i class="bi bi-pencil"></i>
        </button>
        <button onclick="deleteItemByPI('${item.pi}')" title="Excluir Licitações">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
    licitacaoCards.appendChild(card);
  });
}
  // ----- Toggle Detail -----
  window.toggleLicDetail = function(elemId, event) {
    if (event) event.stopPropagation();
    const elem = document.getElementById(elemId);
    if (!elem) return;
    elem.style.display = (elem.style.display === 'none') ? 'block' : 'none';
  };
  
  // ----- Single Licitação Edit/Delete -----
  window.editItemByPI = function(pi) {
    const lic = licitacoes.find(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
    if (!lic) return;
    if (formEditLicitacao) formEditLicitacao.reset();
    if (formEditLicitacao.elements['id'])
      formEditLicitacao.elements['id'].value = lic.id;
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
  
  // ----- Form Submission: Nova Licitação -----
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
        // Initialize balance to totalQuantity if not provided
        balance: totalQty,
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
  
  // ----- Form Submission: Edit Licitação -----
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
  
  // ----- Edit Single Licitação by ID -----
window.editSingleLicitacao = function(licId) {
  // find the licitação object in memory
  const lic = licitacoes.find(l => l.id === licId);
  if (!lic) return;

  // reset & populate the edit form
  if (formEditLicitacao) formEditLicitacao.reset();
  formEditLicitacao.elements['id'].value               = lic.id;
  formEditLicitacao.elements['numeroProcesso'].value   = lic.numeroProcesso || '';
  formEditLicitacao.elements['nomeEmpresa'].value      = lic.nomeEmpresa    || '';
  formEditLicitacao.elements['telefoneEmpresa'].value  = lic.telefoneEmpresa|| '';
  formEditLicitacao.elements['itemSolicitado'].value   = lic.itemSolicitado || '';
  formEditLicitacao.elements['pi'].value               = lic.pi             || '';
  formEditLicitacao.elements['vencimentoAta'].value    = lic.vencimentoAta  || '';
  formEditLicitacao.elements['status'].value           = lic.status         || '';
  // we typically don't edit balance here, so either hide or populate if you want:
  formEditLicitacao.elements['balance'].value          = lic.balance        || 0;
  formEditLicitacao.elements['categoria'].value        = lic.categoria      || '';
  formEditLicitacao.elements['cmm'].value              = lic.cmm            || 0;

  // open the edit modal
  openModal(modalEditLicitacao);
};

  // ----- Form Submission: Comentários (Chat) -----
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
  
  // ----- Load Data from Firestore -----
  async function loadData() {
    try {
      licitacoes = [];
      const licSnapshot = await db.collection("licitacoes").get();
      licSnapshot.forEach(doc => {
        const licData = doc.data();
        licData.docId = doc.id;
        if (!licData.comentarios) licData.comentarios = [];
        // If balance is not defined, initialize it as totalQuantity.
        if (licData.balance === undefined || licData.balance === null) {
          licData.balance = licData.totalQuantity || 0;
        }
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
  
  // ----- Firebase Auth State Listener (Profile) -----
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "index.html";
    }
  });
  
  
});

// ===== Global Functions Accessible Outside DOMContentLoaded =====

// Chat Functions
window.openComentariosByItem = function(pi) {
  const lic = licitacoes.find(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
  if (!lic) return;
  document.getElementById("chatMessages").innerHTML = "";
  (lic.comentarios || []).forEach((msg, index) => {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.innerHTML = `
      <p>${msg.text}</p>
      <span class="chat-time">${formatTime(msg.time)}</span>
      <button class="delete-comment-btn" onclick="deleteChatMessage('${pi}', ${index})"><i class="bi bi-trash"></i></button>
    `;
    document.getElementById("chatMessages").appendChild(bubble);
  });
  if (document.getElementById("formComentarios").elements["licitacaoId"]) {
    document.getElementById("formComentarios").elements["licitacaoId"].value = pi;
  }
  openModal(document.getElementById("modalComentarios"));
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
      await firebase.firestore().collection("licitacoes").doc(lic.docId).update({
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

// OC Dashboard Functions
window.verificarOCsByItem = async function(pi) {
  const db = firebase.firestore();

  // 1) Fetch the latest licitações for this PI
  const licSnapshot = await db
    .collection("licitacoes")
    .where("pi", "==", pi)
    .get();

  if (licSnapshot.empty) return;

  // 2) Gather all OC entries
  const allOCs = [];
  licSnapshot.forEach(doc => {
    const lic = doc.data();
    const processo = lic.numeroProcesso || "";
    (lic.ocs || []).forEach(oc => {
      allOCs.push({
        pi:             pi,
        numeroProcesso: processo,
        codigo:         oc.codigo,
        qtdeComprada:   oc.qtdeComprada  || 0,
        qtdeArrecadada: oc.qtdeArrecadada || 0,
        qtdePericia:    oc.qtdePericia    || 0
      });
    });
  });

  // 3) Compute totals
  let totalOC = 0, totalArr = 0, totalPer = 0;
  allOCs.forEach(o => {
    totalOC += o.qtdeComprada;
    totalArr += o.qtdeArrecadada;
    totalPer += o.qtdePericia;
  });

  // 4) Update header cards
  document.getElementById("ocTotalValue").textContent      = formatNumber(totalOC)  + " KG";
  document.getElementById("ocArrecadadoValue").textContent = formatNumber(totalArr)  + " KG";
  document.getElementById("ocPericiaValue").textContent    = formatNumber(totalPer)  + " KG";

  // 5) Render the OC list
  const dashboardDiv = document.getElementById("ocDashboardContent");
  if (allOCs.length === 0) {
    dashboardDiv.innerHTML = `
      <div class="oc-item">
        <p>Nenhuma OC cadastrada para ${pi}</p>
      </div>`;
  } else {
    allOCs.sort((a,b) => a.codigo.localeCompare(b.codigo));
    dashboardDiv.innerHTML = allOCs.map(o => `
      <div class="oc-item">
        <p><strong>Processo:</strong> 
          <span style="font-weight:700; color:#007bff;">
            ${o.numeroProcesso}
          </span>
        </p>
        <p><strong>OC Código:</strong> ${o.codigo}</p>
        <p><strong>OC Total:</strong> ${formatNumber(o.qtdeComprada)} KG</p>
        <p><strong>Arrecadado:</strong> ${formatNumber(o.qtdeArrecadada)} KG</p>
        <p><strong>Perícia:</strong> ${formatNumber(o.qtdePericia)} KG</p>
        <button 
          class="delete-oc-btn" 
          data-pi="${pi}" 
          data-codigo="${o.codigo}"
          title="Excluir OC">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `).join("");
  }

  // 6) Wire up delete buttons (checking both PI and OC code)
  dashboardDiv.querySelectorAll('.delete-oc-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const codigoVal = btn.getAttribute('data-codigo');
      if (!confirm("Tem certeza que deseja excluir esta OC?")) return;

      // Batch‐remove from every matching licitação doc
      const batch = db.batch();
      licSnapshot.forEach(doc => {
        const lic = doc.data();
        const newOCs = (lic.ocs || []).filter(oc => oc.codigo !== codigoVal);
        batch.update(doc.ref, {
          ocs:        newOCs,
          ocTotal:    newOCs.reduce((sum, o) => sum + (o.qtdeComprada  || 0), 0),
          ocConsumed: newOCs.reduce((sum, o) => sum + (o.qtdeArrecadada || 0), 0)
        });
      });
      await batch.commit();

      // Refresh the dashboard
      await window.verificarOCsByItem(pi);
    });
  });

  // 7) Finally, show the modal
  openModal(document.getElementById("modalVerificarOCs"));
};

window.deleteOC = async function(pi, codigo) {
  const matchingLics = licitacoes.filter(l => l.pi && l.pi.toUpperCase() === pi.toUpperCase());
  if (matchingLics.length === 0) return;
  for (const lic of matchingLics) {
    if (lic.ocs) {
      lic.ocs = lic.ocs.filter(oc => oc.codigo !== codigo);
      lic.ocTotal = lic.ocs.reduce((acc, oc) => acc + (oc.qtdeComprada || 0), 0);
      lic.ocConsumed = lic.ocs.reduce((acc, oc) => acc + (oc.qtdeArrecadada || 0), 0);
      try {
        await firebase.firestore().collection("licitacoes").doc(lic.docId).update({
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

// ---------- New Functions for OC Integration ----------

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

// When the pericia process is confirmed, move the quantity from qtdePericia to qtdeArrecadada and update ocConsumed.
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
        const newConsumed = lic.ocs.reduce((acc, oc) => acc + (oc.qtdeArrecadada || 0), 0);
        await firebase.firestore().collection("licitacoes").doc(doc.id).update({
          ocs: lic.ocs,
          ocConsumed: newConsumed
        });
      }
    });
  } catch (err) {
    console.error("Erro ao atualizar OC para pericia:", err);
  }
}

// ----- Profile Menu & Auth Logic -----
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


// wire up the button
document.getElementById('exportOCsBtn')
        .addEventListener('click', exportAllOCs);
