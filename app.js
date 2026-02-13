const STORAGE_KEY = "prd-visual-board-v1";

const state = {
  groups: [
    { id: crypto.randomUUID(), name: "Feature A", color: "#5d7dff" },
    { id: crypto.randomUUID(), name: "Feature B", color: "#14b8a6" },
  ],
  notes: [],
  targetUrl: "",
};

const ui = {
  canvas: document.getElementById("canvas"),
  noteTitle: document.getElementById("noteTitle"),
  noteBody: document.getElementById("noteBody"),
  noteType: document.getElementById("noteType"),
  noteLevel: document.getElementById("noteLevel"),
  noteGroup: document.getElementById("noteGroup"),
  addNoteBtn: document.getElementById("addNoteBtn"),
  groupName: document.getElementById("groupName"),
  groupColor: document.getElementById("groupColor"),
  addGroupBtn: document.getElementById("addGroupBtn"),
  groupList: document.getElementById("groupList"),
  sendScope: document.getElementById("sendScope"),
  targetUrl: document.getElementById("targetUrl"),
  sendBtn: document.getElementById("sendBtn"),
  copyBtn: document.getElementById("copyBtn"),
  status: document.getElementById("status"),
  noteTemplate: document.getElementById("noteTemplate"),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const saved = JSON.parse(raw);
  if (Array.isArray(saved.groups) && Array.isArray(saved.notes)) {
    state.groups = saved.groups;
    state.notes = saved.notes;
    state.targetUrl = saved.targetUrl || "";
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getGroup(groupId) {
  return state.groups.find((g) => g.id === groupId);
}

function renderSelectors() {
  const groupOptions = state.groups
    .map((g) => `<option value="${g.id}">${g.name}</option>`)
    .join("");

  ui.noteGroup.innerHTML = groupOptions;
  ui.sendScope.innerHTML = `<option value="all">All groups</option>${groupOptions}`;

  ui.groupList.innerHTML = state.groups
    .map(
      (g) => `<li><span class="dot" style="background:${g.color}"></span><span>${g.name}</span></li>`,
    )
    .join("");

  ui.targetUrl.value = state.targetUrl;
}

function renderGroupHulls() {
  ui.canvas.querySelectorAll(".group-hull").forEach((el) => el.remove());

  state.groups.forEach((group) => {
    const notes = state.notes.filter((n) => n.groupId === group.id);
    if (!notes.length) return;

    const padding = 22;
    const minX = Math.min(...notes.map((n) => n.x)) - padding;
    const minY = Math.min(...notes.map((n) => n.y)) - padding;
    const maxX = Math.max(...notes.map((n) => n.x + 250)) + padding;
    const maxY = Math.max(...notes.map((n) => n.y + 130)) + padding;

    const hull = document.createElement("div");
    hull.className = "group-hull";
    hull.style.left = `${Math.max(0, minX)}px`;
    hull.style.top = `${Math.max(18, minY)}px`;
    hull.style.width = `${maxX - minX}px`;
    hull.style.height = `${maxY - minY}px`;
    hull.style.borderColor = group.color;

    const label = document.createElement("span");
    label.className = "group-label";
    label.style.color = group.color;
    label.textContent = group.name;

    hull.appendChild(label);
    ui.canvas.appendChild(hull);
  });
}

function renderNotes() {
  ui.canvas.querySelectorAll(".note").forEach((el) => el.remove());

  state.notes.forEach((note) => {
    const group = getGroup(note.groupId);
    const noteEl = ui.noteTemplate.content.firstElementChild.cloneNode(true);
    noteEl.dataset.id = note.id;
    noteEl.style.left = `${note.x}px`;
    noteEl.style.top = `${note.y}px`;
    noteEl.style.borderColor = group?.color || "#64748b";

    noteEl.querySelector(".note-title").textContent = note.title;
    noteEl.querySelector(".meta").textContent = `${note.level} · ${note.type} · ${group?.name || "Ungrouped"}`;
    noteEl.querySelector(".note-body").textContent = note.body;

    noteEl.querySelector(".delete-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      state.notes = state.notes.filter((n) => n.id !== note.id);
      saveState();
      renderAll();
    });

    bindDrag(noteEl);
    ui.canvas.appendChild(noteEl);
  });

  renderGroupHulls();
}

function renderAll() {
  renderSelectors();
  renderNotes();
}

function bindDrag(noteEl) {
  let active = false;
  let offsetX = 0;
  let offsetY = 0;

  noteEl.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("delete-btn")) return;
    active = true;
    noteEl.setPointerCapture(e.pointerId);
    const rect = noteEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  noteEl.addEventListener("pointermove", (e) => {
    if (!active) return;
    const canvasRect = ui.canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - canvasRect.left - offsetX, canvasRect.width - 250));
    const y = Math.max(0, Math.min(e.clientY - canvasRect.top - offsetY, canvasRect.height - 130));

    noteEl.style.left = `${x}px`;
    noteEl.style.top = `${y}px`;

    const note = state.notes.find((n) => n.id === noteEl.dataset.id);
    if (note) {
      note.x = x;
      note.y = y;
    }
    renderGroupHulls();
  });

  noteEl.addEventListener("pointerup", () => {
    active = false;
    saveState();
  });
}

