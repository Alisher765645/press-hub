/* ============================================================
   PRESS HUB — прототип единого центра пресс-службы
   Vanilla JS, localStorage, HTML5 Canvas
   ============================================================ */

// ---------- Справочники ----------
const COMPANIES = [
  "КазМунайГаз Разведка", "Тенгизшевройл", "Карачаганак Петролеум", "КМГ Переработка",
  "Атырауский НПЗ", "ПКОП", "КазТрансОйл", "КазТрансГаз", "КМГ Сервис", "Казгермунай",
  "Жаикмунай", "Каражанбасмунай", "Урихтау Оперейтинг", "КМГ Кашаган", "Актобемунайгаз",
  "Мангистаумунайгаз", "Эмбамунайгаз", "Озенмунайгаз", "КМГ Логистика", "КМГ Инжиниринг",
  "CNPC Актобе", "Тургай Петролеум", "Казнефтегаз Маркетинг", "КМГ Корпоративный центр"
];

const TYPES = {
  pr:       { label: "Пресс-релиз",            color: "#3b82f6" },
  report:   { label: "Отчёт / Аналитика",      color: "#22c55e" },
  media:    { label: "Медиазапрос",            color: "#f97316" },
  social:   { label: "Соцсети",                color: "#a855f7" },
  briefing: { label: "Брифинг / Конференция",  color: "#ef4444" }
};

const MODES = {
  summary:   "Выжимка",
  analytics: "Аналитика",
  release:   "Пресс-релиз",
  plan:      "Контент-план",
  infographic: "Инфографика"
};

const PRIORITY = { high: "Высокий", normal: "Обычный", low: "Низкий" };

// ---------- Хранилище ----------
const DB = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem("presshub_" + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem("presshub_" + key, JSON.stringify(val)); }
};

let events = DB.get("events", seedEvents());
let archive = DB.get("archive", seedArchive());
let settings = DB.get("settings", { proxy: "", key: "", model: "claude-sonnet-4-6" });
let hiddenCompanies = new Set(DB.get("hidden", []));

let current = new Date();
current.setDate(1);
let aiMode = "summary";

// ---------- Сиды (демо-данные) ----------
function uid() { return Math.random().toString(36).slice(2, 10); }
function iso(d) { return d.toISOString().slice(0, 10); }

function seedEvents() {
  const now = new Date();
  const mk = (offset, title, type, companyIdx, priority) => ({
    id: uid(),
    title, type, priority: priority || "normal",
    companyIdx,
    date: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)),
    description: ""
  });
  return [
    mk(1, "Пресс-релиз: итоги добычи Q2", "pr", 1, "high"),
    mk(2, "Брифинг по экологической программе", "briefing", 4, "high"),
    mk(3, "Пост в соцсети: День нефтяника", "social", 7, "normal"),
    mk(5, "Аналитический отчёт по переработке", "report", 3, "normal"),
    mk(6, "Ответ на медиазапрос РБК", "media", 0, "high"),
    mk(8, "Пресс-релиз: новый контракт", "pr", 14, "normal"),
    mk(10, "Брифинг руководителя", "briefing", 23, "high"),
    mk(12, "Соцсети: производственные показатели", "social", 16, "low")
  ];
}

function seedArchive() {
  const now = new Date();
  return [
    {
      id: uid(), title: "Итоги добычи за первый квартал 2026",
      type: "pr", companyIdx: 1, date: iso(now),
      text: "Компания сообщает о росте добычи на 4,2% по сравнению с аналогичным периодом прошлого года. Объём добычи составил 6,8 млн тонн нефти. Инвестиции в модернизацию — 12 млрд тенге.",
      tags: ["добыча", "Q1", "результаты"]
    },
    {
      id: uid(), title: "Запуск экологической программы «Чистый воздух»",
      type: "briefing", companyIdx: 4, date: iso(now),
      text: "На брифинге представлена пятилетняя экологическая программа стоимостью 30 млрд тенге, направленная на снижение выбросов на 18% к 2030 году.",
      tags: ["экология", "программа"]
    }
  ];
}

// ---------- Утилиты ----------
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.hidden = true), 2200);
}

function persist() {
  DB.set("events", events);
  DB.set("archive", archive);
  DB.set("hidden", Array.from(hiddenCompanies));
}

function fmtDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

