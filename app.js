const state = {
  catalog: null,
  statistics: null,
  view: initialView(),
  selectedTags: [],
  promptSearch: "",
  promptId: "",
  family: "openai_flagship",
  modelIndex: 0,
  chartRange: "recent",
};

const CHART_RANGES = {
  recent: {
    label: "Recent era",
    startTime: Date.UTC(2023, 0, 1),
    note: "Showing models released from 2023 onward.",
  },
  full: {
    label: "Full history",
    startTime: Number.NEGATIVE_INFINITY,
    note: "Showing the full release history.",
  },
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
  recentChartsButton: document.querySelector("#recentChartsButton"),
  fullHistoryChartsButton: document.querySelector("#fullHistoryChartsButton"),
  promptSearch: document.querySelector("#promptSearch"),
  tagList: document.querySelector("#tagList"),
  clearTags: document.querySelector("#clearTags"),
  promptMatchCount: document.querySelector("#promptMatchCount"),
  familySelect: document.querySelector("#familySelect"),
  familyField: document.querySelector(".family-field"),
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
  const [modelFamiliesResponse, responseCatalogueResponse, statisticsResponse] = await Promise.all([
    fetch("data/response-catalogue.json"),
    fetch("data/prompt-list.json"),
    fetch("data/statistics.json"),
  ]);
  const [modelFamilies, responseCatalogue] = await Promise.all([
    modelFamiliesResponse.json(),
    responseCatalogueResponse.json(),
  ]);
  state.catalog = {
    ...responseCatalogue,
    families: modelFamilies.families,
    responseRoot: responseCatalogue.responseRoot ?? modelFamilies.responseRoot,
    indexedAt: responseCatalogue.indexedAt ?? modelFamilies.indexedAt,
  };
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
  elements.familyField.classList.toggle("hidden", !showingResponses);
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
    marker.innerHTML = `
      <span class="timeline-date">${escapeHtml(model.releaseDate)}</span>
      <span class="timeline-model">${escapeHtml(model.label)}</span>
    `;
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
  renderStatisticsControls();

  const charts = [
    {
      key: "verbosity",
      title: "Average Verbosity",
      unit: "words",
      description: state.statistics.metricDefinitions.verbosity,
      value: (model) => model.metrics?.verbosity,
      format: (value) => `${Math.round(value).toLocaleString()} words`,
      domain: [0, 2400],
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
      domain: [0, 10],
    },
    {
      key: "quality",
      title: "Response Quality",
      unit: "1-10 judge score",
      description: state.statistics.metricDefinitions.quality,
      value: (model) => model.metrics?.quality,
      format: (value) => value.toFixed(1),
    },
    {
      key: "sycophancy",
      title: "Sycophancy",
      unit: "judge score",
      description: state.statistics.metricDefinitions.sycophancy,
      value: (model) => model.metrics?.sycophancy,
      format: (value) => value.toFixed(3),
      domain: [1.07, 1.42],
    },
    {
      key: "politicalAlignment",
      title: "Political Alignment",
      unit: "judge score",
      description: state.statistics.metricDefinitions.politicalAlignment,
      value: (model) => model.metrics?.politicalAlignment,
      format: (value) => value.toFixed(3),
      domain: [4.997, 5.028],
    },
  ];

  elements.chartGrid.innerHTML = charts.map((chart) => renderChartCard(chart)).join("");
}

function renderStatisticsControls() {
  const showingRecent = state.chartRange === "recent";
  elements.recentChartsButton.classList.toggle("active", showingRecent);
  elements.fullHistoryChartsButton.classList.toggle("active", !showingRecent);
  elements.recentChartsButton.setAttribute("aria-pressed", String(showingRecent));
  elements.fullHistoryChartsButton.setAttribute("aria-pressed", String(!showingRecent));
}

function chartSeries(chart) {
  const range = CHART_RANGES[state.chartRange] ?? CHART_RANGES.recent;
  return Object.entries(state.statistics.families ?? {})
    .map(([family, models], familyIndex) => {
      const values = models
        .map((model) => ({ ...model, value: chart.value(model) }))
        .filter((model) => Number.isFinite(model.value));
      const visibleValues = values.filter((model) => {
        const time = releaseTime(model.releaseDate);
        return !Number.isFinite(range.startTime) || !Number.isFinite(time) || time >= range.startTime;
      });
      return {
        family,
        label: formatFamilyLabel(family),
        color: chartColor(familyIndex),
        values: visibleValues,
        hiddenCount: values.length - visibleValues.length,
      };
    })
    .filter((series) => series.values.length > 0);
}

function renderChartCard(chart) {
  const series = chartSeries(chart);

  if (series.length === 0) {
    return `
      <article class="chart-card">
        <div class="chart-head">
          <div>
            <h2>${escapeHtml(chart.title)}</h2>
            <p>${escapeHtml(chart.description)}</p>
          </div>
        </div>
        <div class="chart-empty">No analysis metrics are available for this experiment yet.</div>
      </article>
    `;
  }

  const modelCount = series.reduce((total, item) => total + item.values.length, 0);
  const hiddenCount = series.reduce((total, item) => total + item.hiddenCount, 0);
  const chartNote = state.chartRange === "recent" && hiddenCount > 0
    ? `${hiddenCount.toLocaleString()} earlier models hidden. Switch to full history to include them.`
    : CHART_RANGES[state.chartRange].note;
  return `
    <article class="chart-card">
      <div class="chart-head">
        <div>
          <h2>${escapeHtml(chart.title)}</h2>
          <p>${escapeHtml(chart.description)}</p>
        </div>
        <span class="chart-value">${modelCount.toLocaleString()} models</span>
      </div>
      ${renderLineChart(series, chart)}
      <p class="chart-note">${escapeHtml(chartNote)}</p>
      ${renderLegend(series)}
    </article>
  `;
}

