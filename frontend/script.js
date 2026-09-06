/**
 * NeuroLens AI — script.js
 * Handles file upload, data preview, and AI chat UI.
 */

const API_BASE = "http://localhost:5000";

// ── Elements ──
const uploadBox   = document.getElementById("uploadBox");
const fileInput   = document.getElementById("fileInput");
const resultPanel = document.getElementById("resultPanel");
const resultFilename = document.getElementById("resultFilename");
const resultMeta  = document.getElementById("resultMeta");
const resultPreview = document.getElementById("resultPreview");
const clearBtn    = document.getElementById("clearBtn");
const chatMessages = document.getElementById("chatMessages");
const chatInput   = document.getElementById("chatInput");
const sendBtn     = document.getElementById("sendBtn");

let currentFile = null;
let datasetContext = "";

// ── Drag & Drop ──
uploadBox.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadBox.classList.add("drag-over");
});
uploadBox.addEventListener("dragleave", () => uploadBox.classList.remove("drag-over"));
uploadBox.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadBox.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleUpload(file);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleUpload(fileInput.files[0]);
});

// ── Upload ──
async function handleUpload(file) {
  currentFile = file;
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });

    if (!res.ok) {
      const err = await res.json();
      showError(err.error || "Upload failed");
      return;
    }

    const data = await res.json();
    showResult(data);
  } catch {
    // Backend not running — show mock preview for demo purposes
    showMockResult(file);
  }
}

function showResult(data) {
  uploadBox.style.display = "none";
  resultPanel.style.display = "block";
  resultFilename.textContent = data.filename;
  resultMeta.textContent = `${data.rows.toLocaleString()} rows · ${data.columns.length} columns · ${data.columns.join(", ")}`;

  datasetContext = `File: ${data.filename}\nRows: ${data.rows}\nColumns: ${data.columns.join(", ")}`;

  if (data.preview && data.preview.length) {
    renderTable(data.columns, data.preview);
  }
}

function showMockResult(file) {
  uploadBox.style.display = "none";
  resultPanel.style.display = "block";
  resultFilename.textContent = file.name;
  resultMeta.textContent = `File loaded locally (backend not connected) · ${(file.size / 1024).toFixed(1)} KB`;

  datasetContext = `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB) — backend not connected, using demo mode.`;

  // Parse CSV client-side for preview
  if (file.name.endsWith(".csv")) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.trim().split("\n").slice(0, 6);
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
      const rows = lines.slice(1).map(l =>
        Object.fromEntries(l.split(",").map((v, i) => [headers[i], v.trim().replace(/"/g, "")]))
      );
      renderTable(headers, rows);
    };
    reader.readAsText(file);
  }
}

function renderTable(columns, rows) {
  const th = columns.map(c => `<th>${escHtml(c)}</th>`).join("");
  const trs = rows.map(row =>
    `<tr>${columns.map(c => `<td>${escHtml(String(row[c] ?? ""))}</td>`).join("")}</tr>`
  ).join("");

  resultPreview.innerHTML = `
    <p style="font-size:.78rem;color:var(--muted);margin-top:12px;margin-bottom:4px;">Preview (first 5 rows)</p>
    <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
  `;
}

// ── Clear ──
clearBtn.addEventListener("click", () => {
  currentFile = null;
  datasetContext = "";
  resultPanel.style.display = "none";
  uploadBox.style.display = "block";
  fileInput.value = "";
  resultPreview.innerHTML = "";
  resultMeta.textContent = "";
  chatMessages.innerHTML = `<div class="chat-msg ai">Hello! I've loaded your dataset. What would you like to know?</div>`;
});

// ── Chat ──
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

async function sendMessage() {
  const question = chatInput.value.trim();
  if (!question) return;

  appendMessage("user", question);
  chatInput.value = "";

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context: datasetContext }),
    });
    const data = await res.json();
    appendMessage("ai", data.answer || "No response received.");
  } catch {
    // Fallback: answer from client-side context
    appendMessage("ai", generateLocalAnswer(question, datasetContext));
  }
}

function appendMessage(role, text) {
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function generateLocalAnswer(question, context) {
  if (!context) return "Please upload a dataset first so I can help you analyse it.";
  return `I can see your dataset (${context.split("\n")[0]}). To get AI-powered answers, connect the backend by running: cd backend && python app.py. Then I'll be able to answer "${question}" with real intelligence!`;
}

// ── Utility ──
function showError(msg) {
  alert(`Error: ${msg}`);
}

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