// ============================================================
//  НАВИГАЦИЯ ПО ВКЛАДКАМ
// ============================================================
$("#tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  $$(".tab").forEach((t) => t.classList.toggle("active", t === btn));
  const tab = btn.dataset.tab;
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + tab));
});

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ СЕЛЕКТОВ
// ============================================================
function fillCompanySelect(sel, { all = false, allLabel = "Все предприятия" } = {}) {
  sel.innerHTML = "";
  if (all) sel.append(new Option(allLabel, ""));
  COMPANIES.forEach((c, i) => sel.append(new Option(c, i)));
}
function fillTypeSelect(sel, { all = false } = {}) {
  sel.innerHTML = "";
  if (all) sel.append(new Option("Все типы", ""));
  Object.entries(TYPES).forEach(([k, v]) => sel.append(new Option(v.label, k)));
}

function initSelects() {
  fillCompanySelect($("#filterCompany"), { all: true });
  fillTypeSelect($("#filterType"), { all: true });
  fillCompanySelect($("#evCompany"));
  fillTypeSelect($("#evType"));
  fillCompanySelect($("#amCompany"));
  fillTypeSelect($("#amType"));
  fillCompanySelect($("#archiveFilterCompany"), { all: true });
  fillTypeSelect($("#archiveFilterType"), { all: true });
  fillCompanySelect($("#aiCompany"), { all: true, allLabel: "Без контекста" });
}

// ============================================================
//  КОНТЕНТ-ПЛАН (КАЛЕНДАРЬ)
// ============================================================
const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function visibleEvents() {
  const fc = $("#filterCompany").value;
  const ft = $("#filterType").value;
  return events.filter((ev) => {
    if (hiddenCompanies.has(ev.companyIdx)) return false;
    if (fc !== "" && String(ev.companyIdx) !== fc) return false;
    if (ft !== "" && ev.type !== ft) return false;
    return true;
  });
}

function renderCalendar() {
  $("#monthLabel").textContent = `${MONTHS[current.getMonth()]} ${current.getFullYear()}`;
  const grid = $("#calGrid");
  grid.innerHTML = "";

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  // понедельник = 0
  let startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = iso(new Date());

  const evList = visibleEvents();

  for (let i = 0; i < startOffset; i++) {
    const cell = document.createElement("div");
    cell.className = "cal-cell empty";
    grid.append(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cellIso = iso(new Date(year, month, day));
    const cell = document.createElement("div");
    cell.className = "cal-cell" + (cellIso === todayIso ? " today" : "");
    cell.innerHTML = `<div class="daynum">${day}</div>`;

    evList.filter((ev) => ev.date === cellIso).forEach((ev) => {
      const chip = document.createElement("div");
      chip.className = "ev-chip " + ev.type;
      chip.textContent = (ev.priority === "high" ? "🔴 " : "") + ev.title;
      chip.title = `${ev.title} — ${COMPANIES[ev.companyIdx]}`;
      cell.append(chip);
    });

    cell.addEventListener("click", () => openEventModal(cellIso));
    grid.append(cell);
  }
}

function renderUpcoming() {
  const list = $("#upcoming");
  const todayIso = iso(new Date());
  const upcoming = visibleEvents()
    .filter((ev) => ev.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);
  list.innerHTML = upcoming.length
    ? ""
    : '<li class="muted">Нет предстоящих событий</li>';
  upcoming.forEach((ev) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="u-date">${fmtDate(ev.date)}</span>
      <span class="u-title">${ev.priority === "high" ? "🔴 " : ""}${ev.title}</span>`;
    list.append(li);
  });
}

function renderCompanyToggles() {
  const box = $("#companyToggles");
  box.innerHTML = "";
  COMPANIES.forEach((c, i) => {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !hiddenCompanies.has(i);
    cb.addEventListener("change", () => {
      if (cb.checked) hiddenCompanies.delete(i);
      else hiddenCompanies.add(i);
      persist();
      renderCalendar();
      renderUpcoming();
    });
    label.append(cb, document.createTextNode(c));
    box.append(label);
  });
}

function renderLegend() {
  const ul = $("#legend");
  ul.innerHTML = "";
  Object.values(TYPES).forEach((t) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot" style="background:${t.color}"></span>${t.label}`;
    ul.append(li);
  });
}

function renderStats() {
  const monthPrefix = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
  const inMonth = events.filter((ev) => ev.date.startsWith(monthPrefix)).length;
  const stats = [
    { num: events.length, lbl: "Всего событий" },
    { num: inMonth, lbl: "В этом месяце" },
    { num: archive.length, lbl: "Материалов в архиве" },
    { num: COMPANIES.length, lbl: "Предприятий" }
  ];
  $("#stats").innerHTML = stats
    .map((s) => `<div class="stat"><div class="num">${s.num}</div><div class="lbl">${s.lbl}</div></div>`)
    .join("");
}

