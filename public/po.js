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
   Global State
============================ */
let agendamentos = [];           // lista de todos os agendamentos carregados
let ocListData = [];             // lista de opções de OC (licitacoes → ocs)
const sortDirection = {};        // armazena asc/desc para cada campo
let selectedAgendamento = null;  // docId atualmente selecionado (para Recebimento/Perícia)

/* ============================
   Helper: Converter Firestore Timestamp OU "DD/MM/YYYY" → JS Date
============================ */
function getDateObject(dateVal) {
  if (!dateVal) return null;

  // 1) Se for Firestore Timestamp, terá método toDate()
  if (typeof dateVal.toDate === "function") {
    const d = dateVal.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  // 2) Se já for um objeto Date:
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }

  // 3) Se for string "DD/MM/YYYY", quebrar e construir
  const parts = dateVal.toString().split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // zero‐based
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // 4) Fallback: tentar new Date( dateVal )
  const d2 = new Date(dateVal);
  return isNaN(d2.getTime()) ? null : d2;
}

/* ============================
   Helper: Formatar Data para "DD/MM/YYYY"
============================ */
function formatDateBR(dateVal) {
  const d = getDateObject(dateVal);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}

/* ============================
   Helper: Formatar Data com Ícone de Expirado
   Se a data já passou, adiciona ícone de alerta
============================ */
function formatDateWithAlert(dateVal) {
  const d = getDateObject(dateVal);
  if (!d) return "";
  let formatted = d.toLocaleDateString("pt-BR");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) {
    formatted += ` <i class="bi bi-exclamation-triangle-fill text-warning" title="Data expirada"></i>`;
  }
  return formatted;
}

