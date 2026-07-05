const WORDS = window.NATION_WORDS || [];
const DAY_SIZE = 50;
const TOTAL_DAYS = Math.ceil(WORDS.length / DAY_SIZE);
const STORAGE_KEY = "nation-1k-word-card:v1";

const els = {
  totalWords: document.getElementById("totalWords"),
  knownWords: document.getElementById("knownWords"),
  reviewWords: document.getElementById("reviewWords"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  panels: {
    today: document.getElementById("todayPanel"),
    review: document.getElementById("reviewPanel"),
    library: document.getElementById("libraryPanel"),
  },
  dayTitle: document.getElementById("dayTitle"),
  dayRange: document.getElementById("dayRange"),
  dayProgress: document.getElementById("dayProgress"),
  prevDayButton: document.getElementById("prevDayButton"),
  nextDayButton: document.getElementById("nextDayButton"),
  cardPosition: document.getElementById("cardPosition"),
  statusPill: document.getElementById("statusPill"),
  speakButton: document.getElementById("speakButton"),
  wordId: document.getElementById("wordId"),
  wordText: document.getElementById("wordText"),
  ipaText: document.getElementById("ipaText"),
  meaningText: document.getElementById("meaningText"),
  noteInput: document.getElementById("noteInput"),
  prevCardButton: document.getElementById("prevCardButton"),
  nextCardButton: document.getElementById("nextCardButton"),
  toggleMeaningButton: document.getElementById("toggleMeaningButton"),
  againButton: document.getElementById("againButton"),
  knownButton: document.getElementById("knownButton"),
  playDayButton: document.getElementById("playDayButton"),
  dailyList: document.getElementById("dailyList"),
  reviewList: document.getElementById("reviewList"),
  libraryList: document.getElementById("libraryList"),
  clearReviewButton: document.getElementById("clearReviewButton"),
  searchInput: document.getElementById("searchInput"),
  settingsButton: document.getElementById("settingsButton"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettingsButton: document.getElementById("closeSettingsButton"),
  autoSpeakInput: document.getElementById("autoSpeakInput"),
  hideMeaningInput: document.getElementById("hideMeaningInput"),
  rateInput: document.getElementById("rateInput"),
  resetStartButton: document.getElementById("resetStartButton"),
  exportButton: document.getElementById("exportButton"),
  importInput: document.getElementById("importInput"),
};

let activeTab = "today";
let meaningVisible = true;
let voices = [];
let readingQueueActive = false;

function todayKey() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayFromStart(startDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const now = new Date(`${todayKey()}T00:00:00`);
  const diff = Math.floor((now - start) / 86400000) + 1;
  return clamp(diff, 1, TOTAL_DAYS);
}

function defaultState() {
  const day = 1;
  return {
    startDate: todayKey(),
    lastOpenDate: todayKey(),
    activeDay: day,
    cardIndex: 0,
    statuses: {},
    notes: {},
    settings: {
      autoSpeak: false,
      hideMeaning: false,
      rate: 0.85,
    },
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const base = defaultState();
    const merged = {
      ...base,
      ...saved,
      statuses: { ...base.statuses, ...(saved?.statuses || {}) },
      notes: { ...base.notes, ...(saved?.notes || {}) },
      settings: { ...base.settings, ...(saved?.settings || {}) },
    };
    const computedDay = dayFromStart(merged.startDate);
    if (merged.lastOpenDate !== todayKey()) {
      merged.activeDay = computedDay;
      merged.cardIndex = 0;
      merged.lastOpenDate = todayKey();
    }
    merged.activeDay = clamp(merged.activeDay || computedDay, 1, TOTAL_DAYS);
    merged.cardIndex = clamp(merged.cardIndex || 0, 0, getDayWords(merged.activeDay).length - 1);
    return merged;
  } catch {
    return defaultState();
  }
}

let state = loadState();

function saveState() {
  try {
    state.lastOpenDate = todayKey();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    window.alert("本地保存失败，请检查浏览器存储空间。");
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDayWords(day) {
  const start = (day - 1) * DAY_SIZE;
  return WORDS.slice(start, start + DAY_SIZE);
}

function currentWords() {
  return getDayWords(state.activeDay);
}

function currentWord() {
  const words = currentWords();
  return words[clamp(state.cardIndex, 0, words.length - 1)];
}

function getStatus(wordId) {
  return state.statuses[wordId] || "new";
}

function setStatus(wordId, status) {
  if (status === "new") {
    delete state.statuses[wordId];
  } else {
    state.statuses[wordId] = status;
  }
  saveState();
}

function statusText(status) {
  if (status === "known") return "已掌握";
  if (status === "again") return "再练";
  return "未学";
}

function setTab(nextTab) {
  activeTab = nextTab;
  els.tabs.forEach((tab) => {
    const active = tab.dataset.tab === nextTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  Object.entries(els.panels).forEach(([name, panel]) => {
    panel.classList.toggle("active", name === nextTab);
  });
}

function renderStats() {
  const statusValues = Object.values(state.statuses);
  els.totalWords.textContent = String(WORDS.length);
  els.knownWords.textContent = String(statusValues.filter((s) => s === "known").length);
  els.reviewWords.textContent = String(statusValues.filter((s) => s === "again").length);
}

function renderDayHeader() {
  const words = currentWords();
  const first = words[0]?.id || 0;
  const last = words[words.length - 1]?.id || 0;
  const done = words.filter((word) => getStatus(word.id) === "known").length;
  const pct = words.length ? (done / words.length) * 100 : 0;
  els.dayTitle.textContent = `第 ${state.activeDay} / ${TOTAL_DAYS} 天`;
  els.dayRange.textContent = `${first}-${last}`;
  els.dayProgress.style.width = `${pct}%`;
  els.prevDayButton.disabled = state.activeDay === 1;
  els.nextDayButton.disabled = state.activeDay === TOTAL_DAYS;
}

function renderCard() {
  const words = currentWords();
  const word = currentWord();
  if (!word) return;

  const status = getStatus(word.id);
  els.cardPosition.textContent = `${state.cardIndex + 1} / ${words.length}`;
  els.statusPill.textContent = statusText(status);
  els.statusPill.className = `status-pill ${status === "known" ? "known" : ""} ${
    status === "again" ? "again" : ""
  }`;
  els.wordId.textContent = `#${word.id}`;
  els.wordText.textContent = word.word;
  els.ipaText.textContent = word.ipa;
  els.meaningText.textContent = meaningVisible ? word.zh : "中文已隐藏";
  els.meaningText.classList.toggle("hidden", !meaningVisible);
  els.toggleMeaningButton.textContent = meaningVisible ? "隐藏中文" : "显示中文";
  els.noteInput.value = state.notes[word.id] || "";
  els.prevCardButton.disabled = state.cardIndex === 0;
  els.nextCardButton.disabled = state.cardIndex >= words.length - 1;
}

function wordRow(word, options = {}) {
  const status = getStatus(word.id);
  const note = state.notes[word.id];
  const isActive = currentWord()?.id === word.id && activeTab === "today";
  const meaning = note ? `${word.zh} · ${note}` : word.zh;
  const statusIcon = status === "known" ? "✓" : status === "again" ? "!" : "·";
  const compact = options.compact ? " compact-row" : "";
  return `
    <div class="word-row${isActive ? " active" : ""}${compact}" data-id="${word.id}" tabindex="0">
      <div class="row-main">
        <strong>${escapeHtml(word.word)}</strong>
        <span>#${word.id} ${escapeHtml(word.ipa)} · ${escapeHtml(meaning)}</span>
      </div>
      <div class="row-actions">
        <button class="mini-button" type="button" data-action="play" data-id="${word.id}" aria-label="发音 ${escapeHtml(word.word)}">▶</button>
        <button class="mini-button ${status}" type="button" data-action="toggle-status" data-id="${word.id}" aria-label="${statusText(status)}">${statusIcon}</button>
      </div>
    </div>`;
}

function renderDailyList() {
  els.dailyList.innerHTML = currentWords().map((word) => wordRow(word)).join("");
}

function renderReviewList() {
  const review = WORDS.filter((word) => getStatus(word.id) === "again");
  if (!review.length) {
    els.reviewList.innerHTML = `<div class="empty-state">暂无再练词</div>`;
    return;
  }
  els.reviewList.innerHTML = review.map((word) => wordRow(word, { compact: true })).join("");
}

function renderLibraryList() {
  const query = normalize(els.searchInput.value);
  const list = WORDS.filter((word) => {
    if (!query) return true;
    const note = state.notes[word.id] || "";
    return normalize(`${word.word} ${word.ipa} ${word.zh} ${note}`).includes(query);
  });
  if (!list.length) {
    els.libraryList.innerHTML = `<div class="empty-state">没有匹配词</div>`;
    return;
  }
  els.libraryList.innerHTML = list.map((word) => wordRow(word, { compact: true })).join("");
}

function renderSettings() {
  els.autoSpeakInput.checked = Boolean(state.settings.autoSpeak);
  els.hideMeaningInput.checked = Boolean(state.settings.hideMeaning);
  els.rateInput.value = String(state.settings.rate);
}

function renderAll() {
  renderStats();
  renderDayHeader();
  renderCard();
  renderDailyList();
  renderReviewList();
  renderLibraryList();
  renderSettings();
}

function selectWord(wordId, shouldSpeak = false) {
  const index = WORDS.findIndex((word) => word.id === wordId);
  if (index < 0) return;
  state.activeDay = Math.floor(index / DAY_SIZE) + 1;
  state.cardIndex = index % DAY_SIZE;
  meaningVisible = !state.settings.hideMeaning;
  setTab("today");
  saveState();
  renderAll();
  if (shouldSpeak) speakWord(WORDS[index].word);
}

function moveCard(delta) {
  const words = currentWords();
  state.cardIndex = clamp(state.cardIndex + delta, 0, words.length - 1);
  meaningVisible = !state.settings.hideMeaning;
  saveState();
  renderAll();
  if (state.settings.autoSpeak) speakWord(currentWord().word);
}

function changeDay(delta) {
  state.activeDay = clamp(state.activeDay + delta, 1, TOTAL_DAYS);
  state.cardIndex = 0;
  meaningVisible = !state.settings.hideMeaning;
  saveState();
  renderAll();
  if (state.settings.autoSpeak) speakWord(currentWord().word);
}

function markCurrent(status) {
  const word = currentWord();
  if (!word) return;
  setStatus(word.id, status);
  renderAll();
  if (state.cardIndex < currentWords().length - 1) {
    moveCard(1);
  }
}

function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  voices = window.speechSynthesis.getVoices();
}

function chooseVoice() {
  return (
    voices.find((voice) => voice.lang === "en-US") ||
    voices.find((voice) => voice.lang.startsWith("en-")) ||
    null
  );
}

function speakWord(text) {
  if (!("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) {
    window.alert("当前浏览器不支持发音。");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = Number(state.settings.rate) || 0.85;
  utterance.pitch = 1;
  const voice = chooseVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function playDay() {
  if (!("speechSynthesis" in window)) {
    window.alert("当前浏览器不支持发音。");
    return;
  }
  if (readingQueueActive) {
    window.speechSynthesis.cancel();
    readingQueueActive = false;
    els.playDayButton.textContent = "顺读";
    return;
  }
  window.speechSynthesis.cancel();
  readingQueueActive = true;
  els.playDayButton.textContent = "停止";
  const words = currentWords();
  words.forEach((word, index) => {
    const utterance = new SpeechSynthesisUtterance(word.word);
    utterance.lang = "en-US";
    utterance.rate = Number(state.settings.rate) || 0.85;
    const voice = chooseVoice();
    if (voice) utterance.voice = voice;
    if (index === words.length - 1) {
      utterance.onend = () => {
        readingQueueActive = false;
        els.playDayButton.textContent = "顺读";
      };
    }
    window.speechSynthesis.speak(utterance);
  });
}

function updateNote() {
  const word = currentWord();
  if (!word) return;
  const value = els.noteInput.value.trim();
  if (value) {
    state.notes[word.id] = value;
  } else {
    delete state.notes[word.id];
  }
  saveState();
}

function handleListClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const id = Number(actionButton.dataset.id);
    const word = WORDS.find((item) => item.id === id);
    if (!word) return;
    event.stopPropagation();
    if (actionButton.dataset.action === "play") {
      speakWord(word.word);
    }
    if (actionButton.dataset.action === "toggle-status") {
      const status = getStatus(id);
      const next = status === "known" ? "again" : status === "again" ? "new" : "known";
      setStatus(id, next);
      renderAll();
    }
    return;
  }

  const row = event.target.closest(".word-row");
  if (row) selectWord(Number(row.dataset.id), false);
}

function handleListKey(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest(".word-row");
  if (!row) return;
  event.preventDefault();
  selectWord(Number(row.dataset.id), false);
}

function normalize(value) {
  return String(value).trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function exportState() {
  const payload = {
    app: "nation-1k-word-card",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nation-1k-backup-${todayKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importState(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result));
      const nextState = payload.state || payload;
      state = {
        ...defaultState(),
        ...nextState,
        statuses: nextState.statuses || {},
        notes: nextState.notes || {},
        settings: { ...defaultState().settings, ...(nextState.settings || {}) },
      };
      state.activeDay = clamp(state.activeDay || dayFromStart(state.startDate), 1, TOTAL_DAYS);
      state.cardIndex = clamp(state.cardIndex || 0, 0, currentWords().length - 1);
      meaningVisible = !state.settings.hideMeaning;
      saveState();
      renderAll();
      closeSettings();
    } catch {
      window.alert("导入文件无法读取。");
    }
  };
  reader.readAsText(file);
}

function openSettings() {
  renderSettings();
  els.settingsModal.hidden = false;
}

function closeSettings() {
  els.settingsModal.hidden = true;
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
  });
  els.prevDayButton.addEventListener("click", () => changeDay(-1));
  els.nextDayButton.addEventListener("click", () => changeDay(1));
  els.prevCardButton.addEventListener("click", () => moveCard(-1));
  els.nextCardButton.addEventListener("click", () => moveCard(1));
  els.toggleMeaningButton.addEventListener("click", () => {
    meaningVisible = !meaningVisible;
    renderCard();
  });
  els.speakButton.addEventListener("click", () => speakWord(currentWord().word));
  els.playDayButton.addEventListener("click", playDay);
  els.againButton.addEventListener("click", () => markCurrent("again"));
  els.knownButton.addEventListener("click", () => markCurrent("known"));
  els.noteInput.addEventListener("input", updateNote);
  els.dailyList.addEventListener("click", handleListClick);
  els.reviewList.addEventListener("click", handleListClick);
  els.libraryList.addEventListener("click", handleListClick);
  els.dailyList.addEventListener("keydown", handleListKey);
  els.reviewList.addEventListener("keydown", handleListKey);
  els.libraryList.addEventListener("keydown", handleListKey);
  els.searchInput.addEventListener("input", renderLibraryList);
  els.clearReviewButton.addEventListener("click", () => {
    Object.entries(state.statuses).forEach(([id, status]) => {
      if (status === "again") delete state.statuses[id];
    });
    saveState();
    renderAll();
  });
  els.settingsButton.addEventListener("click", openSettings);
  els.closeSettingsButton.addEventListener("click", closeSettings);
  els.settingsModal.addEventListener("click", (event) => {
    if (event.target === els.settingsModal) closeSettings();
  });
  els.autoSpeakInput.addEventListener("change", () => {
    state.settings.autoSpeak = els.autoSpeakInput.checked;
    saveState();
  });
  els.hideMeaningInput.addEventListener("change", () => {
    state.settings.hideMeaning = els.hideMeaningInput.checked;
    meaningVisible = !state.settings.hideMeaning;
    saveState();
    renderCard();
  });
  els.rateInput.addEventListener("input", () => {
    state.settings.rate = Number(els.rateInput.value);
    saveState();
  });
  els.resetStartButton.addEventListener("click", () => {
    state.startDate = todayKey();
    state.activeDay = 1;
    state.cardIndex = 0;
    meaningVisible = !state.settings.hideMeaning;
    saveState();
    renderAll();
    closeSettings();
  });
  els.exportButton.addEventListener("click", exportState);
  els.importInput.addEventListener("change", () => {
    const file = els.importInput.files?.[0];
    if (file) importState(file);
    els.importInput.value = "";
  });
}

function boot() {
  meaningVisible = !state.settings.hideMeaning;
  bindEvents();
  loadVoices();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  renderAll();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
