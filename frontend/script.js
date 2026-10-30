const elements = {
  connection: document.querySelector("#connectionState"),
  connectionLabel: document.querySelector("#connectionLabel"),
  refreshButton: document.querySelector("#refreshButton"),
  mobileNewAnalysis: document.querySelector("#mobileNewAnalysis"),
  conversationList: document.querySelector("#conversationList"),
  newAnalysis: document.querySelector("#newAnalysis"),
  welcome: document.querySelector("#welcomeState"),
  feed: document.querySelector("#messageFeed"),
  form: document.querySelector("#messageForm"),
  input: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton"),
  sendLabel: document.querySelector("#sendLabel"),
  charCount: document.querySelector("#charCount"),
  error: document.querySelector("#errorBanner"),
};

let activeSessionId = null;
let isSubmitting = false;

function setConnectionStatus(online, checking = false) {
  elements.connection.classList.toggle("offline", !online && !checking);
  const dot = elements.connection.querySelector(".connection-dot");
  dot.classList.toggle("checking", checking);
  elements.connectionLabel.textContent = checking
    ? "Checking service"
    : online
      ? "Service online"
      : "Service unavailable";
}

async function checkHealth() {
  setConnectionStatus(false, true);
  try {
    const response = await fetch("/health");
    if (!response.ok) throw new Error(`Health check failed (${response.status}).`);
    setConnectionStatus(true);
  } catch {
    void checkHealth();
  }
}

function clearError() {
  elements.error.hidden = true;
  elements.error.textContent = "";
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

async function getErrorMessage(response) {
  try {
    const body = await response.json();
    const detail = body.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail.error === "string") return detail.error;
    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg).filter(Boolean).join(" ");
    }
  } catch {
    return `Request failed (${response.status}).`;
  }
  return `Request failed (${response.status}).`;
}

