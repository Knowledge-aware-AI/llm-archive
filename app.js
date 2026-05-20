const state = {
  catalog: null,
  statistics: null,
  view: initialView(),
  selectedTags: [],
  promptSearch: "",
  promptId: "",
  family: "openai_flagship",
  modelIndex: 0,
};

const elements = {
  catalogStatus: document.querySelector("#catalogStatus"),
  responsesViewButton: document.querySelector("#responsesViewButton"),
  statisticsViewButton: document.querySelector("#statisticsViewButton"),
  datasetViewButton: document.querySelector("#datasetViewButton"),
  responseControls: document.querySelector(".controls.response-view"),
  contentGrid: document.querySelector(".content-grid"),
  statisticsView: document.querySelector(".statistics-view"),
  datasetView: document.querySelector(".dataset-view"),
  chartGrid: document.querySelector("#chartGrid"),
  promptSearch: document.querySelector("#promptSearch"),
  tagList: document.querySelector("#tagList"),
  clearTags: document.querySelector("#clearTags"),
  promptMatchCount: document.querySelector("#promptMatchCount"),
  familySelect: document.querySelector("#familySelect"),
  modelPanel: document.querySelector(".slider-field-wide"),
  modelTrack: document.querySelector("#modelTrack"),
  modelSlider: document.querySelector("#modelSlider"),
  timeline: document.querySelector("#timeline"),
  modelLabel: document.querySelector("#modelLabel"),
  promptList: document.querySelector("#promptList"),
  promptTags: document.querySelector("#promptTags"),
  promptText: document.querySelector("#promptText"),
  responseStatus: document.querySelector("#responseStatus"),
  responsePath: document.querySelector("#responsePath"),
  responseText: document.querySelector("#responseText"),
};

function initialView() {
  return parseHash().view;
}

function parseHash() {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (rawHash === "statistics" || rawHash === "dataset") {
    return { view: rawHash, promptId: "" };
  }

  const params = new URLSearchParams(rawHash);
  const view = params.get("view");
  return {
    view: view === "statistics" || view === "dataset" ? view : "responses",
    promptId: params.get("prompt") || "",
  };
}

function buildHash({ view = state.view, promptId = state.promptId } = {}) {
  if (view === "statistics" || view === "dataset") return `#view=${view}`;
  return promptId ? `#prompt=${encodeURIComponent(promptId)}` : window.location.pathname;
}

function applyHashState({ render = false } = {}) {
  const { view, promptId } = parseHash();
  state.view = view;

  if (promptId && state.catalog?.prompts.some((prompt) => prompt.id === promptId)) {
    state.promptId = promptId;
    state.selectedTags = [];
    state.promptSearch = "";
    elements.promptSearch.value = "";
  }

  if (render) {
    renderCurrent();
    renderStatistics();
    renderView();
    loadResponse();
  }
}

async function loadCatalog({ preservePrompt = true } = {}) {
  elements.catalogStatus.textContent = "Loading snapshot";
  const [catalogResponse, statisticsResponse] = await Promise.all([
    fetch("data/data.json"),
    fetch("data/statistics.json"),
  ]);
  state.catalog = await catalogResponse.json();
  state.statistics = await statisticsResponse.json();

  if (!state.catalog.families[state.family]) {
    state.family = Object.keys(state.catalog.families)[0];
  }

  const models = getModels();
  state.modelIndex = Math.min(state.modelIndex, Math.max(models.length - 1, 0));
  const hashPromptId = parseHash().promptId;
  applyHashState();

  if ((!preservePrompt && !hashPromptId) || !state.catalog.prompts.some((prompt) => prompt.id === state.promptId)) {
    state.promptId = getFilteredPrompts()[0]?.id ?? state.catalog.prompts[0]?.id ?? "";
  }

  ensurePromptInFilter();
  renderControls();
  renderCurrent();
  renderStatistics();
  renderView();
  await loadResponse();

  const ready = Object.values(state.catalog.families)
    .flat()
    .reduce((total, model) => total + model.availableCount, 0);
  elements.catalogStatus.textContent = `${ready} responses in snapshot`;
}

function getModels() {
  return state.catalog?.families[state.family] ?? [];
}

function getCurrentModel() {
  return getModels()[state.modelIndex];
}

function getCurrentPrompt() {
  return state.catalog?.prompts.find((prompt) => prompt.id === state.promptId);
}

function getTags() {
  return state.catalog?.tags ?? [];
}

function getFilteredPrompts() {
  const selectedTags = new Set(state.selectedTags);
  const search = state.promptSearch.trim().toLowerCase();

  return (state.catalog?.prompts ?? []).filter((prompt) => {
    const promptTags = new Set(prompt.tags ?? []);
    const hasTags = [...selectedTags].every((tag) => promptTags.has(tag));
    const matchesSearch = !search || prompt.text.toLowerCase().includes(search);
    return hasTags && matchesSearch;
  });
}

