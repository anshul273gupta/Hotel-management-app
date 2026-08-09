import ExcelJS from "exceljs";
import type { GuestRegisterEntry } from "@/lib/guests";
import { BOOKING_STATUS_LABELS } from "@/lib/constants";

/**
 * Builds the guest register as a real Excel workbook (.xlsx).
 *
 * A plain CSV was easy to produce but poor in Excel: mobile numbers were read
 * as numbers and lost their leading zero, long addresses spilled across
 * neighbouring cells, and rupee totals arrived as text you could not sum.
 * Writing a real workbook fixes all three — numbers stay numbers, phone and ID
 * numbers stay text, and the sheet opens formatted and ready to use.
 */

type Column = {
  header: string;
  width: number;
  /** Keep as literal text so Excel cannot reformat or truncate it. */
  text?: boolean;
  value: (guest: GuestRegisterEntry) => string | number | null;
};

const COLUMNS: Column[] = [
  { header: "Name", width: 26, value: (g) => g.name },
  // Phone numbers must be text: as a number, 09406851411 becomes 9406851411.
  { header: "Mobile", width: 16, text: true, value: (g) => g.mobile ?? "" },
  { header: "Address", width: 38, value: (g) => g.address ?? "" },
  { header: "ID Proof Type", width: 16, value: (g) => g.idProofType ?? "" },
  { header: "ID Proof Number", width: 20, text: true, value: (g) => g.idProofNumber ?? "" },
  { header: "ID Photos", width: 11, value: (g) => g.idProofCount ?? 0 },
  {
    header: "Status",
    width: 14,
    value: (g) => (g.currentStatus ? BOOKING_STATUS_LABELS[g.currentStatus] : ""),
  },
  { header: "Last Check-in", width: 15, value: (g) => formatSheetDate(g.lastCheckIn) },
  { header: "Last Check-out", width: 15, value: (g) => formatSheetDate(g.lastCheckOut) },
  { header: "Total Visits", width: 12, value: (g) => g.totalVisits },
  { header: "Total Spending", width: 16, value: (g) => g.totalSpending },
  { header: "Favourite Room", width: 15, value: (g) => g.favoriteRoom ?? "" },
  { header: "Special Requests", width: 34, value: (g) => g.specialRequests ?? "" },
];

/** dd-mm-yyyy — how dates are read in India, and unambiguous in Excel. */
function formatSheetDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function guestExportFilename(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `guest-register-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`;
}

export async function buildGuestWorkbook(guests: GuestRegisterEntry[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hotel Agrawal Inn";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Guest Register", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = COLUMNS.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF15803D" },
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;

  for (const guest of guests) {
    const row = sheet.addRow(COLUMNS.map((column) => column.value(guest)));

    COLUMNS.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      if (column.text) {
        // Force literal text so Excel keeps leading zeros.
        cell.numFmt = "@";
        cell.value = String(cell.value ?? "");
      }
      if (column.header === "Total Spending") {
        cell.numFmt = '"₹"#,##0.00';
      }
    });
  }

  // Let staff sort and filter inside Excel without setting it up themselves.
  if (guests.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: COLUMNS.length },
    };
  }

  sheet.getColumn("Address").alignment = { wrapText: true, vertical: "top" };
  sheet.getColumn("Special Requests").alignment = { wrapText: true, vertical: "top" };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
