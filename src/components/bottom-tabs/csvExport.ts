import { unparse } from "papaparse";

export type CsvCellValue = string | number | bigint | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T, index: number) => CsvCellValue;
}

export type CsvFilename = string | (() => string);

export interface CsvExportConfig<T> {
  filename: CsvFilename;
  columns: CsvColumn<T>[];
  fetchRows?: (signal?: AbortSignal) => Promise<T[]>;
}

export interface ResolvedCsvExportConfig<T> extends CsvExportConfig<T> {
  rows: T[];
}

function sanitizeFilenamePart(value: string | number) {
  return String(value)
    .trim()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function truncateUtf8(value: string, maxBytes: number) {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const character of value) {
    const characterBytes = encoder.encode(character).length;
    if (bytes + characterBytes > maxBytes) break;
    result += character;
    bytes += characterBytes;
  }
  return result.replace(/[-_]+$/g, "");
}

export function buildTimestampedCsvFilename(
  parts: Array<string | number | null | undefined>,
  exportedAt = new Date(),
) {
  const safeParts = parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .map(sanitizeFilenamePart)
    .filter(Boolean);
  const timestamp = exportedAt
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");

  const basename = truncateUtf8(
    safeParts.length > 0 ? safeParts.join("_") : "export",
    180,
  );
  return `${basename || "export"}_${timestamp}.csv`;
}

export function resolveCsvFilename(filename: CsvFilename) {
  const resolved = typeof filename === "function" ? filename() : filename;
  return resolved.endsWith(".csv") ? resolved : `${resolved}.csv`;
}

export function buildCsvContent<T>({
  columns,
  rows,
}: Pick<ResolvedCsvExportConfig<T>, "columns" | "rows">) {
  const data: CsvCellValue[][] = [
    columns.map((column) => column.header),
    ...rows.map((row, rowIndex) =>
      columns.map((column) => column.value(row, rowIndex)),
    ),
  ];

  return unparse(data, {
    escapeFormulae: /^[=+\-@\t\r]/,
    header: false,
    newline: "\r\n",
  });
}

export function downloadCsv<T>(config: ResolvedCsvExportConfig<T>) {
  if (config.rows.length === 0 || config.columns.length === 0) return false;

  const csv = buildCsvContent(config);
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = resolveCsvFilename(config.filename);
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
