const fs = require("fs");
const path = require("path");

const REGION = "CN";
const TIMEOUT_MS = 8000;
const strict = process.argv.includes("--strict");

const SOURCES = [
  {
    name: "github",
    indexUrl:
      "https://raw.githubusercontent.com/Saxon-Liu/holiday-calendar/main/data/index.json",
    yearUrl: (year) =>
      `https://raw.githubusercontent.com/Saxon-Liu/holiday-calendar/main/data/${REGION}/${year}.json`,
  },
  {
    name: "unpkg",
    indexUrl: "https://unpkg.com/holiday-calendar/data/index.json",
    yearUrl: (year) =>
      `https://unpkg.com/holiday-calendar/data/${REGION}/${year}.json`,
  },
  {
    name: "jsdelivr",
    indexUrl:
      "https://gcore.jsdelivr.net/gh/cg-zhou/holiday-calendar@main/data/index.json",
    yearUrl: (year) =>
      `https://gcore.jsdelivr.net/gh/cg-zhou/holiday-calendar@main/data/${REGION}/${year}.json`,
  },
];

const latestJsonPath = path.join(
  process.cwd(),
  "src",
  "data",
  "builtinHolidays",
  REGION,
  "latest.json"
);
const indexTsPath = path.join(
  process.cwd(),
  "src",
  "data",
  "builtinHolidays",
  "index.ts"
);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasDisplayName(entry) {
  return Boolean(entry.name || entry.name_cn || entry.name_en);
}

function validateHolidayPayload(payload, expectedYear) {
  if (!payload || typeof payload !== "object") {
    throw new Error("payload must be an object");
  }
  if (typeof payload.year !== "number") {
    throw new Error("year must be a number");
  }
  if (expectedYear && payload.year !== expectedYear) {
    throw new Error(`year mismatch: expected ${expectedYear}, got ${payload.year}`);
  }
  if (payload.region !== REGION) {
    throw new Error(`region must be ${REGION}`);
  }
  if (!Array.isArray(payload.dates)) {
    throw new Error("dates must be an array");
  }

  for (const [index, entry] of payload.dates.entries()) {
    if (!entry || typeof entry !== "object") {
      throw new Error(`dates[${index}] must be an object`);
    }
    if (!isDateString(entry.date)) {
      throw new Error(`dates[${index}].date must be YYYY-MM-DD`);
    }
    if (!["public_holiday", "transfer_workday"].includes(entry.type)) {
      throw new Error(`dates[${index}].type is invalid`);
    }
    if (!hasDisplayName(entry)) {
      throw new Error(`dates[${index}] needs a display name`);
    }
  }
}

function validateIndex(payload) {
  if (!payload || !Array.isArray(payload.regions)) {
    throw new Error("index.regions must be an array");
  }
  const region = payload.regions.find((item) => item.name === REGION);
  if (!region || typeof region.endYear !== "number") {
    throw new Error(`index missing ${REGION}.endYear`);
  }
  return region.endYear;
}

async function loadFromSources() {
  const currentYear = new Date().getFullYear();
  const failures = [];

  for (const source of SOURCES) {
    try {
      const index = await fetchJson(source.indexUrl);
      const endYear = validateIndex(index);
      const year = Math.max(currentYear, endYear);
      const url = source.yearUrl(year);
      const data = await fetchJson(url);
      validateHolidayPayload(data, year);
      return { source, url, data };
    } catch (error) {
      failures.push(`${source.name}: ${error.message}`);
    }
  }

  throw new Error(failures.join("; "));
}

function hasExistingSnapshot() {
  return fs.existsSync(latestJsonPath) && fs.existsSync(indexTsPath);
}

function writeSnapshot(result) {
  const payload = {
    source: "builtin",
    generatedAt: new Date().toISOString(),
    sourceUrl: result.url,
    data: result.data,
  };

  ensureDir(latestJsonPath);
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

  ensureDir(indexTsPath);
  fs.writeFileSync(
    indexTsPath,
    [
      "import payload from './CN/latest.json'",
      "",
      "export const BUILTIN_HOLIDAY_REGION = 'CN' as const",
      `export const BUILTIN_HOLIDAY_YEAR = ${result.data.year} as const`,
      "export const BUILTIN_HOLIDAY_PAYLOAD = payload",
      "",
    ].join("\n")
  );
}

async function main() {
  try {
    const result = await loadFromSources();
    writeSnapshot(result);
    console.log(
      `Updated builtin holidays: ${REGION} ${result.data.year} from ${result.url}`
    );
  } catch (error) {
    const message = `Failed to update builtin holidays: ${error.message}`;
    if (strict || !hasExistingSnapshot()) {
      console.error(message);
      process.exitCode = 1;
      return;
    }
    console.warn(`${message}. Using existing snapshot.`);
  }
}

main();