function renderCalendarView() {
  renderStats();
  renderCalendar();
  renderUpcoming();
}

$("#prevMonth").addEventListener("click", () => { current.setMonth(current.getMonth() - 1); renderCalendarView(); });
$("#nextMonth").addEventListener("click", () => { current.setMonth(current.getMonth() + 1); renderCalendarView(); });
$("#filterCompany").addEventListener("change", () => { renderCalendar(); renderUpcoming(); });
$("#filterType").addEventListener("change", () => { renderCalendar(); renderUpcoming(); });

// ---------- Модальное окно события ----------
function openEventModal(dateIso) {
  $("#evTitle").value = "";
  $("#evDate").value = dateIso || iso(new Date());
  $("#evDesc").value = "";
  $("#evPriority").value = "normal";
  $("#evType").value = "pr";
  $("#evCompany").value = "0";
  showModal("modalEvent");
}
$("#addEventBtn").addEventListener("click", () => openEventModal());
$("#saveEvent").addEventListener("click", () => {
  const title = $("#evTitle").value.trim();
  if (!title) { toast("Укажите название события"); return; }
  events.push({
    id: uid(), title,
    date: $("#evDate").value,
    type: $("#evType").value,
    companyIdx: Number($("#evCompany").value),
    priority: $("#evPriority").value,
    description: $("#evDesc").value.trim()
  });
  persist();
  renderCalendarView();
  hideModal();
  toast("Событие добавлено");
});