function appendText(parent, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

function metricClass(label, value) {
  const normalized = String(value).toLowerCase();
  if (label === "Risk") return `risk-${normalized}`;
  if (label === "Priority") return `priority-${normalized}`;
  if (label === "Follow-up") return normalized === "yes" ? "action-yes" : "";
  return "";
}

function appendAnalysis(parent, result, reply) {
  const section = document.createElement("section");
  section.className = "analysis-card";
  section.setAttribute("aria-label", "Analysis results");

  const header = document.createElement("div");
  header.className = "analysis-top";
  appendText(header, "span", "analysis-label", "MESSAGE SCREENING");
  appendText(header, "span", "status-chip", "Analysis complete");
  section.append(header);

  const body = document.createElement("div");
  body.className = "analysis-body";
  appendText(body, "div", "summary-label", "Summary");
  appendText(body, "p", "analysis-summary", result.summary);

  const metrics = [
    ["Intent", String(result.intent || "unknown").replaceAll("_", " ")],
    ["Risk", result.risk_profile || "unknown"],
    ["Priority", result.priority || "unknown"],
    ["Follow-up", result.required_action ? "Yes" : "No"],
  ];
  const grid = document.createElement("div");
  grid.className = "metrics-grid";
  for (const [label, value] of metrics) {
    const metric = document.createElement("div");
    metric.className = "metric";
    appendText(metric, "span", "metric-label", label);
    appendText(metric, "span", `metric-value ${metricClass(label, value)}`, value);
    grid.append(metric);
  }
  body.append(grid);
  section.append(body);

  const footer = document.createElement("div");
  footer.className = "analysis-footer";
  const tokenCount = result.token_metadata?.estimated_input_tokens;
  appendText(
    footer,
    "span",
    "",
    Number.isInteger(tokenCount) ? `Approx. ${tokenCount} input tokens` : "Message analyzed",
  );
  appendText(footer, "span", "", "Message-only analysis");
  section.append(footer);

  const article = document.createElement("article");
  article.className = "turn";
  const heading = document.createElement("div");
  heading.className = "assistant-heading";
  appendText(heading, "span", "assistant-mark", "✳");
  appendText(heading, "span", "", "Firewall assistant");
  article.append(heading, section);
  if (reply) appendText(article, "p", "analysis-reply", reply);
  parent.append(article);
}

function appendTurn({ role, content, analysis }) {
  if (role === "user") {
    appendText(elements.feed, "div", "user-message", content);
    return;
  }

  if (analysis) {
    appendAnalysis(elements.feed, analysis, content);
    return;
  }

  const assistantMessage = document.createElement("article");
  assistantMessage.className = "turn";
  const heading = document.createElement("div");
  heading.className = "assistant-heading";
  appendText(heading, "span", "assistant-mark", "✳");
  appendText(heading, "span", "", "Firewall assistant");
  assistantMessage.append(heading);
  appendText(assistantMessage, "p", "analysis-reply", content);
  elements.feed.append(assistantMessage);
}

function setFeedVisible() {
  const hasMessages = elements.feed.childElementCount > 0;
  elements.welcome.hidden = hasMessages;
  elements.feed.hidden = !hasMessages;
}

function scrollToLatest() {
  elements.feed.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
}

function showLoading() {
  const loading = document.createElement("div");
  loading.className = "loading-message";
  loading.id = "loadingMessage";
  loading.append(document.createTextNode("Screening message"));
  const dots = document.createElement("span");
  dots.className = "loading-dots";
  for (let index = 0; index < 3; index += 1) dots.append(document.createElement("i"));
  loading.append(dots);
  elements.feed.append(loading);
  setFeedVisible();
  scrollToLatest();
}

function removeLoading() {
  document.querySelector("#loadingMessage")?.remove();
}

async function loadConversations() {
  try {
    const response = await fetch("/api/conversations");
    if (!response.ok) throw new Error(await getErrorMessage(response));
    const { items = [] } = await response.json();
    elements.conversationList.replaceChildren();
    if (items.length === 0) {
      appendText(elements.conversationList, "p", "empty-history", "Your analyses will appear here.");
      return;
    }

    for (const conversation of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-item";
      button.classList.toggle("active", conversation.session_id === activeSessionId);
      button.setAttribute("aria-current", conversation.session_id === activeSessionId ? "page" : "false");
      button.addEventListener("click", () => openConversation(conversation.session_id));
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 20 20");
      icon.setAttribute("aria-hidden", "true");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M3 4.5h14v9H9l-4 3v-3H3z");
      icon.append(path);
      button.append(icon);
      appendText(button, "span", "conversation-title", conversation.title || "New analysis");
      elements.conversationList.append(button);
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not load recent analyses.");
  }
}

async function openConversation(sessionId) {
  clearError();
  try {
    const response = await fetch(`/api/conversations/${encodeURIComponent(sessionId)}/messages`);
    if (!response.ok) throw new Error(await getErrorMessage(response));
    const { items = [] } = await response.json();
    activeSessionId = sessionId;
    elements.feed.replaceChildren();
    for (const message of items) appendTurn(message);
    setFeedVisible();
    await loadConversations();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not open this analysis.");
  }
}

function startNewAnalysis() {
  activeSessionId = null;
  elements.feed.replaceChildren();
  setFeedVisible();
  clearError();
  elements.input.focus();
  void loadConversations();
}

async function submitMessage(event) {
  event.preventDefault();
  if (isSubmitting) return;
  const message = elements.input.value.trim();
  if (!message) {
    elements.input.focus();
    return;
  }

  isSubmitting = true;
  clearError();
  elements.sendButton.disabled = true;
  elements.sendLabel.textContent = "Analyzing";
  appendText(elements.feed, "div", "user-message", message);
  showLoading();
  elements.input.value = "";
  updateCharacterCount();
  elements.input.style.height = "auto";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: activeSessionId }),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response));
    const result = await response.json();
    removeLoading();
    activeSessionId = result.session_id;
    appendAnalysis(elements.feed, result, result.response_markdown || "");
    setFeedVisible();
    await loadConversations();
  } catch (error) {
    removeLoading();
    showError(error instanceof Error ? error.message : "The analysis request failed.");
    setFeedVisible();
    setConnectionStatus(false);
  } finally {
    isSubmitting = false;
    elements.sendButton.disabled = false;
    elements.sendLabel.textContent = "Analyze";
    elements.input.focus();
    scrollToLatest();
  }
}

function updateCharacterCount() {
  elements.charCount.textContent = `${elements.input.value.length} / 5000`;
}

elements.form.addEventListener("submit", submitMessage);
elements.input.addEventListener("input", () => {
  updateCharacterCount();
  elements.input.style.height = "auto";
  elements.input.style.height = `${Math.min(elements.input.scrollHeight, 180)}px`;
});
elements.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    elements.form.requestSubmit();
  }
});
elements.newAnalysis.addEventListener("click", startNewAnalysis);
elements.mobileNewAnalysis.addEventListener("click", startNewAnalysis);
elements.refreshButton.addEventListener("click", checkHealth);
document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.input.value = button.dataset.prompt || "";
    updateCharacterCount();
    elements.input.focus();
    elements.input.dispatchEvent(new Event("input"));
  });
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    startNewAnalysis();
  }
});

setFeedVisible();
updateCharacterCount();
void checkHealth();
void loadConversations();