function ensurePromptInFilter() {
  const filteredPrompts = getFilteredPrompts();
  if (filteredPrompts.length === 0) return;

  const prompt = getCurrentPrompt();
  if (prompt && filteredPrompts.some((item) => item.id === prompt.id)) return;

  state.promptId = filteredPrompts[0].id;
}

function formatFamilyLabel(family) {
  return family
    .split("_")
    .map((part) => part === "openai" ? "OpenAI" : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTag(tag) {
  return tag.replaceAll("-", " ");
}

function populateFamilySelect(select) {
  select.innerHTML = "";
  for (const family of Object.keys(state.catalog.families)) {
    const option = document.createElement("option");
    option.value = family;
    option.textContent = formatFamilyLabel(family);
    select.append(option);
  }
  select.value = state.family;
}

function renderControls() {
  populateFamilySelect(elements.familySelect);

  const models = getModels();
  elements.modelPanel.style.setProperty("--model-count", String(Math.max(models.length, 1)));
  elements.modelTrack.style.setProperty("--model-count", String(Math.max(models.length, 1)));
  elements.modelSlider.max = String(Math.max(models.length - 1, 0));
  elements.modelSlider.value = String(state.modelIndex);
  elements.modelSlider.disabled = models.length <= 1;

  renderTimeline(models);
  renderTagList();
}

function renderView() {
  const showingResponses = state.view === "responses";
  const showingStatistics = state.view === "statistics";
  const showingDataset = state.view === "dataset";
  elements.responsesViewButton.classList.toggle("active", showingResponses);
  elements.statisticsViewButton.classList.toggle("active", showingStatistics);
  elements.datasetViewButton.classList.toggle("active", showingDataset);
  elements.responsesViewButton.setAttribute("aria-pressed", String(showingResponses));
  elements.statisticsViewButton.setAttribute("aria-pressed", String(showingStatistics));
  elements.datasetViewButton.setAttribute("aria-pressed", String(showingDataset));
  elements.responseControls.classList.toggle("hidden", !showingResponses);
  elements.contentGrid.classList.toggle("hidden", !showingResponses);
  elements.statisticsView.classList.toggle("hidden", !showingStatistics);
  elements.datasetView.classList.toggle("hidden", !showingDataset);
}

function setView(view, { updateHash = true } = {}) {
  state.view = view;
  if (updateHash) {
    history.replaceState(null, "", buildHash({ view }));
  }
  if (view === "statistics") {
    renderStatistics();
  }
  renderView();
}

function renderTimeline(models) {
  elements.timeline.innerHTML = "";
  for (const [index, model] of models.entries()) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `timeline-marker${index === state.modelIndex ? " active" : ""}`;
    marker.title = `${model.label} - approx. ${model.releaseDate}`;
    marker.setAttribute("aria-label", `${model.label}, approximate release ${model.releaseDate}`);
    marker.innerHTML = `<span>${escapeHtml(model.releaseDate)}</span>`;
    marker.addEventListener("click", () => {
      state.modelIndex = index;
      renderCurrent();
      loadResponse();
    });
    elements.timeline.append(marker);
  }
}

function renderTagList() {
  const tagCounts = countFilteredTags();
  elements.tagList.innerHTML = "";

  for (const tag of getTags()) {
    const selected = state.selectedTags.includes(tag);
    const count = tagCounts.get(tag) ?? 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-chip${selected ? " active" : ""}`;
    button.disabled = count === 0 && !selected;
    button.setAttribute("aria-pressed", String(selected));
    button.innerHTML = `
      <span>${escapeHtml(formatTag(tag))}</span>
      <strong>${count}</strong>
    `;
    button.addEventListener("click", () => toggleTag(tag));
    elements.tagList.append(button);
  }

  elements.clearTags.disabled = state.selectedTags.length === 0 && !state.promptSearch;
}

function countFilteredTags() {
  const counts = new Map();
  const selectedTags = new Set(state.selectedTags);
  const search = state.promptSearch.trim().toLowerCase();

  for (const prompt of state.catalog?.prompts ?? []) {
    if (search && !prompt.text.toLowerCase().includes(search)) continue;

    const promptTags = new Set(prompt.tags ?? []);
    const matchesCurrentTags = [...selectedTags].every((tag) => promptTags.has(tag));
    if (!matchesCurrentTags) continue;

    for (const tag of promptTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return counts;
}

function toggleTag(tag) {
  if (state.selectedTags.includes(tag)) {
    state.selectedTags = state.selectedTags.filter((item) => item !== tag);
  } else {
    state.selectedTags = [...state.selectedTags, tag];
  }
  ensurePromptInFilter();
  renderCurrent();
  loadResponse();
}

function statusForModel(model) {
  const status = model.promptStatuses.find((item) => item.promptId === state.promptId)?.status;
  return status ?? "missing";
}

function renderCurrent() {
  ensurePromptInFilter();

  const model = getCurrentModel();
  const prompt = getCurrentPrompt();
  if (!model) return;

  const filteredPrompts = getFilteredPrompts();
  elements.modelLabel.textContent = `${model.label} - ${model.releaseDate}`;
  elements.promptMatchCount.textContent = `${filteredPrompts.length} ${filteredPrompts.length === 1 ? "match" : "matches"}`;

  if (prompt && filteredPrompts.some((item) => item.id === prompt.id)) {
    elements.promptTags.textContent = [prompt.id, ...(prompt.tags ?? []).map(formatTag)].join(" · ");
    elements.promptText.textContent = prompt.text;
  } else {
    elements.promptTags.textContent = "No matching prompt";
    elements.promptText.textContent = "Adjust the selected tags or search text";
  }

  renderPromptList(model, filteredPrompts);
  renderControls();
}

function renderPromptList(model, filteredPrompts) {
  elements.promptList.innerHTML = "";

  if (filteredPrompts.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No prompts match this tag combination.";
    elements.promptList.append(emptyState);
    return;
  }

  for (const prompt of filteredPrompts) {
    const status = model.promptStatuses.find((item) => item.promptId === prompt.id)?.status ?? "missing";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `prompt-item${prompt.id === state.promptId ? " active" : ""}`;
    button.dataset.status = status;
    button.innerHTML = `
      <span class="prompt-number">${String(prompt.index).padStart(2, "0")}</span>
      <span class="prompt-copy">
        <span class="prompt-text">${escapeHtml(prompt.text)}</span>
        <span class="prompt-tags">${escapeHtml([prompt.id, ...(prompt.tags ?? []).map(formatTag)].join(" · "))}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      state.promptId = prompt.id;
      state.view = "responses";
      history.replaceState(null, "", buildHash({ view: "responses", promptId: prompt.id }));
      renderCurrent();
      renderView();
      loadResponse();
    });
    elements.promptList.append(button);
  }
}

