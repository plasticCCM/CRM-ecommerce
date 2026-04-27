import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "clients.json");
const port = Number(process.env.PORT || 4173);
let pgPoolPromise = null;

const fields = {
  age: ["age", "возраст", "Возраст"],
  gender: ["gender", "пол", "Пол"],
  region: ["region", "регион", "Регион"],
  registeredAt: ["registeredAt", "registrationDate", "дата регистрации", "Дата регистрации"],
  orders: ["orders", "количество заказов", "Количество заказов"],
  avgCheck: ["avgCheck", "averageCheck", "средний чек", "Средний чек"]
};

const regions = [
  "Москва",
  "Санкт-Петербург",
  "Московская область",
  "Нижегородская область",
  "Краснодарский край",
  "Свердловская область",
  "Татарстан",
  "Новосибирская область",
  "Самарская область",
  "Ростовская область"
];

function sampleClients() {
  const genders = ["Женский", "Мужской"];
  return Array.from({ length: 420 }, (_, index) => {
    const age = 18 + ((index * 7) % 46);
    const orders = 1 + ((index * 5) % 22);
    const avgCheck = 1200 + ((index * 337) % 12600);
    const month = 1 + ((index * 3) % 12);
    const day = 1 + ((index * 11) % 27);
    return {
      id: index + 1,
      age,
      gender: genders[index % 2],
      region: regions[(index * 3) % regions.length],
      registeredAt: `202${4 + (index % 3)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      orders,
      avgCheck
    };
  });
}

async function ensureData() {
  const pool = await getPgPool();
  if (pool) {
    await pool.query(`
      create table if not exists clients (
        id bigserial primary key,
        age integer not null check (age between 14 and 100),
        gender varchar(16) not null check (gender in ('Мужской', 'Женский')),
        region varchar(120) not null,
        registered_at date not null,
        orders integer not null check (orders >= 0),
        avg_check numeric(12, 2) not null check (avg_check >= 0),
        created_at timestamptz not null default now()
      );
    `);
    const { rows } = await pool.query("select count(*)::int as count from clients");
    if (rows[0].count === 0) await writeClientsPg(pool, sampleClients());
    return;
  }
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dataFile)) {
    await writeFile(dataFile, JSON.stringify([], null, 2), "utf8");
  }
}

async function readClients() {
  await ensureData();
  const pool = await getPgPool();
  if (pool) {
    const { rows } = await pool.query(`
      select id, age, gender, region, registered_at as "registeredAt", orders, avg_check as "avgCheck"
      from clients
      order by id
    `);
    return rows.map((row) => ({
      ...row,
      registeredAt: new Date(row.registeredAt).toISOString().slice(0, 10),
      avgCheck: Number(row.avgCheck)
    }));
  }
  return JSON.parse(await readFile(dataFile, "utf8"));
}

async function saveClients(clients) {
  await ensureData();
  const pool = await getPgPool();
  if (pool) {
    await writeClientsPg(pool, clients);
    return;
  }
  await writeFile(dataFile, JSON.stringify(clients, null, 2), "utf8");
}

async function writeClientsPg(pool, clients) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("truncate table clients restart identity");
    for (const row of clients) {
      await client.query(
        "insert into clients (age, gender, region, registered_at, orders, avg_check) values ($1, $2, $3, $4, $5, $6)",
        [row.age, row.gender, row.region, row.registeredAt, row.orders, row.avgCheck]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getPgPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pgPoolPromise) {
    pgPoolPromise = import("pg")
      .then(({ Pool }) => new Pool({ connectionString: process.env.DATABASE_URL }))
      .catch(() => null);
  }
  return pgPoolPromise;
}

function pick(row, key) {
  const name = fields[key].find((candidate) => Object.hasOwn(row, candidate));
  return name ? row[name] : undefined;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  return iso && !Number.isNaN(new Date(trimmed).getTime()) ? trimmed : null;
}

function normalizeRows(rows) {
  const errors = [];
  const clients = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const age = Number(pick(row, "age"));
    const genderRaw = String(pick(row, "gender") ?? "").trim();
    const region = String(pick(row, "region") ?? "").trim();
    const registeredAt = parseDate(pick(row, "registeredAt"));
    const orders = Number(pick(row, "orders"));
    const avgCheck = Number(pick(row, "avgCheck"));

    if (!Number.isInteger(age) || age < 14 || age > 100) errors.push(`Строка ${rowNumber}: возраст должен быть целым числом от 14 до 100.`);
    if (!["м", "мужской", "ж", "женский"].includes(genderRaw.toLowerCase())) errors.push(`Строка ${rowNumber}: пол должен быть "Мужской" или "Женский".`);
    if (!region) errors.push(`Строка ${rowNumber}: регион обязателен.`);
    if (!registeredAt) errors.push(`Строка ${rowNumber}: дата регистрации должна быть в формате ДД.ММ.ГГГГ или YYYY-MM-DD.`);
    if (!Number.isInteger(orders) || orders < 0) errors.push(`Строка ${rowNumber}: количество заказов должно быть неотрицательным целым числом.`);
    if (!Number.isFinite(avgCheck) || avgCheck < 0) errors.push(`Строка ${rowNumber}: средний чек должен быть положительным числом.`);

    clients.push({
      id: index + 1,
      age,
      gender: genderRaw.toLowerCase().startsWith("м") ? "Мужской" : "Женский",
      region,
      registeredAt,
      orders,
      avgCheck
    });
  });

  return { clients: errors.length ? [] : clients, errors };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mode(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

function distribution(rows, key) {
  const counts = new Map();
  rows.forEach((row) => counts.set(row[key], (counts.get(row[key]) || 0) + 1));
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, percent: rows.length ? (count / rows.length) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

function ageGroups(rows) {
  const groups = [
    ["18-24", (age) => age <= 24],
    ["25-34", (age) => age >= 25 && age <= 34],
    ["35-44", (age) => age >= 35 && age <= 44],
    ["45-54", (age) => age >= 45 && age <= 54],
    ["55+", (age) => age >= 55]
  ];
  return groups.map(([name, test]) => {
    const count = rows.filter((row) => test(row.age)).length;
    return { name, count, percent: rows.length ? (count / rows.length) * 100 : 0 };
  });
}

function registrationRange(rows) {
  const dates = rows.map((row) => row.registeredAt).filter(Boolean).sort();
  return {
    from: dates[0] || null,
    to: dates.at(-1) || null
  };
}

function registrationTimeline(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    if (!row.registeredAt) return;
    const month = row.registeredAt.slice(0, 7);
    counts.set(month, (counts.get(month) || 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

function segmentRows(rows) {
  const now = new Date();
  return {
    vip: rows.filter((row) => row.avgCheck >= 9000).length,
    newClients: rows.filter((row) => (now - new Date(row.registeredAt)) / 86400000 <= 180).length,
    active: rows.filter((row) => row.orders >= 5).length,
    inactive: rows.filter((row) => row.orders <= 1).length
  };
}

function applyFilters(rows, filters = {}) {
  return rows.filter((row) => {
    if (filters.gender && filters.gender !== "all" && row.gender !== filters.gender) return false;
    if (filters.region && filters.region !== "all" && row.region !== filters.region) return false;
    if (Number.isFinite(filters.ageMin) && filters.ageMin > 0 && row.age < filters.ageMin) return false;
    if (Number.isFinite(filters.ageMax) && filters.ageMax > 0 && row.age > filters.ageMax) return false;
    if (Number.isFinite(filters.ordersMin) && filters.ordersMin > 0 && row.orders < filters.ordersMin) return false;
    if (Number.isFinite(filters.ordersMax) && filters.ordersMax > 0 && row.orders > filters.ordersMax) return false;
    if (Number.isFinite(filters.checkMin) && filters.checkMin > 0 && row.avgCheck < filters.checkMin) return false;
    if (Number.isFinite(filters.checkMax) && filters.checkMax > 0 && row.avgCheck > filters.checkMax) return false;
    if (filters.registeredFrom && row.registeredAt < filters.registeredFrom) return false;
    if (filters.registeredTo && row.registeredAt > filters.registeredTo) return false;
    return true;
  });
}

function analysis(rows, filters = {}) {
  const filtered = applyFilters(rows, filters);
  const checks = filtered.map((row) => row.avgCheck);
  const orders = filtered.map((row) => row.orders);
  const ages = filtered.map((row) => row.age);
  const revenues = filtered.map((row) => row.avgCheck * row.orders);
  return {
    total: filtered.length,
    sourceTotal: rows.length,
    regions: [...new Set(rows.map((row) => row.region))].sort(),
    kpis: {
      avgAge: average(ages),
      avgCheck: average(checks),
      avgRevenue: average(revenues),
      avgExpense: average(checks),
      avgOrders: average(orders),
      medianCheck: median(checks),
      medianRevenue: median(revenues),
      medianExpense: median(checks),
      medianOrders: median(orders),
      modeRevenue: mode(revenues),
      modeExpense: mode(checks),
      modeOrders: mode(orders),
      minCheck: checks.length ? Math.min(...checks) : 0,
      maxCheck: checks.length ? Math.max(...checks) : 0
    },
    gender: distribution(filtered, "gender"),
    regionsDistribution: distribution(filtered, "region").slice(0, 12),
    ageGroups: ageGroups(filtered),
    registrationRange: registrationRange(filtered),
    registrationsByMonth: registrationTimeline(filtered),
    segments: segmentRows(filtered),
    preview: filtered.slice(0, 8)
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      response.writeHead(302, { Location: "/favicon.svg" });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/state") {
      const rows = await readClients();
      return sendJson(response, 200, { ok: true, analysis: analysis(rows) });
    }

    if (request.method === "POST" && url.pathname === "/api/analysis") {
      const rows = await readClients();
      const body = await readBody(request);
      return sendJson(response, 200, { ok: true, analysis: analysis(rows, body.filters) });
    }

    if (request.method === "POST" && url.pathname === "/api/upload") {
      const body = await readBody(request);
      const { clients, errors } = normalizeRows(body.rows || []);
      if (errors.length) return sendJson(response, 422, { ok: false, errors });
      await saveClients(clients);
      return sendJson(response, 200, { ok: true, message: `Загружено ${clients.length} записей.`, analysis: analysis(clients) });
    }

    if (request.method === "POST" && url.pathname === "/api/reset") {
      const rows = sampleClients();
      await saveClients(rows);
      return sendJson(response, 200, { ok: true, message: "Демо-данные восстановлены.", analysis: analysis(rows) });
    }

    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.normalize(path.join(publicDir, requested));
    if (!filePath.startsWith(publicDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const content = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    sendJson(response, 500, { ok: false, errors: [error.message] });
  }
});

server.listen(port, () => {
  console.log(`CRM analytics dashboard is running at http://localhost:${port}`);
});
