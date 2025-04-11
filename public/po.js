/* ============================
   Firebase Initialization
   ============================
   (Remove this block if Firebase is already initialized globally.)
*/
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
  let agendamentos = [];     // Array of scheduling records from "pos" collection
  let ocListData = [];       // Array of licitação+OC options
  let selectedAgendamento = null;  // For tracking the current record during Recebimento / Perícia
  
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
  
  function openModal(modalElem) {
    if (modalElem) {
      const modalInstance = new bootstrap.Modal(modalElem);
      modalInstance.show();
    }
  }
  
  /* ============================
     Open Add Agendamento Modal (#1)
  ============================ */
  function openAddModal() {
    document.getElementById("formAgendamento").reset();
    openModal(document.getElementById("addModal"));
  }
  
  /* ============================
     Load Licitação/OC Options & Filter by OC Number (#2)
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
              pi: lic.pi || ""
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
      // Filter only on OC number:
      if (!searchInput || obj.oc.toLowerCase().includes(searchInput)) {
        const option = document.createElement("option");
        option.value = JSON.stringify(obj);
        option.textContent = `OC ${obj.oc}`;
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
        let ag = doc.data();
        ag.docId = doc.id;
        agendamentos.push(ag);
      });
      renderAgendamentos();
    } catch (err) {
      console.error("Erro ao carregar agendamentos:", err);
    }
  }
  
  function renderAgendamentos() {
    const tbody = document.getElementById("agendaTbody");
    tbody.innerHTML = "";
    agendamentos.forEach(ag => {
      // Build action buttons based on status
      let actionButtons = `<button class="btn btn-sm btn-primary me-1" onclick="enableEditRow(this)">
                              <i class="bi bi-pencil-square"></i> Editar
                            </button>
                            <button class="btn btn-sm btn-success me-1" onclick="saveRow('${ag.docId}', this)">
                              <i class="bi bi-check-circle"></i> Salvar
                            </button>`;
      if (ag.status === "Pendente") {
        actionButtons += `<button class="btn btn-sm btn-primary me-1" onclick="openRecebimentoModal('${ag.docId}')">
                            <i class="bi bi-box-seam"></i> Recebimento
                          </button>`;
      } else if (ag.status === "Arrecadado") {
        actionButtons += `<button class="btn btn-sm btn-warning me-1" onclick="openPericiaModal('${ag.docId}')">
                            <i class="bi bi-question-octagon"></i> Perícia
                          </button>`;
      } else {
        actionButtons += `<span class="text-muted">N/A</span>`;
      }
  
      const row = document.createElement("tr");
      row.innerHTML = `
        <td contenteditable="false" data-field="dataPrevista">${formatDateBR(ag.dataPrevista)}</td>
        <td contenteditable="false" data-field="item">${ag.item || ""}</td>
        <td contenteditable="false" data-field="qtd">${parseNumberBR(ag.qtd)}</td>
        <td contenteditable="false" data-field="oc">${ag.oc || ""}</td>
        <td contenteditable="false" data-field="fornecedor">${ag.fornecedor || ""}</td>
        <td contenteditable="false" data-field="notaFiscal">${ag.notaFiscal || ""}</td>
        <td contenteditable="false" data-field="obs">${ag.obs || ""}</td>
        <td contenteditable="false" data-field="status">${ag.status || "Pendente"}</td>
        <td>${ag.dataRecebimento ? formatDateBR(ag.dataRecebimento) : ""}</td>
        <td>${ag.dataPericia ? formatDateBR(ag.dataPericia) : ""}</td>
        <td>${actionButtons}</td>
      `;
      tbody.appendChild(row);
    });
  }
  
  /* ============================
     Editable Row Functions (#2 - Edit Button in Table)
  ============================ */
  function enableEditRow(btn) {
    const tr = btn.closest("tr");
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      cell.contentEditable = "true";
      cell.classList.add("editable");
    });
    btn.textContent = "Cancelar";
  }
  
  async function saveRow(docId, btn) {
    const tr = btn.closest("tr");
    let updateObj = {};
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      const field = cell.getAttribute("data-field");
      updateObj[field] = cell.textContent.trim();
    });
    try {
      await db.collection("pos").doc(docId).update(updateObj);
      agendamentos = agendamentos.map(ag => ag.docId === docId ? { ...ag, ...updateObj } : ag);
      alert("Registro atualizado com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar alterações:", err);
      alert("Erro ao salvar alterações.");
    }
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      cell.contentEditable = "false";
      cell.classList.remove("editable");
    });
    tr.querySelector("button.btn-primary").textContent = "Editar";
  }
  
  /* ============================
     Form Submission: Adicionar Agendamento
  ============================ */
  document.getElementById("formAgendamento").addEventListener("submit", async function(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!document.getElementById("selectOC").value) {
      alert("Selecione um OC!");
      return;
    }
    const ocData = JSON.parse(document.getElementById("selectOC").value);
    const newAg = {
      dataPrevista: fd.get("dataPrevista"),
      qtd: parseFloat(fd.get("qtd")),
      fornecedor: fd.get("fornecedor"),
      notaFiscal: fd.get("notaFiscal"),
      obs: fd.get("obs"),
      status: "Pendente",
      item: `Nº: ${ocData.numeroProcesso} - PI: ${ocData.pi}`,
      oc: ocData.oc
    };
    try {
      const docRef = await db.collection("pos").add(newAg);
      newAg.docId = docRef.id;
      agendamentos.push(newAg);
      renderAgendamentos();
      e.target.reset();
      bootstrap.Modal.getInstance(document.getElementById("addModal")).hide();
    } catch (err) {
      console.error("Erro ao adicionar agendamento:", err);
      alert("Erro ao adicionar. Tente novamente.");
    }
  });
  
  /* ============================
     Recebimento Modal Logic
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
    const qtdRecebida = parseFloat(fd.get("qtdRecebida"));
    if (!dataRecebimento || isNaN(qtdRecebida)) {
      alert("Preencha a data e a quantidade recebida.");
      return;
    }
    const updateObj = { status: "Arrecadado", dataRecebimento, qtdRecebida };
    try {
      await db.collection("pos").doc(selectedAgendamento).update(updateObj);
      agendamentos = agendamentos.map(ag => ag.docId === selectedAgendamento ? { ...ag, ...updateObj } : ag);
      renderAgendamentos();
      selectedAgendamento = null;
      bootstrap.Modal.getInstance(document.getElementById("recebimentoModal")).hide();
    } catch (err) {
      console.error("Erro no recebimento:", err);
      alert("Erro ao atualizar recebimento.");
    }
  });
  
  /* ============================
     Perícia Modal Logic
  ============================ */
  function openPericiaModal(docId) {
    selectedAgendamento = docId;
    openModal(document.getElementById("periciaModal"));
  }
  
  document.getElementById("btnPericiaOk").addEventListener("click", async function() {
    if (!selectedAgendamento) return;
    const now = new Date().toISOString().split("T")[0];
    const updateObj = { status: "Arquivado", dataPericia: now };
    try {
      await db.collection("pos").doc(selectedAgendamento).update(updateObj);
      agendamentos = agendamentos.map(ag => ag.docId === selectedAgendamento ? { ...ag, ...updateObj } : ag);
      renderAgendamentos();
      selectedAgendamento = null;
      bootstrap.Modal.getInstance(document.getElementById("periciaModal")).hide();
    } catch (err) {
      console.error("Erro na perícia:", err);
      alert("Erro ao atualizar perícia.");
    }
  });
  
  document.getElementById("btnPericiaPendencia").addEventListener("click", async function() {
    if (!selectedAgendamento) return;
    const now = new Date().toISOString().split("T")[0];
    const updateObj = { status: "Pendente", dataPericia: now };
    try {
      await db.collection("pos").doc(selectedAgendamento).update(updateObj);
      agendamentos = agendamentos.map(ag => ag.docId === selectedAgendamento ? { ...ag, ...updateObj } : ag);
      renderAgendamentos();
      selectedAgendamento = null;
      bootstrap.Modal.getInstance(document.getElementById("periciaModal")).hide();
    } catch (err) {
      console.error("Erro na perícia:", err);
      alert("Erro ao atualizar perícia.");
    }
  });
  
  /* ============================
     Table Filtering (Search & Date Range)
  ============================ */
  function applyTableFilter() {
    const searchVal = document.getElementById("tableSearchInput").value.toLowerCase();
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;
    const filtered = agendamentos.filter(ag => {
      const haystack = `${ag.dataPrevista} ${ag.item} ${ag.oc} ${ag.fornecedor} ${ag.notaFiscal} ${ag.obs}`.toLowerCase();
      if (searchVal && !haystack.includes(searchVal)) return false;
      if (dateFrom && ag.dataPrevista && ag.dataPrevista < dateFrom) return false;
      if (dateTo && ag.dataPrevista && ag.dataPrevista > dateTo) return false;
      return true;
    });
    
    const tbody = document.getElementById("agendaTbody");
    tbody.innerHTML = "";
    filtered.forEach(ag => {
      let actionButtons = `<button class="btn btn-sm btn-primary me-1" onclick="enableEditRow(this)">
                              <i class="bi bi-pencil-square"></i> Editar
                            </button>
                            <button class="btn btn-sm btn-success me-1" onclick="saveRow('${ag.docId}', this)">
                              <i class="bi bi-check-circle"></i> Salvar
                            </button>`;
      if (ag.status === "Pendente") {
        actionButtons += `<button class="btn btn-sm btn-primary me-1" onclick="openRecebimentoModal('${ag.docId}')">
                            <i class="bi bi-box-seam"></i> Recebimento
                          </button>`;
      } else if (ag.status === "Arrecadado") {
        actionButtons += `<button class="btn btn-sm btn-warning me-1" onclick="openPericiaModal('${ag.docId}')">
                            <i class="bi bi-question-octagon"></i> Perícia
                          </button>`;
      } else {
        actionButtons += `<span class="text-muted">N/A</span>`;
      }
      const row = document.createElement("tr");
      row.innerHTML = `
        <td contenteditable="false" data-field="dataPrevista">${formatDateBR(ag.dataPrevista)}</td>
        <td contenteditable="false" data-field="item">${ag.item || ""}</td>
        <td contenteditable="false" data-field="qtd">${parseNumberBR(ag.qtd)}</td>
        <td contenteditable="false" data-field="oc">${ag.oc || ""}</td>
        <td contenteditable="false" data-field="fornecedor">${ag.fornecedor || ""}</td>
        <td contenteditable="false" data-field="notaFiscal">${ag.notaFiscal || ""}</td>
        <td contenteditable="false" data-field="obs">${ag.obs || ""}</td>
        <td contenteditable="false" data-field="status">${ag.status || "Pendente"}</td>
        <td>${ag.dataRecebimento ? formatDateBR(ag.dataRecebimento) : ""}</td>
        <td>${ag.dataPericia ? formatDateBR(ag.dataPericia) : ""}</td>
        <td>${actionButtons}</td>
      `;
      tbody.appendChild(row);
    });
  }
  
  /* ============================
     Editable Row Functions
  ============================ */
  function enableEditRow(btn) {
    const tr = btn.closest("tr");
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      cell.contentEditable = "true";
      cell.classList.add("editable");
    });
    btn.textContent = "Cancelar";
  }
  
  async function saveRow(poId, btn) {
    const tr = btn.closest("tr");
    let updateObj = {};
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      const field = cell.getAttribute("data-field");
      updateObj[field] = cell.textContent.trim();
    });
    try {
      await db.collection("pos").doc(poId).update(updateObj);
      agendamentos = agendamentos.map(ag => ag.docId === poId ? { ...ag, ...updateObj } : ag);
      alert("Registro atualizado com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar alterações:", err);
      alert("Erro ao salvar alterações.");
    }
    tr.querySelectorAll("[contenteditable]").forEach(cell => {
      cell.contentEditable = "false";
      cell.classList.remove("editable");
    });
    tr.querySelector("button.btn-primary").textContent = "Editar";
  }
  
  /* ============================
     Initial Load
  ============================ */
  window.addEventListener("load", async () => {
    await loadOcList();
    await loadAgendamentos();
  });
  
  /* ============================
     Firebase Auth & Profile (if needed)
  ============================ */
  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "index.html";
    }
  });
  