function renderStatistics() {
  if (!state.statistics || !elements.chartGrid) return;

  const models = state.statistics.families[state.family] ?? [];
  const charts = [
    {
      key: "verbosity",
      title: "Average Verbosity",
      unit: "words",
      description: state.statistics.metricDefinitions.verbosity,
      value: (model) => model.metrics?.verbosity,
      format: (value) => `${Math.round(value).toLocaleString()} words`,
    },
    {
      key: "positivity",
      title: "Average Positivity",
      unit: "score",
      description: state.statistics.metricDefinitions.positivity,
      value: (model) => model.metrics?.positivity,
      format: (value) => value.toFixed(2),
    },
    {
      key: "epistemicHumility",
      title: "Epistemic Humility",
      unit: "markers / 1k words",
      description: state.statistics.metricDefinitions.epistemicHumility,
      value: (model) => model.metrics?.epistemicHumility,
      format: (value) => value.toFixed(1),
    },
  ];

  elements.chartGrid.innerHTML = charts.map((chart) => renderChartCard(chart, models)).join("");
}

function renderChartCard(chart, models) {
  const values = models
    .map((model) => ({ ...model, value: chart.value(model) }))
    .filter((model) => Number.isFinite(model.value));

  if (values.length === 0) {
    return `
      <article class="chart-card">
        <div class="chart-head">
          <div>
            <h2>${escapeHtml(chart.title)}</h2>
            <p>${escapeHtml(chart.description)}</p>
          </div>
        </div>
        <div class="chart-empty">No analysis metrics are available for this family yet.</div>
      </article>
    `;
  }

  const latest = values[values.length - 1];
  return `
    <article class="chart-card">
      <div class="chart-head">
        <div>
          <h2>${escapeHtml(chart.title)}</h2>
          <p>${escapeHtml(chart.description)}</p>
        </div>
        <span class="chart-value">${escapeHtml(chart.format(latest.value))}</span>
      </div>
      ${renderLineChart(values, chart)}
    </article>
  `;
}