// ============================================================
//  АРХИВ МАТЕРИАЛОВ
// ============================================================
function renderArchive() {
  const q = $("#archiveSearch").value.trim().toLowerCase();
  const ft = $("#archiveFilterType").value;
  const fc = $("#archiveFilterCompany").value;

  const grid = $("#archiveGrid");
  const filtered = archive.filter((m) => {
    if (ft !== "" && m.type !== ft) return false;
    if (fc !== "" && String(m.companyIdx) !== fc) return false;
    if (q) {
      const hay = (m.title + " " + m.text + " " + COMPANIES[m.companyIdx] + " " + (m.tags || []).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  grid.innerHTML = filtered.length ? "" : '<p class="muted">Ничего не найдено.</p>';
  filtered.forEach((m) => {
    const t = TYPES[m.type];
    const card = document.createElement("div");
    card.className = "mat-card";
    card.innerHTML = `
      <span class="type-badge" style="background:${t.color}">${t.label}</span>
      <h4>${m.title}</h4>
      <div class="preview">${m.text.slice(0, 140)}…</div>
      <div>${(m.tags || []).map((tg) => `<span class="tag">${tg}</span>`).join("")}</div>
      <div class="foot"><span>${COMPANIES[m.companyIdx]}</span><span>${fmtDate(m.date)}</span></div>`;
    card.addEventListener("click", () => openMaterial(m.id));
    grid.append(card);
  });
}

function openMaterial(id) {
  const m = archive.find((x) => x.id === id);
  if (!m) return;
  $("#matTitle").textContent = m.title;
  $("#matMeta").innerHTML =
    `${TYPES[m.type].label} · ${COMPANIES[m.companyIdx]} · ${fmtDate(m.date)}<br>` +
    (m.tags || []).map((tg) => `<span class="tag">${tg}</span>`).join("");
  $("#matText").textContent = m.text;
  $("#matToAi").onclick = () => {
    $("#aiInput").value = m.text;
    $("#aiCompany").value = String(m.companyIdx);
    hideModal();
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "ai"));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-ai"));
    toast("Текст передан в ИИ-ассистент");
  };
  showModal("modalMaterial");
}

["#archiveSearch", "#archiveFilterType", "#archiveFilterCompany"].forEach((s) =>
  $(s).addEventListener("input", renderArchive)
);

$("#addMaterialBtn").addEventListener("click", () => {
  $("#amTitle").value = "";
  $("#amText").value = "";
  $("#amTags").value = "";
  $("#amDate").value = iso(new Date());
  $("#amType").value = "pr";
  $("#amCompany").value = "0";
  showModal("modalAddMaterial");
});
$("#saveMaterial").addEventListener("click", () => {
  const title = $("#amTitle").value.trim();
  const text = $("#amText").value.trim();
  if (!title || !text) { toast("Заполните заголовок и текст"); return; }
  archive.unshift({
    id: uid(), title, text,
    type: $("#amType").value,
    companyIdx: Number($("#amCompany").value),
    date: $("#amDate").value,
    tags: $("#amTags").value.split(",").map((s) => s.trim()).filter(Boolean)
  });
  persist();
  renderArchive();
  renderStats();
  hideModal();
  toast("Материал добавлен в архив");
});

// ============================================================
//  ИИ-АССИСТЕНТ
// ============================================================
function renderModes() {
  const grid = $("#modeGrid");
  grid.innerHTML = "";
  Object.entries(MODES).forEach(([k, label]) => {
    const btn = document.createElement("button");
    btn.className = "mode-btn" + (k === aiMode ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      aiMode = k;
      $$(".mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
    grid.append(btn);
  });
}

// Загрузка файлов
$("#aiFiles").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const progress = $("#aiProgress");
  const bar = progress.querySelector(".progress-bar");
  progress.hidden = false;
  let combined = $("#aiInput").value;
  for (let i = 0; i < files.length; i++) {
    bar.style.width = `${Math.round(((i + 1) / files.length) * 100)}%`;
    const text = await files[i].text();
    combined += (combined ? "\n\n" : "") + `# ${files[i].name}\n` + text;
  }
  $("#aiInput").value = combined;
  setTimeout(() => { progress.hidden = true; bar.style.width = "0"; }, 400);
  toast(`Загружено файлов: ${files.length}`);
});

const PROMPTS = {
  summary: "Сделай структурированную выжимку из текста: ключевые факты, цифры и необходимые действия. Используй маркированные списки.",
  analytics: "Проведи аналитику текста: тренды, риски, возможности и коммуникационная оценка. Структурируй по разделам.",
  release: "Напиши готовый пресс-релиз на основе данных: заголовок, лид-абзац, основной текст и цитата руководителя.",
  plan: "Предложи контент-план на месяц на основе данных: для каждого пункта укажи дату, тип материала и ответственного.",
  infographic: "Извлеки из текста 5-7 ключевых числовых показателей. Ответь ТОЛЬКО валидным JSON-массивом вида [{\"label\":\"...\",\"value\":\"...\"}], без пояснений."
};

$("#aiRun").addEventListener("click", runAI);

async function runAI() {
  const input = $("#aiInput").value.trim();
  if (!input) { toast("Добавьте текст для обработки"); return; }

  const result = $("#aiResult");
  const canvas = $("#aiCanvas");
  const actions = $("#aiOutActions");
  canvas.hidden = true;
  $("#aiDownloadPng").hidden = true;
  actions.hidden = true;
  result.classList.add("loading");
  result.textContent = "Обработка запроса…";

  const company = $("#aiCompany").value;
  const ctx = company !== "" ? `\n\nКонтекст: предприятие «${COMPANIES[company]}».` : "";
  const userMsg = PROMPTS[aiMode] + ctx + "\n\nТЕКСТ:\n" + input;

  try {
    const text = await callClaude(userMsg);
    result.classList.remove("loading");

    if (aiMode === "infographic") {
      const metrics = parseMetrics(text);
      drawInfographic(metrics, company !== "" ? COMPANIES[company] : "PRESS HUB");
      result.textContent = "Инфографика сгенерирована. Можно скачать PNG.";
      canvas.hidden = false;
      $("#aiDownloadPng").hidden = false;
    } else {
      result.textContent = text;
    }
    actions.hidden = false;
    $("#aiResult")._raw = text;
  } catch (err) {
    result.classList.remove("loading");
    result.innerHTML = `<p class="muted">Не удалось выполнить запрос к ИИ.</p>
      <p class="muted small">${err.message}</p>
      <p class="muted small">Откройте ⚙ Настройки и укажите прокси или API-ключ Anthropic.</p>`;
  }
}

async function callClaude(userMessage) {
  const model = settings.model || "claude-sonnet-4-6";
  const body = {
    model,
    max_tokens: 1500,
    messages: [{ role: "user", content: userMessage }]
  };

  // Вариант 1: прокси (рекомендуется — ключ не в браузере)
  if (settings.proxy) {
    const r = await fetch(settings.proxy, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error("Прокси вернул статус " + r.status);
    const data = await r.json();
    return extractText(data);
  }

  // Вариант 2: прямой доступ из браузера (только для прототипа/обучения)
  if (settings.key) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error("API вернул статус " + r.status);
    const data = await r.json();
    return extractText(data);
  }

  throw new Error("ИИ не настроен: нет прокси и API-ключа.");
}

function extractText(data) {
  if (data && Array.isArray(data.content)) {
    return data.content.map((b) => b.text || "").join("\n").trim();
  }
  return JSON.stringify(data);
}

function parseMetrics(text) {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(match ? match[0] : text);
    return arr.slice(0, 6);
  } catch {
    return [{ label: "Результат", value: "—" }];
  }
}

// ---------- Canvas-инфографика ----------
function drawInfographic(metrics, title) {
  const canvas = $("#aiCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const accents = ["#ffb627", "#4f9bff", "#2ee06a", "#c06bff", "#ff8c2b", "#ff5a5a"];

  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffb627";
  ctx.font = "bold 40px 'Inter', sans-serif";
  ctx.fillText(title, 50, 70);
  ctx.fillStyle = "#8a8a92";
  ctx.font = "18px 'Inter', sans-serif";
  ctx.fillText("Ключевые показатели · PRESS HUB", 50, 100);

  const cols = 3, rows = 2;
  const padX = 50, padTop = 140, gap = 24;
  const cardW = (W - padX * 2 - gap * (cols - 1)) / cols;
  const cardH = (H - padTop - 50 - gap * (rows - 1)) / rows;

  metrics.forEach((m, i) => {
    const cx = padX + (i % cols) * (cardW + gap);
    const cy = padTop + Math.floor(i / cols) * (cardH + gap);
    const accent = accents[i % accents.length];

    ctx.fillStyle = "#141416";
    roundRect(ctx, cx, cy, cardW, cardH, 14);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(cx, cy, 6, cardH);

    ctx.fillStyle = accent;
    ctx.font = "bold 42px 'Inter', sans-serif";
    ctx.fillText(String(m.value).slice(0, 14), cx + 24, cy + cardH / 2);

    ctx.fillStyle = "#f2f2f3";
    ctx.font = "16px 'Inter', sans-serif";
    wrapText(ctx, String(m.label), cx + 24, cy + cardH / 2 + 32, cardW - 40, 20);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line + w + " ";
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w + " ";
      y += lh;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}

// ---------- Действия с результатом ----------
$("#aiCopy").addEventListener("click", () => {
  navigator.clipboard.writeText($("#aiResult")._raw || $("#aiResult").textContent);
  toast("Скопировано в буфер");
});
$("#aiDownloadPng").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "presshub-infographic.png";
  link.href = $("#aiCanvas").toDataURL("image/png");
  link.click();
});
$("#aiSave").addEventListener("click", () => {
  const raw = $("#aiResult")._raw;
  if (!raw) return;
  const company = $("#aiCompany").value;
  archive.unshift({
    id: uid(),
    title: `ИИ: ${MODES[aiMode]} — ${fmtDate(iso(new Date()))}`,
    text: raw,
    type: aiMode === "release" ? "pr" : "report",
    companyIdx: company !== "" ? Number(company) : 0,
    date: iso(new Date()),
    tags: ["ИИ", MODES[aiMode].toLowerCase()]
  });
  persist();
  renderArchive();
  renderStats();
  toast("Результат сохранён в архив");
});

// ============================================================
//  НАСТРОЙКИ
// ============================================================
$("#settingsBtn").addEventListener("click", () => {
  $("#setProxy").value = settings.proxy;
  $("#setKey").value = settings.key;
  $("#setModel").value = settings.model;
  showModal("modalSettings");
});
$("#saveSettings").addEventListener("click", () => {
  settings = {
    proxy: $("#setProxy").value.trim(),
    key: $("#setKey").value.trim(),
    model: $("#setModel").value.trim() || "claude-sonnet-4-6"
  };
  DB.set("settings", settings);
  hideModal();
  toast("Настройки сохранены");
});

// ============================================================
//  МОДАЛЬНЫЕ ОКНА — общая логика
// ============================================================
function showModal(id) {
  $("#modalBackdrop").hidden = false;
  $$("#modalBackdrop .modal").forEach((m) => (m.hidden = m.id !== id));
}
function hideModal() {
  $("#modalBackdrop").hidden = true;
}
$("#modalBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "modalBackdrop" || e.target.hasAttribute("data-close")) hideModal();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideModal(); });

// ============================================================
//  СТАРТ
// ============================================================
initSelects();
renderModes();
renderCompanyToggles();
renderLegend();
renderCalendarView();
renderArchive();
