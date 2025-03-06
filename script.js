document.addEventListener("DOMContentLoaded", function() {
  // Data arrays and counters
  let licitacoes = [];
  let pos = [];
  let licitacaoIdCounter = 1;
  let poIdCounter = 1;


  // DOM Elements
  const fab = document.querySelector('.fab');
  const fabMenu = document.getElementById('fabMenu');


  // Modals (added modalPODetails for PO details)
  const modalLicitacao = document.getElementById('modalLicitacao');
  const modalEditLicitacao = document.getElementById('modalEditLicitacao');
  const modalPO = document.getElementById('modalPO');
  const modalEditPO = document.getElementById('modalEditPO');
  const modalVerificarOCs = document.getElementById('modalVerificarOCs');
  const modalComentarios = document.getElementById('modalComentarios');
  const modalPODetails = document.getElementById('modalPODetails');


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
  const inputComentariosLicId = formComentarios.elements['licitacaoId'];
  const inputNewMessage = formComentarios.elements['newMessage'];
  const chatMessages = document.getElementById('chatMessages');


  // UI Containers
  const licitacaoCards = document.getElementById('licitacaoCards');
  // Kanban board columns for POs:
  const newPOsCol = document.getElementById('newPOs');
  const ocPOsCol = document.getElementById('ocPOs');
  const acceptedPOsCol = document.getElementById('acceptedPOs');
  const alertPOsCol = document.getElementById('alertPOs');


  // Search bars
  const licitacoesSearch = document.getElementById('licitacoesSearch');
  const poSearch = document.getElementById('poSearch');


  // Buttons
  const btnNewLicitacao = document.getElementById('btnNewLicitacao');
  const btnNewPO = document.getElementById('btnNewPO');


  // -------------------------
  // FAB Menu Toggle (closes when clicking outside)
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
  // Open Modals from Buttons
  // -------------------------
  btnNewLicitacao.addEventListener('click', function() {
      formLicitacao.reset();
      openModal(modalLicitacao);
  });
  btnNewPO.addEventListener('click', function() {
      formPO.reset();
      populateLicitacaoDropdown();
      openModal(modalPO);
  });


  // -------------------------
  // Populate Licitação Dropdowns
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


  // -------------------------
  // Licitação: Create
  // -------------------------
  formLicitacao.addEventListener('submit', function(e) {
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
          comentarios: [] // For chat messages
      };
      licitacoes.push(newLic);
      renderLicitacoes();
      formLicitacao.reset();
      closeModal(modalLicitacao);
  });


  // -------------------------
  // Licitação: Edit
  // -------------------------
  formEditLicitacao.addEventListener('submit', function(e) {
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
          lic.balance = parseFloat(fd.get('balance'));
      }
      renderLicitacoes();
      formEditLicitacao.reset();
      closeModal(modalEditLicitacao);
  });


  // -------------------------
  // PO: Create
  // -------------------------
  formPO.addEventListener('submit', function(e) {
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
      pos.push(newPO);
      renderPOBoard();
      formPO.reset();
      closeModal(modalPO);
  });


  // -------------------------
  // PO: Edit
  // -------------------------
  formEditPO.addEventListener('submit', function(e) {
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
          }
      }
      if (oldPO.status === "OC") {
          oldPO.ocDate = new Date().toISOString();
          const newLic = licitacoes.find(l => l.id === oldPO.licitacaoId);
          if (newLic) {
              newLic.balance -= oldPO.valor;
              newLic.ocTotal += oldPO.valor;
          }
      }
      
      renderPOBoard();
      formEditPO.reset();
      closeModal(modalEditPO);
      renderLicitacoes();
  });


  // -------------------------
  // Mark PO as Accepted
  // -------------------------
  window.markAsAccepted = function(index) {
      const po = pos[index];
      if (po && po.status === "OC") {
          po.status = "Accepted";
          po.acceptDate = new Date().toISOString();
          po.alertReason = "";
          renderPOBoard();
      }
  };


  // -------------------------
  // Automatic PO Status Update (Overdue Checks)
  // -------------------------
  function updatePOStatuses() {
      const now = new Date();
      pos.forEach(po => {
          if (po.status === "New") {
              const creation = new Date(po.creationDate);
              if (now - creation > 2 * 24 * 60 * 60 * 1000) {
                  po.alertReason = "Overdue to become OC";
              } else {
                  po.alertReason = "";
              }
          } else if (po.status === "OC") {
              if (po.ocDate) {
                  const oc = new Date(po.ocDate);
                  if (now - oc > 15 * 24 * 60 * 60 * 1000) {
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


  // -------------------------
  // Search Functionality
  // -------------------------
  licitacoesSearch.addEventListener("input", function() {
      renderLicitacoes();
  });
  poSearch.addEventListener("input", function() {
      renderPOBoard();
  });


  // -------------------------
  // Render Licitações (Card UI)
  // -------------------------
  function renderLicitacoes() {
      const searchTerm = licitacoesSearch.value.toLowerCase();
      licitacaoCards.innerHTML = "";
      licitacoes.forEach(lic => {
          // Filter by search term (by itemSolicitado)
          if (searchTerm && !lic.itemSolicitado.toLowerCase().includes(searchTerm)) return;
          
          const total = lic.balance + lic.ocTotal;
          const used = lic.ocTotal;
          const ratio = total > 0 ? used / total : 0;
          
          // Gauge color based on ratio
          let gaugeColor;
          const pct = ratio * 100;
          if (pct <= 30) {
              gaugeColor = "#3CB371"; // green
          } else if (pct <= 70) {
              gaugeColor = "#FFD700"; // yellow
          } else {
              gaugeColor = "#FF4500"; // red
          }
          
          // If vencimento is within 3 months, text red
          let vencColor = "";
          if (isCloseToDue(lic.vencimentoAta)) {
              vencColor = 'style="color: red;"';
          }
          
          const card = document.createElement("div");
          card.className = "item-card fancy-card";
          card.innerHTML = `
              <h2>${lic.itemSolicitado}</h2>
              <div class="gauge-container">
                <svg viewBox="0 0 36 18" class="semi-circle">
                  <path d="M2,18 A16,16 0 0 1 34,18" stroke="#eee" stroke-width="4" fill="none"/>
                  <path d="M2,18 A16,16 0 0 1 34,18" stroke="${gaugeColor}" stroke-dasharray="${57 * ratio}, 57" stroke-width="4" fill="none" stroke-linecap="round"/>
                </svg>
                <p>${used}KG de ${total}KG</p>
              </div>
              <p ${vencColor}>Vencimento da ata: ${formatDate(lic.vencimentoAta)}</p>
              <div class="info-icons two-columns">
                <div class="icon-with-label"><span class="icon">🛒</span><span>Disp. p/ lib: ${lic.balance}KG</span></div>
                <div class="icon-with-label"><span class="icon">📅</span><span>CMM: 15,000</span></div>
                <div class="icon-with-label"><span class="icon">🚚</span><span>Em OC: ${lic.ocTotal}KG</span></div>
                <div class="icon-with-label"><span class="icon">⏳</span><span>Autonomia 9 meses</span></div>
              </div>
              <button onclick="verificarOCs(${lic.id})" class="ocs-button">Verificar OCs</button>
              <div class="card-actions">
                <button onclick="openComentarios(${lic.id})" title="Comentários"><i class="bi bi-chat-dots"></i></button>
                <button onclick="editLicitacao(${lic.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                <button onclick="deleteLicitacao(${lic.id})" title="Excluir"><i class="bi bi-trash"></i></button>
              </div>
          `;
          licitacaoCards.appendChild(card);
      });
  }


  // -------------------------
  // Render PO Board (Kanban Style)
  // -------------------------
  function renderPOBoard() {
      updatePOStatuses();
      // Clear all Kanban columns
      document.getElementById("newPOs").innerHTML = "";
      document.getElementById("ocPOs").innerHTML = "";
      document.getElementById("acceptedPOs").innerHTML = "";
      document.getElementById("alertPOs").innerHTML = "";
      
      const searchTerm = poSearch.value.toLowerCase();
      pos.forEach((po, index) => {
          if (searchTerm && !po.elemento.toLowerCase().includes(searchTerm)) return;
          
          const card = document.createElement("div");
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
                <button onclick="editPO(${index})" title="Editar"><i class="bi bi-pencil"></i></button>
                <button onclick="deletePO(${index})" title="Excluir"><i class="bi bi-trash"></i></button>
              </div>
          `;
          // When clicking on the card (excluding action buttons), show detailed info
          card.addEventListener("click", function(e) {
              if (!e.target.closest(".po-actions") && !e.target.closest("button")) {
                  showPODetails(index);
              }
          });
          if (po.status === "New") {
              document.getElementById("newPOs").appendChild(card);
          } else if (po.status === "OC") {
              document.getElementById("ocPOs").appendChild(card);
          } else if (po.status === "Accepted") {
              document.getElementById("acceptedPOs").appendChild(card);
          } else if (po.alertReason) {
              document.getElementById("alertPOs").appendChild(card);
          } else {
              document.getElementById("newPOs").appendChild(card);
          }
      });
  }


  // -------------------------
  // Convert PO to OC
  // -------------------------
  window.convertToOC = function(index) {
      const po = pos[index];
      if (po && po.status === "New") {
          po.status = "OC";
          po.ocDate = new Date().toISOString();
          po.alertReason = "";
          const lic = licitacoes.find(l => l.id === po.licitacaoId);
          if (lic) {
              lic.balance -= po.valor;
              lic.ocTotal += po.valor;
          }
          renderPOBoard();
          renderLicitacoes();
      }
  };


  // -------------------------
  // Mark PO as Accepted
  // -------------------------
  window.markAsAccepted = function(index) {
      const po = pos[index];
      if (po && po.status === "OC") {
          po.status = "Accepted";
          po.acceptDate = new Date().toISOString();
          po.alertReason = "";
          renderPOBoard();
      }
  };


  // -------------------------
  // Edit PO
  // -------------------------
  window.editPO = function(index) {
      const po = pos[index];
      if (!po) return;
      formEditPO.reset();
      formEditPO.elements["index"].value = index;
      formEditPO.elements["elemento"].value = po.elemento;
      formEditPO.elements["prioridade"].value = po.prioridade;
      formEditPO.elements["data"].value = po.data;
      formEditPO.elements["status"].value = po.status;
      formEditPO.elements["valor"].value = po.valor;
      formEditPO.elements["arquivos"].value = po.arquivos || "";
      formEditPO.elements["observacoes"].value = po.observacoes || "";
      populateEditLicitacaoDropdown(po.licitacaoId);
      openModal(modalEditPO);
  };


  // -------------------------
  // Delete PO (with confirmation)
  // -------------------------
  window.deletePO = function(index) {
      const po = pos[index];
      if (!confirm(`Tem certeza de que deseja excluir o PO "${po.elemento}"?`)) return;
      if (po && po.status === "OC") {
          const lic = licitacoes.find(l => l.id === po.licitacaoId);
          if (lic) {
              lic.balance += po.valor;
              lic.ocTotal -= po.valor;
          }
      }
      pos.splice(index, 1);
      renderPOBoard();
      renderLicitacoes();
  };


  // -------------------------
  // Edit Licitação
  // -------------------------
  window.editLicitacao = function(id) {
      const lic = licitacoes.find(l => l.id === id);
      if (!lic) return;
      formEditLicitacao.reset();
      formEditLicitacao.elements["id"].value = lic.id;
      formEditLicitacao.elements["numeroProcesso"].value = lic.numeroProcesso;
      formEditLicitacao.elements["nomeEmpresa"].value = lic.nomeEmpresa;
      formEditLicitacao.elements["telefoneEmpresa"].value = lic.telefoneEmpresa;
      formEditLicitacao.elements["itemSolicitado"].value = lic.itemSolicitado;
      formEditLicitacao.elements["vencimentoAta"].value = lic.vencimentoAta;
      formEditLicitacao.elements["status"].value = lic.status;
      formEditLicitacao.elements["balance"].value = lic.balance;
      openModal(modalEditLicitacao);
  };


  // -------------------------
  // Delete Licitação (with confirmation)
  // -------------------------
  window.deleteLicitacao = function(id) {
      const lic = licitacoes.find(l => l.id === id);
      if (!lic) return;
      if (!confirm(`Tem certeza de que deseja excluir a licitação "${lic.itemSolicitado}"?`))
          return;
      licitacoes = licitacoes.filter(l => l.id !== id);
      renderLicitacoes();
  };


  // -------------------------
  // Verificar OCs (with edit action)
  // -------------------------
  window.verificarOCs = function(licitacaoId) {
      const ocList = pos.filter(po => po.licitacaoId === licitacaoId && po.status === "OC");
      const tableBody = document.querySelector("#tableVerificarOCs tbody");
      tableBody.innerHTML = "";
      ocList.forEach(oc => {
          const idx = pos.findIndex(p => p.id === oc.id);
          const row = document.createElement("tr");
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
  // Helpers
  // -------------------------
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
  // Render Comentários (Chat)
  // -------------------------
  function renderChat(lic) {
      chatMessages.innerHTML = "";
      lic.comentarios.forEach(msg => {
          const bubble = document.createElement("div");
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
      inputComentariosLicId.value = licId;
      renderChat(lic);
      openModal(modalComentarios);
  };
  formComentarios.addEventListener("submit", function(e) {
      e.preventDefault();
      const licId = parseInt(formComentarios.elements["licitacaoId"].value);
      const lic = licitacoes.find(l => l.id === licId);
      if (!lic) return;
      const newMsg = {
          text: inputNewMessage.value,
          time: new Date()
      };
      lic.comentarios.push(newMsg);
      inputNewMessage.value = "";
      renderChat(lic);
  });


  // -------------------------
  // Show PO Details (when card is clicked)
  // -------------------------
  function showPODetails(index) {
      const po = pos[index];
      if (!po) return;
      const lic = licitacoes.find(l => l.id === po.licitacaoId);
      let licInfo = "";
      if (lic) {
          licInfo = `
              <p><strong>Empresa:</strong> ${lic.nomeEmpresa}</p>
              <p><strong>Telefone:</strong> ${lic.telefoneEmpresa}</p>
              <p><strong>Número do Processo:</strong> ${lic.numeroProcesso}</p>
          `;
      }
      const contentHTML = `
          <p><strong>Elemento:</strong> ${po.elemento}</p>
          <p><strong>Prioridade:</strong> ${po.prioridade}</p>
          <p><strong>Data:</strong> ${po.data}</p>
          <p><strong>Valor:</strong> ${po.valor}</p>
          <p><strong>Observações:</strong> ${po.observacoes || ''}</p>
          ${licInfo}
      `;
      document.getElementById("poDetailContent").innerHTML = contentHTML;
      openModal(modalPODetails);
  }


  // -------------------------
  // Initial Render
  // -------------------------
  function renderAll() {
      renderLicitacoes();
      renderPOBoard();
  }
  renderAll();

});
