// Excel export helpers using exceljs to avoid known SheetJS advisories.
// Client-only usage in report pages.

// Column formatting support (optional, backwards compatible):
// - Provide columns to control header text, order, widths, and number/date formats.
// - If not provided, we fall back to inferred headers from rows and heuristic formats.

export type ColumnFormat =
  | "text"
  | "date"
  | "datetime"
  | "integer"
  | "decimal"
  | "currency"
  | "percent";

export type ColumnSpec = {
  key: string; // property key in each row
  header?: string; // header label
  format?: ColumnFormat; // semantic format
  numFmt?: string; // explicit Excel number format (overrides 'format' if set)
  width?: number; // explicit width in characters
  map?: (value: any, row: any) => any; // optional mapper to transform cell value
};

export type SheetSpec<T extends object = any> = {
  sheetName: string;
  rows: T[];
  columns?: ColumnSpec[]; // optional column metadata
};

export async function exportToXLSX<T extends object = any>(
  rows: T[] | { rows: T[]; columns?: ColumnSpec[] },
  filename: string,
  sheetName = "Hoja1"
) {
  const data = Array.isArray(rows) ? { rows } : rows;
  if (!data.rows || data.rows.length === 0) return;
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  fillWorksheet(ws, data.rows, data.columns);
  await downloadWorkbook(wb, ensureXlsxExtension(filename));
}

export async function exportMultipleSheetsToXLSX(sheets: SheetSpec[], filename: string) {
  if (!sheets || sheets.length === 0) return;
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.sheetName || "Sheet");
    fillWorksheet(ws, sheet.rows || [], sheet.columns);
  }
  await downloadWorkbook(wb, ensureXlsxExtension(filename));
}

function fillWorksheet(worksheet: any, rows: any[], columns?: ColumnSpec[]) {
  const headers = columns?.map(c => c.header ?? c.key) ?? Object.keys(rows[0] || {});
  const keys = columns?.map(c => c.key) ?? headers;
  if (headers.length === 0) return;
  // Add header
  worksheet.addRow(headers);

  // Add data rows
  for (const row of rows) {
    const values = keys.map((key, idx) => {
      const spec = columns?.[idx];
      const raw = (row as any)[key];
      return spec?.map ? spec.map(raw, row) : raw;
    });
    worksheet.addRow(values);
  }

  // Style header: bold, fill, center
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell((cell: any) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFEFEF' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Detect and assign simple number/date formats by column based on first non-null value
  for (let c = 0; c < headers.length; c++) {
    const key = keys[c] as string;
    const spec = columns?.[c];
    const sample = rows.map(r => (r as any)[key]).find(v => v !== null && v !== undefined && v !== '');
    const col = worksheet.getColumn(c + 1);
    // Auto width based on header and cell content
    const headerText = headers[c] || key;
    const valuesForWidth = [headerText, ...rows.map(r => (r as any)[key])].map(v => (v === null || v === undefined) ? '' : String(v));
    const maxLen = Math.min(60, Math.max(10, ...valuesForWidth.map(v => v.length)));
    col.width = spec?.width ?? (maxLen + 2);

    // Assign number/date formats
    applyColumnFormat({ worksheet, column: col, colIndex: c + 1, rows, key, sample, spec });
  }
}

function applyColumnFormat(ctx: {
  worksheet: any;
  column: any;
  colIndex: number;
  rows: any[];
  key: string;
  sample: any;
  spec?: ColumnSpec;
}) {
  const { worksheet, column: col, colIndex, rows, key, sample, spec } = ctx;

  // If explicit numFmt provided, just apply it and optionally coerce values for dates
  if (spec?.numFmt) {
    col.numFmt = spec.numFmt;
    if (spec.format === 'date' || spec.format === 'datetime') {
      coerceColumnToDate(worksheet, colIndex, rows);
    }
    return;
  }

  // Semantic format mapping
  switch (spec?.format) {
    case 'text':
      return; // no numFmt
    case 'integer':
      col.numFmt = '#,##0';
      return;
    case 'decimal':
      col.numFmt = '#,##0.00';
      return;
    case 'currency':
      // Default currency; override with numFmt for locale/currency specifics
      // Example custom: numFmt: '[$C$] #,##0.00' for Córdoba (C$)
      col.numFmt = '[$$] #,##0.00';
      return;
    case 'percent':
      col.numFmt = '0.00%';
      return;
    case 'date':
      coerceColumnToDate(worksheet, colIndex, rows);
      col.numFmt = 'dd/mm/yyyy';
      return;
    case 'datetime':
      coerceColumnToDate(worksheet, colIndex, rows);
      col.numFmt = 'dd/mm/yyyy hh:mm';
      return;
  }

  // Heuristics if no spec provided
  if (typeof sample === 'number') {
    const lower = key.toLowerCase();
    if (/(costo|cost|precio|amount|importe|total)/.test(lower)) {
      col.numFmt = '[$$] #,##0.00';
    } else if (/(litros|liters|km|kilometraje|mileage)/.test(lower)) {
      col.numFmt = '#,##0.00';
    } else {
      col.numFmt = '#,##0';
    }
  } else if (typeof sample === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(sample)) {
      coerceColumnToDate(worksheet, colIndex, rows);
      col.numFmt = 'dd/mm/yyyy';
    }
  }
}

function coerceColumnToDate(worksheet: any, colIndex: number, rows: any[]) {
  for (let r = 2; r <= rows.length + 1; r++) {
    const cell = worksheet.getRow(r).getCell(colIndex);
    const val = cell.value;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      const dt = new Date(val);
      if (!isNaN(dt.getTime())) {
        cell.value = dt;
      }
    }
  }
}

async function downloadWorkbook(workbook: any, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ensureXlsxExtension(name: string) {
  return name.toLowerCase().endsWith('.xlsx') ? name : `${name}.xlsx`;
}
