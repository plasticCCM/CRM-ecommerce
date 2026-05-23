const state = {
  analysis: null,
  filters: {
    gender: "all",
    region: "all",
    ageMin: 0,
    ageMax: 0,
    ordersMin: 0,
    ordersMax: 0,
    checkMin: 0,
    checkMax: 0,
    registeredFrom: "",
    registeredTo: ""
  },
  errors: [],
  toast: null,
  loading: false,
  calendarMonth: {
    registeredFrom: "",
    registeredTo: ""
  }
};

const emptyAnalysis = {
  total: 0,
  sourceTotal: 0,
  regions: [],
  kpis: {
    avgRevenue: 0,
    avgExpense: 0,
    medianRevenue: 0,
    modeRevenue: 0,
    avgOrders: 0,
    medianOrders: 0,
    modeOrders: 0,
    avgAge: 0
  },
  registrationRange: { from: "", to: "" },
  gender: [],
  ageGroups: [
    { name: "18-24", count: 0, percent: 0 },
    { name: "25-34", count: 0, percent: 0 },
    { name: "35-44", count: 0, percent: 0 },
    { name: "45-54", count: 0, percent: 0 },
    { name: "55+", count: 0, percent: 0 }
  ],
  regionsDistribution: [],
  registrationsByMonth: [],
  segments: { vip: 0, newClients: 0, active: 0, inactive: 0 }
};

const fmt = new Intl.NumberFormat("ru-RU");
const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
let regionMapInstance = null;
let outsideSelectHandlerBound = false;
const monthNames = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

const regionPoints = {
  "Москва": [55.7558, 37.6173],
  "Санкт-Петербург": [59.9343, 30.3351],
  "Новосибирск": [55.0084, 82.9357],
  "Екатеринбург": [56.8389, 60.6057],
  "Казань": [55.7961, 49.1064],
  "Нижний Новгород": [56.2965, 43.9361],
  "Краснодар": [45.0355, 38.9753],
  "Самара": [53.1959, 50.1008],
  "Ростов-на-Дону": [47.2357, 39.7015],
  "Московская область": [55.5043, 38.0354],
  "Нижегородская область": [56.2965, 43.9361],
  "Краснодарский край": [45.0355, 38.9753],
  "Свердловская область": [56.8389, 60.6057],
  "Татарстан": [55.7961, 49.1064],
  "Новосибирская область": [55.0084, 82.9357],
  "Самарская область": [53.1959, 50.1008],
  "Ростовская область": [47.2357, 39.7015]
};

function getRegionPoint(name) {
  if (regionPoints[name]) return regionPoints[name];
  const normalized = name.toLowerCase();
  return Object.entries(regionPoints).find(([key]) => {
    const pointName = key.toLowerCase();
    return normalized.includes(pointName) || pointName.includes(normalized);
  })?.[1];
}

function icon(name, size = 18) {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
}

