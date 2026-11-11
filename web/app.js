const sessionId = getSessionId();
const history = document.getElementById("history");
const form = document.getElementById("chat-form");
const message = document.getElementById("message");
const status = document.getElementById("status");
const send = document.getElementById("send");
const confirmation = document.getElementById("confirmation");
const artifacts = document.getElementById("artifacts");
const artifactList = document.getElementById("artifact-list");
const accessPanel = document.getElementById("access");
const appContent = document.getElementById("app-content");
const accessForm = document.getElementById("access-form");
const accessToken = document.getElementById("access-token");
const accessError = document.getElementById("access-error");

accessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void login(accessToken.value.trim());
});

async function login(token) {
  try {
    const response = await fetch("/api/access", { method: "POST", headers: { authorization: `Bearer ${token}` } });
    if (response.ok) {
      accessPanel.hidden = true;
      appContent.hidden = false;
      return;
    }
  } catch {
    accessError.textContent = "No se pudo contactar el servidor.";
    return;
  }
  accessError.textContent = "Clave incorrecta.";
}

void (async () => {
  const health = await fetch("/api/health").then((r) => r.status).catch(() => 0);
  if (health === 401) {
    accessPanel.hidden = false;
    appContent.hidden = true;
  }
})();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = message.value.trim();
  if (!text) return;
  message.value = "";
  void submit(text);
});

document.getElementById("confirm")?.addEventListener("click", () => { confirmation.hidden = true; void submit("Sí, confirmo y autorizo el envío simulado."); });
document.getElementById("reject")?.addEventListener("click", () => { confirmation.hidden = true; void submit("No confirmo el envío."); });

async function submit(text) {
  append("user", text);
  setBusy(true);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, message: text })
    });
    const body = await response.json();
    if (!body.ok) {
      append("assistant", `No pude responder: ${body.error ?? "error desconocido"}`);
      return;
    }
    append("assistant", body.reply ?? "", body.toolCalls ?? []);
    confirmation.hidden = !body.needsConfirmation;
    renderArtifacts(body.toolCalls ?? []);
  } catch {
    append("assistant", "No pude contactar el servidor.");
  } finally {
    setBusy(false);
  }
}

function append(role, text, toolCalls = []) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const title = document.createElement("strong");
  title.textContent = role === "user" ? "Tú" : "Asistente";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(title, paragraph);
  if (toolCalls.length) {
    const list = document.createElement("ul");
    list.className = "tools";
    for (const call of toolCalls) {
      const item = document.createElement("li");
      item.textContent = `${call.name} — ${call.result}`;
      list.append(item);
    }
    article.append(list);
  }
  history.append(article);
  article.scrollIntoView({ behavior: "smooth", block: "end" });
}

function renderArtifacts(toolCalls) {
  const paths = toolCalls.map((call) => String(call.result).match(/ruta=(out\/[^\s]+)/)?.[1]).filter(Boolean);
  if (!paths.length) return;
  artifacts.hidden = false;
  for (const item of paths) {
    const parts = item.split("/");
    if (parts.length < 3) continue;
    const link = document.createElement("a");
    link.href = `/api/files/${parts.slice(1).map(encodeURIComponent).join("/")}`;
    link.textContent = item;
    link.download = "";
    const entry = document.createElement("li");
    entry.append(link);
    artifactList.append(entry);
  }
}

function setBusy(busy) {
  send.disabled = busy;
  status.textContent = busy ? "Pensando…" : "";
}

function getSessionId() {
  const key = "registro-proveedor-session";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}