function addGroup() {
  const name = ui.groupName.value.trim();
  if (!name) return;
  state.groups.push({ id: crypto.randomUUID(), name, color: ui.groupColor.value });
  ui.groupName.value = "";
  saveState();
  renderAll();
}

function addNote() {
  const title = ui.noteTitle.value.trim();
  const body = ui.noteBody.value.trim();
  if (!title || !body) return;

  state.notes.push({
    id: crypto.randomUUID(),
    title,
    body,
    type: ui.noteType.value,
    level: ui.noteLevel.value,
    groupId: ui.noteGroup.value,
    x: 80 + (state.notes.length % 4) * 26,
    y: 70 + (state.notes.length % 5) * 26,
  });

  ui.noteTitle.value = "";
  ui.noteBody.value = "";
  saveState();
  renderAll();
}

function payloadFor(scope) {
  const notes = scope === "all" ? state.notes : state.notes.filter((n) => n.groupId === scope);
  const grouped = Object.fromEntries(
    state.groups.map((g) => [
      g.name,
      notes
        .filter((n) => n.groupId === g.id)
        .map((n) => ({ title: n.title, description: n.body, type: n.type, level: n.level })),
    ]),
  );

  return {
    exportedAt: new Date().toISOString(),
    scope,
    groups: grouped,
  };
}

async function sendNotes() {
  state.targetUrl = ui.targetUrl.value.trim();
  saveState();

  const payload = payloadFor(ui.sendScope.value);
  if (!state.targetUrl) {
    ui.status.textContent = "Enter a URL first, or copy JSON manually.";
    return;
  }

  try {
    const response = await fetch(state.targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    ui.status.textContent = response.ok
      ? `Sent successfully (${response.status}).`
      : `Endpoint responded with ${response.status}. Payload may still be received.`;
  } catch {
    const encoded = encodeURIComponent(JSON.stringify(payload));
    window.open(`${state.targetUrl}?data=${encoded}`, "_blank");
    ui.status.textContent = "POST blocked. Opened URL with ?data= fallback in a new tab.";
  }
}

async function copyPayload() {
  const payload = JSON.stringify(payloadFor(ui.sendScope.value), null, 2);
  await navigator.clipboard.writeText(payload);
  ui.status.textContent = "Copied structured JSON to clipboard.";
}

ui.addGroupBtn.addEventListener("click", addGroup);
ui.addNoteBtn.addEventListener("click", addNote);
ui.sendBtn.addEventListener("click", sendNotes);
ui.copyBtn.addEventListener("click", copyPayload);

loadState();
renderAll();