function renderLineChart(series, chart) {
  const width = 1040;
  const height = 420;
  const margin = { top: 24, right: 24, bottom: 58, left: 66 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const allValues = series.flatMap((item) => item.values.map((value) => value.value));
  const datedValues = series.flatMap((item) =>
    item.values
      .map((value) => ({ ...value, releaseTime: releaseTime(value.releaseDate) }))
      .filter((value) => Number.isFinite(value.releaseTime))
  );
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const fixedDomain = Array.isArray(chart.domain) && chart.domain.length === 2 ? chart.domain : null;
  const padding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.06, 1) : (rawMax - rawMin) * 0.06;
  const isLikert = ["quality", "sycophancy", "politicalAlignment"].includes(chart.key);
  const min = fixedDomain
    ? fixedDomain[0]
    : chart.key === "positivity"
      ? Math.max(-1, rawMin - padding)
      : isLikert
        ? Math.max(1, rawMin - padding)
        : Math.max(0, rawMin - padding);
  const max = fixedDomain
    ? fixedDomain[1]
    : chart.key === "positivity"
      ? Math.min(1, rawMax + padding)
      : isLikert
        ? Math.min(10, rawMax + padding)
        : rawMax + padding;
  const range = CHART_RANGES[state.chartRange] ?? CHART_RANGES.recent;
  const rawMinTime = Math.min(...datedValues.map((value) => value.releaseTime));
  const maxTime = Math.max(...datedValues.map((value) => value.releaseTime));
  const minTime = state.chartRange === "recent" ? range.startTime : rawMinTime;
  const timeSpan = maxTime - minTime || 1;
  const xFor = (releaseDate) => {
    const time = releaseTime(releaseDate);
    return Number.isFinite(time) ? margin.left + ((time - minTime) / timeSpan) * plotWidth : margin.left + plotWidth / 2;
  };
  const yFor = (value) => margin.top + ((max - value) / (max - min || 1)) * plotHeight;
  const drawableSeries = series.map((item) => ({
    ...item,
    points: item.values.map((value) => ({
      ...value,
      x: xFor(value.releaseDate),
      y: yFor(value.value),
    })),
  }));
  const yTicks = [min, (min + max) / 2, max];
  const xTicks = yearTicks(minTime, maxTime);

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chart.title)} over model releases">
      ${yTicks.map((tick) => `
        <line class="chart-gridline" x1="${margin.left}" x2="${width - margin.right}" y1="${yFor(tick).toFixed(1)}" y2="${yFor(tick).toFixed(1)}"></line>
        <text class="chart-y-label" x="${margin.left - 8}" y="${(yFor(tick) + 4).toFixed(1)}" text-anchor="end">${escapeHtml(formatAxisValue(tick, chart))}</text>
      `).join("")}
      <line class="chart-axis" x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}"></line>
      ${drawableSeries.map((item) => {
        const path = item.points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
        return `<path class="chart-line" d="${path}" style="stroke: ${item.color}"></path>`;
      }).join("")}
      ${drawableSeries.flatMap((item) => item.points.map((point) => `
        <circle class="chart-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" style="stroke: ${item.color}">
          <title>${escapeHtml(item.label)} - ${escapeHtml(point.label)} (${escapeHtml(point.releaseDate)}): ${escapeHtml(chart.format(point.value))}</title>
        </circle>
      `)).join("")}
      ${xTicks.map((tick) => `
        <line class="chart-date-tick" x1="${xForTime(tick.time, minTime, timeSpan, margin.left, plotWidth).toFixed(1)}" x2="${xForTime(tick.time, minTime, timeSpan, margin.left, plotWidth).toFixed(1)}" y1="${height - margin.bottom}" y2="${height - margin.bottom + 6}"></line>
        <text class="chart-label" x="${xForTime(tick.time, minTime, timeSpan, margin.left, plotWidth).toFixed(1)}" y="${height - 24}" text-anchor="middle">${escapeHtml(tick.label)}</text>
      `).join("")}
    </svg>
  `;
}

function releaseTime(releaseDate) {
  const months = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  const match = String(releaseDate ?? "").match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[2]), months[match[1]], 1);
}

function xForTime(time, minTime, timeSpan, left, width) {
  return left + ((time - minTime) / timeSpan) * width;
}

function yearTicks(minTime, maxTime) {
  if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) return [];
  const minYear = new Date(minTime).getUTCFullYear();
  const maxYear = new Date(maxTime).getUTCFullYear();
  const years = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    years.push({
      label: String(year),
      time: Date.UTC(year, 0, 1),
    });
  }
  return years;
}

function formatAxisValue(value, chart) {
  if (chart.key === "verbosity") return String(Math.round(value));
  if (chart.key === "sycophancy" || chart.key === "politicalAlignment") return value.toFixed(3);
  return value.toFixed(1);
}

function chartColor(index) {
  return [
    "#0f766e",
    "#2563eb",
    "#b45309",
    "#be123c",
    "#7c3aed",
    "#15803d",
    "#c026d3",
    "#475569",
    "#dc2626",
  ][index % 9];
}

function renderLegend(series) {
  return `
    <div class="chart-legend">
      ${series.map((item) => `
        <span><i style="background: ${item.color}"></i>${escapeHtml(item.label)}</span>
      `).join("")}
    </div>
  `;
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

elements.recentChartsButton.addEventListener("click", () => {
  state.chartRange = "recent";
  renderStatistics();
});

elements.fullHistoryChartsButton.addEventListener("click", () => {
  state.chartRange = "full";
  renderStatistics();
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