function renderLineChart(values, chart) {
  const width = 520;
  const height = 300;
  const margin = { top: 18, right: 18, bottom: 82, left: 54 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const rawMin = Math.min(...values.map((item) => item.value));
  const rawMax = Math.max(...values.map((item) => item.value));
  const padding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.1, 1) : (rawMax - rawMin) * 0.12;
  const min = chart.key === "positivity" ? Math.min(-1, rawMin - padding) : Math.max(0, rawMin - padding);
  const max = chart.key === "positivity" ? Math.max(1, rawMax + padding) : rawMax + padding;
  const xFor = (index) => margin.left + (values.length === 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth);
  const yFor = (value) => margin.top + ((max - value) / (max - min || 1)) * plotHeight;
  const points = values.map((item, index) => ({
    ...item,
    x: xFor(index),
    y: yFor(item.value),
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const yTicks = [min, (min + max) / 2, max];

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chart.title)} over model releases">
      ${yTicks.map((tick) => `
        <line class="chart-gridline" x1="${margin.left}" x2="${width - margin.right}" y1="${yFor(tick).toFixed(1)}" y2="${yFor(tick).toFixed(1)}"></line>
        <text class="chart-y-label" x="${margin.left - 8}" y="${(yFor(tick) + 4).toFixed(1)}" text-anchor="end">${escapeHtml(formatAxisValue(tick, chart))}</text>
      `).join("")}
      <line class="chart-axis" x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}"></line>
      <path class="chart-line" d="${path}"></path>
      ${points.map((point) => `
        <circle class="chart-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4">
          <title>${escapeHtml(point.label)} (${escapeHtml(point.releaseDate)}): ${escapeHtml(chart.format(point.value))}</title>
        </circle>
      `).join("")}
      ${points.map((point, index) => `
        <text class="chart-label" x="${point.x.toFixed(1)}" y="${height - 48}" text-anchor="end" transform="rotate(-38 ${point.x.toFixed(1)} ${height - 48})">${escapeHtml(point.releaseDate)}</text>
        <text class="chart-model-label" x="${point.x.toFixed(1)}" y="${height - 18}" text-anchor="middle">${escapeHtml(shortModelLabel(point.label, index, points.length))}</text>
      `).join("")}
    </svg>
  `;
}

function formatAxisValue(value, chart) {
  if (chart.key === "verbosity") return String(Math.round(value));
  return value.toFixed(1);
}

function shortModelLabel(label, index, total) {
  if (total > 7 && index % 2 === 1) return "";
  return label
    .replace("Gemini ", "G ")
    .replace("Claude ", "C ")
    .replace("GPT-", "G")
    .replace(" Preview", "")
    .replace(" Turbo", "T")
    .replace(" Mini", "M")
    .replace(" Flash", "F")
    .replace(" Lite", "L");
}

async function loadResponse() {
  const model = getCurrentModel();
  const prompt = getCurrentPrompt();
  const filteredPrompts = getFilteredPrompts();
  if (!model || !prompt || !filteredPrompts.some((item) => item.id === prompt.id)) {
    setResponseStatus("Waiting", "");
    elements.responseText.textContent = "No prompt matches the current filters.";
    return;
  }

  setResponseStatus("Loading", "");
  elements.responseText.textContent = "";

  const url = `data/responses/${encodeURIComponent(model.id)}/${encodeURIComponent(prompt.id)}.json`;
  const response = await fetch(url);

  if (response.status === 404) {
    setResponseStatus("Pending", "missing");
    elements.responseText.textContent = "No response file was present when this server snapshot was created.";
    return;
  }

  const payload = await response.json();
  setResponseStatus(payload.status === "error" ? "Error file" : "Ready", payload.status, payload.path ?? "");
  elements.responseText.textContent = payload.content || "(empty response)";
}

function setResponseStatus(label, status, path = "") {
  if (elements.responseStatus) {
    elements.responseStatus.textContent = label;
    elements.responseStatus.dataset.status = status;
  }
  if (elements.responsePath) {
    elements.responsePath.textContent = path;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

elements.promptSearch.addEventListener("input", () => {
  state.promptSearch = elements.promptSearch.value;
  ensurePromptInFilter();
  renderCurrent();
  loadResponse();
});

elements.responsesViewButton.addEventListener("click", () => {
  setView("responses");
});

elements.statisticsViewButton.addEventListener("click", () => {
  setView("statistics");
});

elements.datasetViewButton.addEventListener("click", () => {
  setView("dataset");
});

window.addEventListener("hashchange", () => {
  applyHashState({ render: true });
});

elements.clearTags.addEventListener("click", () => {
  state.selectedTags = [];
  state.promptSearch = "";
  elements.promptSearch.value = "";
  ensurePromptInFilter();
  renderCurrent();
  loadResponse();
});

elements.familySelect.addEventListener("change", () => {
  state.family = elements.familySelect.value;
  state.modelIndex = 0;
  renderCurrent();
  renderStatistics();
  loadResponse();
});

elements.modelSlider.addEventListener("input", () => {
  state.modelIndex = Number(elements.modelSlider.value);
  renderCurrent();
  loadResponse();
});

loadCatalog({ preservePrompt: false }).catch((error) => {
  elements.catalogStatus.textContent = "Load failed";
  elements.responseText.textContent = String(error);
});