/* ============================
   Helper: Formatar Número em padrão BR
   (ex: 12960 → "12.960,00")
============================ */
function formatNumberBR(num) {
  if (num == null || num === "") return "";
  const n = typeof num === "string"
    ? parseFloat(num.replace(/\./g, "").replace(",", "."))
    : parseFloat(num);
  if (isNaN(n)) return "";
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

/* ============================
   Helper: Converter string BR para JS Number
   (ex: "12.960,00" → 12960.00)
============================ */
function parseBrazilianNumber(str) {
  if (str == null || str === "") return 0;
  const cleaned = str.toString().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function isPericiaStatus(status) {
  if (!status) return false;
  // remove acentos e compara em lower case
  const normalized = status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized === 'em pericia';
}
/* ============================
   Helper: Renderizar Badge de Status
============================ */
function renderStatusBadge(status) {
  if (status === "Pendente") {
    return '<span class="badge bg-warning text-dark">Pendente</span>';
  }
  if (status === "Arrecadado") {
    return '<span class="badge bg-success">Arrecadado</span>';
  }
  if (isPericiaStatus(status)) {
    // sempre exibe com acento no badge, mas trata ambas as strings
    return '<span class="badge bg-info text-dark">Em perícia</span>';
  }
  return `<span class="badge bg-secondary">${status || ""}</span>`;
}

/* ============================
   Helper: Abrir Modal Bootstrap
============================ */
function openModal(el) {
  if (el) new bootstrap.Modal(el).show();
}

/* ============================
   Abrir Modal "Adicionar Agendamento"
============================ */
function openAddModal() {
  const form = document.getElementById("formAgendamento");
  if (form) form.reset();
  openModal(document.getElementById("addModal"));
}

/* ============================
   Carregar lista de OCs (licitacoes → ocs[]) do Firestore
============================ */
async function loadOcList() {
  try {
    const licSnapshot = await db.collection("licitacoes").get();
    ocListData = [];
    licSnapshot.forEach(doc => {
      const lic = doc.data();
      if (Array.isArray(lic.ocs)) {
        lic.ocs.forEach(oc => {
          ocListData.push({
            licDocId: doc.id,
            oc: oc.codigo || "",
            numeroProcesso: lic.numeroProcesso || "",
            pi: lic.pi || "",
            itemSolicitado: lic.itemSolicitado || ""
          });
        });
      }
    });
    filterOcOptions(); // popula imediatamente o <select>
  } catch (err) {
    console.error("Erro ao carregar OCs:", err);
  }
}

/* ============================
   Filtrar opções de OC no modal "Adicionar Agendamento"
============================ */
function filterOcOptions() {
  const searchInputEl = document.getElementById("ocSearchInput");
  const select = document.getElementById("selectOC");
  if (!select) return;

  const query = searchInputEl ? searchInputEl.value.trim().toLowerCase() : "";
  select.innerHTML = "";

  let matches = 0;
  ocListData.forEach(obj => {
    const hay = (`oc ${obj.oc} pi ${obj.pi} ${obj.itemSolicitado}`).toLowerCase();
    if (!query || hay.includes(query)) {
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
   Ligar formulário "Adicionar Agendamento"
============================ */
function bindAddAgendamentoForm() {
  const form = document.getElementById("formAgendamento");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // 1) Ler OC selecionada (JSON)
    const ocSelect = document.getElementById("selectOC");
    const raw = ocSelect ? ocSelect.value : "";
    if (!raw) {
      alert("Selecione uma OC válida.");
      return;
    }

    let ocObj;
    try {
      ocObj = JSON.parse(raw);
    } catch {
      alert("Erro ao ler dados da OC.");
      return;
    }

    // 2) Ler demais campos
    const dataPrevistaEl = form.querySelector('input[name="dataPrevista"]');
    const qtdEl          = form.querySelector('input[name="qtd"]');
    const fornecedorEl   = form.querySelector('input[name="fornecedor"]');
    const notaFiscalEl   = form.querySelector('input[name="notaFiscal"]');
    const obsEl          = form.querySelector('textarea[name="obs"]');

    const dataPrevista = dataPrevistaEl ? dataPrevistaEl.value : "";
    const qtd = qtdEl ? parseFloat(qtdEl.value) : 0;
    const fornecedor = fornecedorEl ? fornecedorEl.value.trim() : "";
    const notaFiscal = notaFiscalEl ? notaFiscalEl.value.trim() : "";
    const obs = obsEl ? obsEl.value.trim() : "";

    if (!dataPrevista || isNaN(qtd) || !fornecedor) {
      alert("Preencha Data Prevista, Quantidade e Fornecedor corretamente.");
      return;
    }

    // 3) Montar objeto de novo agendamento
    const newAg = {
      pi: ocObj.pi || "",
      oc: ocObj.oc || "",
      itemSolicitado: ocObj.itemSolicitado || "",
      numeroProcesso: ocObj.numeroProcesso || "",
      dataPrevista: dataPrevista,
      qtd: qtd,
      fornecedor: fornecedor,
      notaFiscal: notaFiscal,
      obs: obs,
      status: "Pendente",         // status inicial
      dataRecebimento: null,
      dataPericia: null
    };

    // 4) Salvar no Firestore e atualizar array local
    try {
      const docRef = await db.collection("pos").add(newAg);
      newAg.docId = docRef.id;
      agendamentos.push(newAg);

      renderAgendamentos();
      alert("Agendamento adicionado com sucesso!");
      selectedAgendamento = null;
      const addModalEl = document.getElementById("addModal");
      if (addModalEl) {
        bootstrap.Modal.getInstance(addModalEl)?.hide();
      }
    } catch (err) {
      console.error("Erro ao adicionar agendamento:", err);
      alert("Erro ao adicionar agendamento.");
    }
  });
}

/* ============================
   Carregar Agendamentos do Firestore & Renderizar
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

/* ============================
   Renderizar Lista de Agendamentos na Tabela
============================ */
function renderAgendamentos(list = agendamentos) {
  // 1) Ordenação…
  list.sort(/* … */);

  const tbody = document.getElementById("agendaTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  list.forEach(ag => {
    // ► aqui definimos as células ANTES de usá-las no innerHTML
    // depois: só coloca o alerta quando estiver Pendente
    const dataPrevCell = ag.status === "Pendente"
      ? formatDateWithAlert(ag.dataPrevista)
      : formatDateBR(ag.dataPrevista);
    const dataRecCell  = ag.dataRecebimento ? formatDateBR(ag.dataRecebimento) : "";
    const dataPerCell  = ag.dataPericia     ? formatDateBR(ag.dataPericia)     : "";

    // 2) Botões de ação
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
    } else if (isPericiaStatus(ag.status)) {
      btns += `
        <button class="btn btn-sm btn-warning me-1" title="Perícia"
                onclick="openPericiaModal('${ag.docId}')">
          <i class="bi bi-question-octagon"></i>
        </button>`;
    }

    // 3) Monta a linha usando as três variáveis já definidas
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dataPrevCell}</td>
      <td contenteditable="false" data-field="itemSolicitado">${ag.itemSolicitado || ""}</td>
      <td contenteditable="false" data-field="qtd">${formatNumberBR(ag.qtd)}</td>
      <td contenteditable="false" data-field="oc">${ag.oc || ""}</td>
      <td contenteditable="false" data-field="fornecedor">${ag.fornecedor || ""}</td>
      <td contenteditable="false" data-field="notaFiscal">${ag.notaFiscal || ""}</td>
      <td contenteditable="false" data-field="obs">${ag.obs || ""}</td>
      <td contenteditable="false" data-field="status">${renderStatusBadge(ag.status)}</td>
      <td contenteditable="false" data-field="dataRecebimento">${dataRecCell}</td>
      <td contenteditable="false" data-field="dataPericia">${dataPerCell}</td>
      <td class="text-center">${btns}</td>
    `;
    tbody.appendChild(tr);
  });

  // 4) Re-inicializa tooltips
  document.querySelectorAll('[data-bs-toggle="tooltip"]')
          .forEach(el => new bootstrap.Tooltip(el));
}

/* ============================
   Sorting Helper: Ordenar por um campo específico
============================ */
function sortByField(field) {
  console.log("Sort chamado para campo:", field);
  // Alterna direção (padrão: crescente)
  sortDirection[field] = !sortDirection[field];
  const ascending = sortDirection[field];

  agendamentos.sort((a, b) => {
    // 1) Campos de data: dataPrevista / dataRecebimento / dataPericia
    if (field === "dataPrevista" || field === "dataRecebimento" || field === "dataPericia") {
      const da = getDateObject(a[field]);
      const db_ = getDateObject(b[field]);
      if (!da && !db_) return 0;
      if (!da) return 1;
      if (!db_) return -1;
      return ascending ? (da - db_) : (db_ - da);
    }

    // 2) Campo numérico "qtd"
    if (field === "qtd") {
      const vaNum = parseBrazilianNumber(a.qtd);
      const vbNum = parseBrazilianNumber(b.qtd);
      return ascending ? (vaNum - vbNum) : (vbNum - vaNum);
    }

    // 3) Todos os demais: comparação de string em minúsculas
    const va = (a[field] || "").toString().toLowerCase();
    const vb = (b[field] || "").toString().toLowerCase();
    if (va < vb) return ascending ? -1 : 1;
    if (va > vb) return ascending ? 1 : -1;
    return 0;
  });

  renderAgendamentos();
}

/* ============================
   Filtro de texto (“Buscar na tabela…”)
============================ */
function applyTableFilter() {
  const inputEl = document.getElementById("tableSearchInput");
  const text = inputEl ? inputEl.value.trim().toLowerCase() : "";
  const filtered = agendamentos.filter(ag => {
    const haystack = [
      ag.dataPrevista,
      ag.itemSolicitado,
      ag.oc,
      ag.fornecedor,
      ag.notaFiscal,
      ag.obs
    ].join(" ").toLowerCase();
    return !text || haystack.includes(text);
  });
  renderAgendamentos(filtered);
}

/* ============================
   Excluir Agendamento (Firestore + Array local)
============================ */
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

/* ============================
   Ativar/Desativar Modo de Edição de Linha ou Salvar Alterações
============================ */
function toggleEditRow(poId, btn) {
  const tr = btn.closest("tr");
  if (!tr) return;
  const isEditing = tr.classList.contains("editing");
  const tip = bootstrap.Tooltip.getInstance(btn);

  if (!isEditing) {
    // Entrar em modo EDIÇÃO
    tr.classList.add("editing");
    btn.classList.replace("btn-secondary", "btn-success");
    btn.setAttribute("title", "Confirmar");
    if (tip) tip.dispose();
    new bootstrap.Tooltip(btn);
    btn.innerHTML = '<i class="bi bi-check-circle"></i>';
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      cell.contentEditable = "true";
      cell.classList.add("editable");
    });
  } else {
    // Já estava em modo EDIÇÃO → salvar ou cancelar
    if (btn.classList.contains("btn-success")) {
      if (!confirm("Deseja salvar as alterações deste registro?")) {
        // Cancelar edição e restaurar
        tr.classList.remove("editing");
        btn.classList.replace("btn-success", "btn-secondary");
        btn.setAttribute("title", "Editar");
        if (tip) tip.dispose();
        new bootstrap.Tooltip(btn);
        btn.innerHTML = '<i class="bi bi-pencil-square"></i>';
        tr.querySelectorAll("[contenteditable]").forEach(cell => {
          cell.contentEditable = "false";
          cell.classList.remove("editable");
        });
        renderAgendamentos();
        return;
      }
      // Se confirmou salvar, chamar rotina de salvamento
      saveRowChanges(poId, tr);
    }
    // Ajustar CSS e tooltip de volta
    tr.classList.remove("editing");
    btn.classList.replace("btn-success", "btn-secondary");
    btn.setAttribute("title", "Editar");
    if (tip) tip.dispose();
    new bootstrap.Tooltip(btn);
    btn.innerHTML = '<i class="bi bi-pencil-square"></i>';
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      cell.contentEditable = "false";
      cell.classList.remove("editable");
    });
  }
}

/* ============================
   Salvar Alterações da Linha no Firestore
============================ */
async function saveRowChanges(poId, tr) {
  const updateObj = {};
  tr.querySelectorAll("[contenteditable]").forEach(cell => {
    const fld = cell.getAttribute("data-field");
    if (!fld) return;
    let val = cell.textContent.trim();
    if (fld === "qtd") {
      val = parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0;
    }
    updateObj[fld] = val;
  });

  try {
    await db.collection("pos").doc(poId).update(updateObj);
    agendamentos = agendamentos.map(ag =>
      ag.docId === poId ? { ...ag, ...updateObj } : ag
    );
    alert("Registro atualizado com sucesso!");
  } catch (err) {
    console.error("Erro ao salvar alterações:", err);
    alert("Erro ao salvar alterações.");
  }

  renderAgendamentos();
  const updatedAg = agendamentos.find(ag => ag.docId === poId);
  if (updatedAg && updatedAg.pi && typeof window.verificarOCsByItem === "function") {
    window.verificarOCsByItem(updatedAg.pi);
  }
}

/* ============================
   Manipulação do Formulário “Recebimento”
============================ */
const formRecebimento = document.getElementById("formRecebimento");
if (formRecebimento) {
  formRecebimento.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!selectedAgendamento) return;

    const fd = new FormData(e.target);
    const dataReceb = fd.get("dataRecebimento");
    const qtdRec    = parseFloat(fd.get("qtdRecebida")) || 0;

    if (!dataReceb) {
      alert("Preencha a data de recebimento.");
      return;
    }

    const updateObj = {
      status: "Em pericia",
      dataRecebimento: dataReceb,
      qtdRecebida: qtdRec
    };

    try {
      // 1) Atualiza o agendamento no Firestore
      await db.collection("pos").doc(selectedAgendamento).update(updateObj);
      agendamentos = agendamentos.map(ag =>
        ag.docId === selectedAgendamento ? { ...ag, ...updateObj } : ag
      );
      renderAgendamentos();

      // 2) Persiste o incremento de qtdePericia na coleção "licitacoes"
      const updatedAg = agendamentos.find(ag => ag.docId === selectedAgendamento);
      if (updatedAg && updatedAg.pi) {
        await updateOCForRecebimento(updatedAg.pi, updatedAg.oc, qtdRec);
        // 3) Reexibe o dashboard de OCs com o novo valor
        if (typeof window.verificarOCsByItem === "function") {
          window.verificarOCsByItem(updatedAg.pi);
        }
      }

      // 4) Fecha o modal
      selectedAgendamento = null;
      const modalEl = document.getElementById("recebimentoModal");
      if (modalEl) {
        bootstrap.Modal.getInstance(modalEl)?.hide();
      }

    } catch (err) {
      console.error("Erro ao atualizar recebimento:", err);
      alert("Erro ao atualizar recebimento.");
    }
  });
}

/* ============================
   Abrir Modal “Recebimento”
============================ */
function openRecebimentoModal(docId) {
  selectedAgendamento = docId;
  const form = document.getElementById("formRecebimento");
  if (form) form.reset();
  openModal(document.getElementById("recebimentoModal"));
}

/* ============================
   Manipulação dos Botões “Perícia”
============================ */
function openPericiaModal(docId) {
  selectedAgendamento = docId;
  openModal(document.getElementById("periciaModal"));
}

const btnPericiaOk = document.getElementById("btnPericiaOk");
if (btnPericiaOk) {
  btnPericiaOk.addEventListener("click", async function () {
    if (!selectedAgendamento) return;
    const now = new Date().toISOString().split("T")[0];
    const updateObj = { status: "Arrecadado", dataPericia: now };
    try {
      await db.collection("pos").doc(selectedAgendamento).update(updateObj);
      agendamentos = agendamentos.map(ag =>
        ag.docId === selectedAgendamento ? { ...ag, ...updateObj } : ag
      );
      renderAgendamentos();

      const upd = agendamentos.find(ag => ag.docId === selectedAgendamento);
      const qtdRec = upd.qtdRecebida || 0;
      if (upd && upd.pi) {
        await updateOCForPericia(upd.pi, upd.oc, qtdRec);
        if (typeof window.verificarOCsByItem === "function") {
          window.verificarOCsByItem(upd.pi);
        }
      }

      selectedAgendamento = null;
      const modalEl = document.getElementById("periciaModal");
      if (modalEl) {
        bootstrap.Modal.getInstance(modalEl)?.hide();
      }
    } catch (err) {
      console.error("Erro ao atualizar perícia:", err);
      alert("Erro ao atualizar perícia.");
    }
  });
}

const btnPericiaPendencia = document.getElementById("btnPericiaPendencia");
if (btnPericiaPendencia) {
  btnPericiaPendencia.addEventListener("click", async function () {
    if (!selectedAgendamento) return;
    const now = new Date().toISOString().split("T")[0];
    const updateObj = { status: "Pendente", dataPericia: now };
    try {
      await db.collection("pos").doc(selectedAgendamento).update(updateObj);
      agendamentos = agendamentos.map(ag =>
        ag.docId === selectedAgendamento ? { ...ag, ...updateObj } : ag
      );
      renderAgendamentos();

      const upd = agendamentos.find(ag => ag.docId === selectedAgendamento);
      if (upd && upd.pi && typeof window.verificarOCsByItem === "function") {
        window.verificarOCsByItem(upd.pi);
      }

      selectedAgendamento = null;
      const modalEl = document.getElementById("periciaModal");
      if (modalEl) {
        bootstrap.Modal.getInstance(modalEl)?.hide();
      }
    } catch (err) {
      console.error("Erro ao atualizar pendência:", err);
      alert("Erro ao atualizar pendência.");
    }
  });
}

/* ============================
   Atualizar “licitacoes” após Recebimento
============================ */
async function updateOCForRecebimento(pi, ocCode, quantidade) {
  try {
    const licQ = await db.collection("licitacoes").where("pi", "==", pi).get();
    licQ.forEach(async doc => {
      let lic = doc.data();
      let updated = false;
      if (Array.isArray(lic.ocs)) {
        lic.ocs = lic.ocs.map(oc => {
          if (oc.codigo === ocCode) {
            oc.qtdePericia = (oc.qtdePericia || 0) + quantidade;
            updated = true;
          }
          return oc;
        });
      }
      if (updated) {
        await db.collection("licitacoes").doc(doc.id).update({ ocs: lic.ocs });
      }
    });
  } catch (err) {
    console.error("Erro OC recebimento:", err);
  }
}

/* ============================
   Atualizar “licitacoes” após Perícia
============================ */
async function updateOCForPericia(pi, ocCode, quantidade) {
  try {
    const licQ = await db.collection("licitacoes").where("pi", "==", pi).get();
    licQ.forEach(async doc => {
      let lic = doc.data();
      let updated = false;
      if (Array.isArray(lic.ocs)) {
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
        await db.collection("licitacoes").doc(doc.id).update({ ocs: lic.ocs });
      }
    });
  } catch (err) {
    console.error("Erro OC perícia:", err);
  }
}

/* ============================
   Filtro Por Mês: Mostrar Apenas Linhas do Mês Selecionado
   (usa primeira <td> de cada <tr>, no formato "DD/MM/YYYY")
============================ */
function filterByMonth(name) {
  const MONTH_NAMES = [
    "janeiro","fevereiro","março","abril",
    "maio","junho","julho","agosto",
    "setembro","outubro","novembro","dezembro"
  ];

  const selected = name.trim().toLowerCase();
  const monthIndex = MONTH_NAMES.indexOf(selected);

  // Se não achou o mês, renderiza tudo de volta
  if (monthIndex < 0) {
    renderAgendamentos();  
    return;
  }

  // Filtra o array global e re-renderiza só os agendamentos desse mês
  const filtered = agendamentos.filter(ag => {
    const d = getDateObject(ag.dataPrevista);
    return d instanceof Date && d.getMonth() === monthIndex;
  });
  renderAgendamentos(filtered);
}

/* ============================
   Exportar Tabela para XLSX (xlsx.full.min.js)
============================ */
function exportTableToXLSX(filename = 'agendamentos.xlsx') {
  const table = document.getElementById('agendaTable');
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: "Agendamentos" });
  XLSX.writeFile(wb, filename);
}

/* ============================
   Inicializar Tudo ao Carregar a Página
============================ */
document.addEventListener("DOMContentLoaded", () => {
  // 1) Carregar lista de OCs
  loadOcList();

  // 2) Formulário “Adicionar Agendamento”
  bindAddAgendamentoForm();

  // 3) Configurar abas de mês (+ persistir)
  const monthTabs = Array.from(document.querySelectorAll('.nav-pills .nav-link'));
  monthTabs.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      monthTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const monthName = tab.textContent.trim();
      localStorage.setItem('selectedMonth', monthName);
      filterByMonth(monthName);
    });
  });

  // 4) Puxar e renderizar os agendamentos, depois reaplicar mês salvo
  loadAgendamentos().then(() => {
    const MONTH_NAMES = [
      "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
      "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
    ];
    const saved = localStorage.getItem('selectedMonth')
                 || MONTH_NAMES[new Date().getMonth()];
    const defaultTab = monthTabs.find(t => t.textContent.trim() === saved);
    if (defaultTab) defaultTab.click();
  });

  // 5) Ordenação
  document.querySelectorAll("button.sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.field;
      if (field) sortByField(field);
    });
  });

  // 6) Tooltips
  document.querySelectorAll('[data-bs-toggle="tooltip"]')
          .forEach(el => new bootstrap.Tooltip(el));

  // 7) Busca na tabela
  const txtSearch = document.getElementById("tableSearchInput");
  if (txtSearch) txtSearch.addEventListener("input", applyTableFilter);

  // 8) Busca de OC no modal
  const ocSearchInput = document.getElementById("ocSearchInput");
  if (ocSearchInput) ocSearchInput.addEventListener("input", filterOcOptions);

  // 9) Exportar Excel
  const btnExport = document.getElementById('btnExportExcel');
  if (btnExport) {
    btnExport.addEventListener('click', () =>
      exportTableToXLSX('agendamentos.xlsx')
    );
  }
});