function notify(type, title, text = "") {
  state.toast = { type, title, text };
  render();
  window.setTimeout(() => {
    state.toast = null;
    render();
  }, 4600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw payload;
  return payload;
}

function round(value, digits = 1) {
  return Number(value || 0).toFixed(digits).replace(".", ",");
}

function formatMonth(month) {
  const [year, monthNumber] = month.split("-");
  return `${monthNames[Number(monthNumber) - 1]} ${year}`;
}

function shortMonth(month) {
  const [year, monthNumber] = month.split("-");
  return `${monthNames[Number(monthNumber) - 1].slice(0, 3)} ${year.slice(2)}`;
}

function monthsBetween(from, to) {
  if (!from || !to) return 0;
  const start = new Date(`${from.slice(0, 7)}-01T00:00:00`);
  const end = new Date(`${to.slice(0, 7)}-01T00:00:00`);
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

function kpiCard(label, value, hint, iconName) {
  return `
    <article class="card kpi">
      <div class="kpi__head">
        <span>${label}</span>
        <span class="icon-badge">${icon(iconName)}</span>
      </div>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `;
}

function emptyState(text = "По выбранным фильтрам данных нет", modifier = "") {
  return `
    <div class="empty-state ${modifier}">
      ${icon("search-x", 26)}
      <b>Данных нет</b>
      <span>${text}</span>
    </div>
  `;
}

function barChart(items) {
  if (!items.some((item) => item.count > 0)) return emptyState();
  const max = Math.max(...items.map((item) => item.count), 1);
  return `
    <div class="bar-chart" role="img" aria-label="Распределение по возрастным группам">
      ${items.map((item) => `
        <button class="bar-chart__item" title="${item.name}: ${item.count} клиентов (${round(item.percent)}%)">
          <span class="bar-chart__bar" style="height:${Math.max(10, (item.count / max) * 100)}%"></span>
          <b>${item.name}</b>
          <small>${round(item.percent)}%</small>
          <span class="chart-tooltip">
            <b>${item.name}</b>
            <small>${fmt.format(item.count)} клиентов</small>
            <small>${round(item.percent)}% от выборки</small>
          </span>
        </button>
      `).join("")}
    </div>
  `;
}

function registrationChart(items) {
  if (!items.length) return emptyState("За выбранный период регистраций не найдено");
  const visible = items.slice(-12);
  const max = Math.max(...visible.map((item) => item.count), 1);
  return `
    <div class="registration-chart" role="img" aria-label="Динамика регистраций клиентов">
      ${visible.map((item) => `
        <button class="registration-chart__item" title="${formatMonth(item.month)}: ${item.count}">
          <span class="registration-chart__bar" style="height:${Math.max(10, (item.count / max) * 100)}%"></span>
          <small>${shortMonth(item.month)}</small>
          <span class="chart-tooltip">
            <b>${fmt.format(item.count)} регистраций</b>
            <small>${formatMonth(item.month)}</small>
          </span>
        </button>
      `).join("")}
    </div>
  `;
}

function pieChart(items) {
  if (!items.length) return emptyState();
  const first = items[0]?.percent || 0;
  const angle = first * 3.6;
  return `
    <div class="pie-layout">
      <div class="pie" style="background:conic-gradient(#737f8d 0deg ${angle}deg, #a6afb9 ${angle}deg 360deg)">
        <span>${round(first, 0)}%</span>
      </div>
      <div class="legend">
        ${items.map((item, index) => `
          <div class="legend__row">
            <span class="dot dot--${index}"></span>
            <span>${item.name}</span>
            <b>${item.count}</b>
            <small>${round(item.percent)}%</small>
            <span class="chart-tooltip chart-tooltip--legend">
              <b>${item.name}</b>
              <small>${fmt.format(item.count)} клиентов</small>
              <small>${round(item.percent)}% от выборки</small>
            </span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function regionMap(items) {
  if (!items.length) return emptyState("По выбранным фильтрам данных нет", "empty-state--map");
  return `
    <div class="map" id="regionMap" data-regions='${JSON.stringify(items)}'>
      <div class="map__label">
        <b>Карта регионов</b>
        <span>Масштабируйте и перемещайте карту</span>
      </div>
    </div>
  `;
}

function statsPanel(k) {
  const items = [
    ["Средний доход", money.format(k.avgRevenue), "На клиента"],
    ["Средний расход", money.format(k.avgExpense), "Средний чек"],
    ["Медиана дохода", money.format(k.medianRevenue), "На клиента"],
    ["Мода дохода", money.format(k.modeRevenue), "Частое значение"]
  ];
  return `
    <section class="stats-card card">
      <div class="card__head">
        <div>
          <h2>Описательная статистика</h2>
          <p>Средние значения, медиана и мода по выбранному сегменту</p>
        </div>
      </div>
      <div class="stats-grid">
        ${items.map(([label, value, hint]) => `
          <article class="stat-item">
            <span>${label}</span>
            <b>${value}</b>
            <small>${hint}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function customSelect(id, value, options) {
  const selected = options.find((option) => option.value === value) || options[0];
  return `
    <div class="custom-select" data-select="${id}">
      <button class="custom-select__trigger" type="button" aria-expanded="false">
        <span>${selected.label}</span>
        ${icon("chevron-down", 16)}
      </button>
      <div class="custom-select__menu">
        ${options.map((option) => `
          <button class="custom-select__option ${option.value === value ? "is-selected" : ""}" type="button" data-value="${option.value}">
            <span>${option.label}</span>
            ${option.value === value ? icon("check", 15) : ""}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function dateField(id, value, placeholder) {
  const display = value || "Выберите дату";
  const month = state.calendarMonth[id] || value || new Date().toISOString().slice(0, 10);
  const calendar = calendarGrid(id, month, value);
  return `
    <div class="date-picker" data-date="${id}">
      <button class="date-picker__trigger" type="button">
        ${icon("calendar-days", 16)}
        <span>${display}</span>
      </button>
      <div class="date-picker__panel">
        ${calendar}
        <div class="date-picker__actions">
          <button type="button" class="date-picker__clear">Очистить</button>
          <button type="button" class="date-picker__today">Сегодня</button>
        </div>
      </div>
    </div>
  `;
}

function calendarGrid(id, monthValue, selectedValue) {
  const base = new Date(`${monthValue.slice(0, 7)}-01T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const startOffset = (base.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const currentMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const isMuted = date.getMonth() !== month;
    const isSelected = iso === selectedValue;
    return `
      <button type="button" class="calendar-day ${isMuted ? "is-muted" : ""} ${isSelected ? "is-selected" : ""}" data-value="${iso}">
        ${date.getDate()}
      </button>
    `;
  }).join("");

  return `
    <div class="calendar" data-current-month="${currentMonth}">
      <div class="calendar__head">
        <button type="button" class="calendar__nav" data-direction="-1">${icon("chevron-left", 16)}</button>
        <b>${monthNames[month]} ${year}</b>
        <button type="button" class="calendar__nav" data-direction="1">${icon("chevron-right", 16)}</button>
      </div>
      <div class="calendar__weekdays">
        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
      </div>
      <div class="calendar__days">${days}</div>
    </div>
  `;
}

function filterPanel(analysis) {
  const f = state.filters;
  const hasAnalysis = Boolean(state.analysis);
  return `
    <aside class="sidebar">
      <section class="panel upload-panel">
        <div class="panel__title">
          <div>
            <h2>Импорт данных</h2>
            <p>Excel-файл с клиентской базой</p>
          </div>
          <span class="pill">${icon("file-spreadsheet", 15)} .xlsx</span>
        </div>
        <label class="dropzone" for="fileInput">
          ${icon("upload-cloud", 34)}
          <b>Загрузить Excel-файл</b>
          <span>возраст, пол, регион, дата регистрации, количество заказов, средний чек</span>
        </label>
        <input id="fileInput" type="file" accept=".xlsx,.xls" />
        <div class="button-row">
          <button class="button" id="downloadTemplate">${icon("download")} Скачать шаблон Excel</button>
        </div>
      </section>

      <section class="panel filters">
        <div class="panel__title">
          <div>
            <h2>Сегментация</h2>
            <p>Выберите параметры сегмента</p>
          </div>
          <button class="link-button" id="clearFilters">Сброс</button>
        </div>
        <label>Регион
          ${customSelect("region", f.region, [{ value: "all", label: "Все регионы" }, ...analysis.regions.map((region) => ({ value: region, label: region }))])}
        </label>
        <label>Пол
          ${customSelect("gender", f.gender, [
            { value: "all", label: "Все" },
            { value: "Женский", label: "Женский" },
            { value: "Мужской", label: "Мужской" }
          ])}
        </label>
        <div class="range-grid">
          <label>Возраст от<input id="ageMin" type="number" value="${f.ageMin}" placeholder="0 = все" /></label>
          <label>до<input id="ageMax" type="number" value="${f.ageMax}" placeholder="0 = все" /></label>
          <label>Заказы от<input id="ordersMin" type="number" value="${f.ordersMin}" placeholder="0 = все" /></label>
          <label>до<input id="ordersMax" type="number" value="${f.ordersMax}" placeholder="0 = все" /></label>
          <label>Чек от<input id="checkMin" type="number" value="${f.checkMin}" placeholder="0 = все" /></label>
          <label>до<input id="checkMax" type="number" value="${f.checkMax}" placeholder="0 = все" /></label>
          <label>Регистрация от${dateField("registeredFrom", f.registeredFrom, "Регистрация от")}</label>
          <label>до${dateField("registeredTo", f.registeredTo, "Регистрация до")}</label>
        </div>
      </section>

      <section class="panel validation">
        <div class="panel__title">
          <div>
            <h2>Контроль качества</h2>
            <p>Статус загруженных данных</p>
          </div>
        </div>
        ${state.errors.length
          ? state.errors.slice(0, 6).map((error) => `<div class="error">${icon("triangle-alert", 16)} ${error}</div>`).join("")
          : hasAnalysis
            ? `<div class="success">${icon("circle-check", 16)} Данные прошли проверку</div>`
            : `<div class="success">${icon("file-spreadsheet", 16)} Загрузите Excel-файл для начала анализа</div>`
        }
      </section>
    </aside>
  `;
}

function table(items) {
  if (!items.length) return emptyState();
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Регион</th>
            <th>Клиенты</th>
            <th>Доля</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr title="${item.name}: ${fmt.format(item.count)} клиентов, ${round(item.percent)}%">
              <td>${item.name}</td>
              <td>${fmt.format(item.count)}</td>
              <td>${round(item.percent)}%</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function dashboard() {
  const hasAnalysis = Boolean(state.analysis);
  const analysis = state.analysis || emptyAnalysis;
  const k = analysis.kpis;
  const registrationPeriod = analysis.registrationRange.from
    ? `${analysis.registrationRange.from} - ${analysis.registrationRange.to}`
    : "нет данных";
  const registrationMonths = monthsBetween(analysis.registrationRange.from, analysis.registrationRange.to);

  return `
    <div class="shell">
      <header class="topbar">
        <div>
          <span class="eyebrow">${icon("user-cog", 15)} Оператор · e-commerce CRM</span>
          <h1>Анализ структуры клиентской базы интернет-магазина</h1>
          <p>Загрузка XLSX, сегментация, описательная статистика и интерактивные визуализации в одном аналитическом рабочем месте.</p>
        </div>
        <div class="topbar__actions">
          <button class="button" id="exportCsv" ${hasAnalysis ? "" : "disabled"}>${icon("file-down")} Экспорт CSV</button>
          <button class="button button--primary" id="refreshAnalysis" ${hasAnalysis ? "" : "disabled"}>${icon("rotate-cw")} Обновить</button>
        </div>
      </header>

      <div class="layout">
        ${filterPanel(analysis)}
        <main class="content">
          <section class="kpi-grid">
            ${kpiCard("Всего клиентов", fmt.format(analysis.total), `из ${fmt.format(analysis.sourceTotal)} записей`, "users")}
            ${kpiCard("Среднее заказов", round(k.avgOrders), `медиана ${round(k.medianOrders, 0)}, мода ${round(k.modeOrders, 0)}`, "shopping-cart")}
            ${kpiCard("Средний возраст", round(k.avgAge), "лет по выбранному сегменту", "activity")}
            ${kpiCard("Период регистрации", registrationPeriod, `${registrationMonths} мес. в выборке`, "calendar-days")}
          </section>

          ${statsPanel(k)}

          <section class="chart-grid chart-grid--top">
            <article class="card chart-card">
              <div class="card__head">
                <div><h2>Возрастные группы</h2><p>Столбчатая диаграмма: проценты и абсолютные значения</p></div>
              </div>
              ${barChart(analysis.ageGroups)}
            </article>
            <article class="card chart-card">
              <div class="card__head">
                <div><h2>Распределение по полу</h2><p>Круговая диаграмма структуры базы</p></div>
              </div>
              ${pieChart(analysis.gender)}
            </article>
          </section>

          <section class="card chart-card chart-card--compact">
            <div class="card__head">
              <div><h2>Регистрации по месяцам</h2><p>Динамика пополнения клиентской базы по дате регистрации</p></div>
            </div>
            ${registrationChart(analysis.registrationsByMonth)}
          </section>

          <section class="chart-grid chart-grid--bottom">
            <article class="card chart-card">
              <div class="card__head">
                <div><h2>Регионы и доли</h2><p>Абсолютные и относительные значения</p></div>
              </div>
              ${table(analysis.regionsDistribution)}
            </article>
          </section>

          <section class="card chart-card map-card">
            <div class="card__head">
              <div><h2>Карта регионов</h2><p>Географическое распределение клиентов</p></div>
            </div>
            ${regionMap(analysis.regionsDistribution)}
          </section>

          <section class="segments">
            ${analysis.total ? `
              <article class="segment">${icon("gem")} <div><b>${fmt.format(analysis.segments.vip)}</b><span>VIP клиенты</span></div></article>
              <article class="segment">${icon("sparkles")} <div><b>${fmt.format(analysis.segments.newClients)}</b><span>Новые клиенты</span></div></article>
              <article class="segment">${icon("trending-up")} <div><b>${fmt.format(analysis.segments.active)}</b><span>Активные</span></div></article>
              <article class="segment">${icon("pause-circle")} <div><b>${fmt.format(analysis.segments.inactive)}</b><span>Неактивные</span></div></article>
            ` : emptyState()}
          </section>
        </main>
      </div>
      ${state.toast ? `<div class="toast toast--${state.toast.type}">
        <span class="toast__icon">${icon(state.toast.type === "success" ? "circle-check" : "triangle-alert", 18)}</span>
        <span>
          <b>${state.toast.title}</b>
          ${state.toast.text ? `<small>${state.toast.text}</small>` : ""}
        </span>
      </div>` : ""}
    </div>
  `;
}

async function loadAnalysis() {
  if (!state.analysis) return;
  const payload = await api("/api/analysis", {
    method: "POST",
    body: JSON.stringify({ filters: state.filters })
  });
  state.analysis = payload.analysis;
  render();
}

async function uploadFile(file) {
  if (!window.XLSX) {
    notify("error", "Не удалось прочитать Excel", "Библиотека XLSX не загрузилась. Проверьте подключение к интернету.");
    return;
  }
  state.loading = true;
  render();
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const payload = await api("/api/upload", {
      method: "POST",
      body: JSON.stringify({ rows })
    });
    state.analysis = payload.analysis;
    state.errors = [];
    notify("success", "Вау, всё загрузилось!", `${payload.message} Аналитика уже обновлена.`);
  } catch (error) {
    state.errors = error.errors || [error.message || "Не удалось загрузить файл."];
    notify("error", "Есть ошибки в файле", "Проверьте блок контроля качества: там показаны строки и причины.");
  } finally {
    state.loading = false;
    render();
  }
}

function downloadTemplate() {
  if (!window.XLSX) {
    notify("error", "Не удалось создать шаблон", "Библиотека XLSX не загрузилась. Проверьте подключение к интернету.");
    return;
  }
  const rows = [
    ["возраст", "пол", "регион", "дата регистрации", "количество заказов", "средний чек"],
    [32, "Женский", "Москва", "15.02.2026", 6, 7200],
    [41, "Мужской", "Санкт-Петербург", "03.01.2026", 2, 3400]
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "clients");
  XLSX.writeFile(workbook, "client_base_template.xlsx");
}

async function exportCsv() {
  if (!state.analysis) {
    notify("error", "Нечего экспортировать", "Сначала загрузите Excel-файл с клиентской базой.");
    return;
  }

  try {
    const payload = await api("/api/analysis", {
      method: "POST",
      body: JSON.stringify({ filters: state.filters })
    });
    const analysis = payload.analysis;
    const k = analysis.kpis;

    if (!analysis.total) {
      notify("error", "Данных нет", "По выбранным фильтрам нечего выгружать.");
      return;
    }

    const rows = [
      ["Отчет по текущему сегменту"],
      ["Показатель", "Значение"],
      ["Всего клиентов", analysis.total],
      ["Всего записей в базе", analysis.sourceTotal],
      ["Среднее заказов", round(k.avgOrders)],
      ["Медиана заказов", round(k.medianOrders, 0)],
      ["Мода заказов", round(k.modeOrders, 0)],
      ["Средний возраст", round(k.avgAge)],
      ["Период регистрации", `${analysis.registrationRange.from || ""} - ${analysis.registrationRange.to || ""}`],
      [],
      ["Описательная статистика"],
      ["Показатель", "Значение"],
      ["Средний доход", money.format(k.avgRevenue)],
      ["Средний расход", money.format(k.avgExpense)],
      ["Медиана дохода", money.format(k.medianRevenue)],
      ["Мода дохода", money.format(k.modeRevenue)],
      ["Минимальный средний чек", money.format(k.minCheck)],
      ["Максимальный средний чек", money.format(k.maxCheck)],
      [],
      ["Распределение по полу"],
      ["Пол", "Клиенты", "Доля"],
      ...analysis.gender.map((item) => [item.name, item.count, `${round(item.percent)}%`]),
      [],
      ["Возрастные группы"],
      ["Группа", "Клиенты", "Доля"],
      ...analysis.ageGroups.map((item) => [item.name, item.count, `${round(item.percent)}%`]),
      [],
      ["Регионы"],
      ["Регион", "Клиенты", "Доля"],
      ...analysis.regionsDistribution.map((item) => [item.name, item.count, `${round(item.percent)}%`]),
      [],
      ["Регистрации по месяцам"],
      ["Месяц", "Регистрации"],
      ...analysis.registrationsByMonth.map((item) => [formatMonth(item.month), item.count]),
      [],
      ["Сегменты"],
      ["Сегмент", "Клиенты"],
      ["VIP клиенты", analysis.segments.vip],
      ["Новые клиенты", analysis.segments.newClients],
      ["Активные", analysis.segments.active],
      ["Неактивные", analysis.segments.inactive]
    ];
    const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "crm_filtered_statistics.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    state.analysis = analysis;
    notify("success", "CSV готов", `Статистика выгружена по текущему сегменту: ${fmt.format(analysis.total)} клиентов.`);
  } catch (error) {
    notify("error", "Не удалось выгрузить CSV", error.message || "Попробуйте повторить экспорт.");
  }
}

function bindEvents() {
  document.querySelector("#fileInput")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) uploadFile(file);
  });
  document.querySelector("#downloadTemplate")?.addEventListener("click", downloadTemplate);
  document.querySelector("#exportCsv")?.addEventListener("click", exportCsv);
  document.querySelector("#refreshAnalysis")?.addEventListener("click", loadAnalysis);
  document.querySelector("#clearFilters")?.addEventListener("click", () => {
    state.filters = { gender: "all", region: "all", ageMin: 0, ageMax: 0, ordersMin: 0, ordersMax: 0, checkMin: 0, checkMax: 0, registeredFrom: "", registeredTo: "" };
    loadAnalysis();
  });

  document.querySelectorAll(".custom-select__trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const select = trigger.closest(".custom-select");
      const isOpen = select.classList.contains("is-open");
      document.querySelectorAll(".custom-select.is-open").forEach((item) => item.classList.remove("is-open"));
      select.classList.toggle("is-open", !isOpen);
      trigger.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  document.querySelectorAll(".custom-select__option").forEach((option) => {
    option.addEventListener("click", () => {
      const select = option.closest(".custom-select");
      state.filters[select.dataset.select] = option.dataset.value;
      select.classList.remove("is-open");
      loadAnalysis();
    });
  });

  document.querySelectorAll(".date-picker__trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const picker = trigger.closest(".date-picker");
      const isOpen = picker.classList.contains("is-open");
      document.querySelectorAll(".date-picker.is-open").forEach((item) => item.classList.remove("is-open"));
      picker.classList.toggle("is-open", !isOpen);
    });
  });

  document.querySelectorAll(".calendar__nav").forEach((button) => {
    button.addEventListener("click", () => {
      const picker = button.closest(".date-picker");
      const calendar = picker.querySelector(".calendar");
      const direction = Number(button.dataset.direction);
      const current = new Date(`${calendar.dataset.currentMonth}-01T00:00:00`);
      current.setMonth(current.getMonth() + direction);
      state.calendarMonth[picker.dataset.date] = current.toISOString().slice(0, 10);
      render();
      document.querySelector(`[data-date="${picker.dataset.date}"]`)?.classList.add("is-open");
    });
  });

  document.querySelectorAll(".calendar-day").forEach((button) => {
    button.addEventListener("click", () => {
      const picker = button.closest(".date-picker");
      state.filters[picker.dataset.date] = button.dataset.value;
      state.calendarMonth[picker.dataset.date] = button.dataset.value;
      picker.classList.remove("is-open");
      loadAnalysis();
    });
  });

  document.querySelectorAll(".date-picker__clear").forEach((button) => {
    button.addEventListener("click", () => {
      const picker = button.closest(".date-picker");
      state.filters[picker.dataset.date] = "";
      picker.classList.remove("is-open");
      loadAnalysis();
    });
  });

  document.querySelectorAll(".date-picker__today").forEach((button) => {
    button.addEventListener("click", () => {
      const picker = button.closest(".date-picker");
      const today = new Date().toISOString().slice(0, 10);
      state.filters[picker.dataset.date] = today;
      state.calendarMonth[picker.dataset.date] = today;
      picker.classList.remove("is-open");
      loadAnalysis();
    });
  });

  if (!outsideSelectHandlerBound) {
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".custom-select")) {
        document.querySelectorAll(".custom-select.is-open").forEach((item) => item.classList.remove("is-open"));
      }
      if (!event.target.closest(".date-picker")) {
        document.querySelectorAll(".date-picker.is-open").forEach((item) => item.classList.remove("is-open"));
      }
    });
    outsideSelectHandlerBound = true;
  }

  ["ageMin", "ageMax", "ordersMin", "ordersMax", "checkMin", "checkMax"].forEach((id) => {
    document.querySelector(`#${id}`)?.addEventListener("change", (event) => {
      const value = event.target.type === "number" ? Number(event.target.value) : event.target.value;
      state.filters[id] = value;
      loadAnalysis();
    });
  });
}

function initRegionMap() {
  const node = document.querySelector("#regionMap");
  if (!node || !window.L) return;

  if (regionMapInstance) {
    regionMapInstance.remove();
    regionMapInstance = null;
  }

  const items = JSON.parse(node.dataset.regions || "[]");
  const max = Math.max(...items.map((item) => item.count), 1);
  regionMapInstance = L.map(node, {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: false
  }).setView([55.4, 55.5], 4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18
  }).addTo(regionMapInstance);

  items.forEach((item) => {
    const point = getRegionPoint(item.name);
    if (!point) return;
    const radius = 10 + (item.count / max) * 24;
    L.circleMarker(point, {
      radius,
      color: "rgba(82, 91, 104, 0.86)",
      weight: 2,
      fillColor: "rgba(115, 127, 141, 0.30)",
      fillOpacity: 0.78
    })
      .bindTooltip(`<b>${item.name}</b><br>${fmt.format(item.count)} клиентов<br>${round(item.percent)}% от выборки`, {
        direction: "top",
        opacity: 0.96,
        sticky: true
      })
      .bindPopup(`<b>${item.name}</b><br>${fmt.format(item.count)} клиентов<br>${round(item.percent)}% от выборки`)
      .addTo(regionMapInstance);
  });

  window.setTimeout(() => regionMapInstance?.invalidateSize(), 50);
}

function render() {
  document.querySelector("#app").innerHTML = dashboard();
  bindEvents();
  initRegionMap();
  window.lucide?.createIcons();
}

render();
