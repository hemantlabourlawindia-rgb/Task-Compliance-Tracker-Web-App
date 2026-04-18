import { google } from "googleapis";

const SHEET_ID = process.env["GOOGLE_SHEET_ID"];

// Strip TOML triple-quote delimiters (''') and surrounding whitespace that
// can accidentally be included when copying the value from a .replit file.
function sanitizeKeyJson(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/^'''\s*/s, "").replace(/\s*'''$/s, "").trim();
}

const KEY_JSON = sanitizeKeyJson(process.env["GOOGLE_SERVICE_ACCOUNT_KEY"]);

function getAuth() {
  if (!KEY_JSON || !SHEET_ID) return null;
  try {
    const credentials = JSON.parse(KEY_JSON);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } catch {
    return null;
  }
}

function getSheetsClient() {
  const auth = getAuth();
  if (!auth) return null;
  return google.sheets({ version: "v4", auth });
}

export async function getDropdownsFromSheet(): Promise<Record<string, string[]> | null> {
  if (!SHEET_ID || !KEY_JSON) return null;
  const sheets = getSheetsClient();
  if (!sheets) return null;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "DROPDOWN_MASTER",
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return null;

    const dataRows = rows.slice(1);

    const out: Record<string, string[]> = {
      payroll: [],
      company: [],
      work: [],
      pending: [],
      officer: [],
      assigned: [],
    };

    const colOrder: (keyof typeof out)[] = ["payroll", "company", "work", "pending", "officer", "assigned"];

    for (const row of dataRows) {
      colOrder.forEach((category, idx) => {
        const val = row[idx];
        if (val && val.toString().trim()) {
          out[category].push(val.toString().trim());
        }
      });
    }

    for (const key of Object.keys(out)) {
      out[key] = [...new Set(out[key])].sort();
    }

    return out;
  } catch (err) {
    console.error("Google Sheets getDropdowns error:", err);
    return null;
  }
}

export async function appendSubmissionToSheet(data: {
  payroll: string;
  company: string;
  work: string;
  detail1: string;
  detail2?: string | null;
  pending: string;
  remarks?: string | null;
  officer?: string | null;
  assigned?: string | null;
}): Promise<boolean> {
  if (!SHEET_ID || !KEY_JSON) return false;
  const sheets = getSheetsClient();
  if (!sheets) return false;

  try {
    const now = new Date();
    const ts = now.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).replace(",", "");

    const row = [
      ts,
      data.payroll,
      data.company,
      data.work,
      data.detail1,
      data.detail2 ?? "",
      data.pending,
      data.remarks ?? "",
      data.officer ?? "",
      data.assigned ?? "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "FORM_RESPONSES!A:J",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "OVERWRITE",
      requestBody: { values: [row] },
    });

    return true;
  } catch (err) {
    console.error("Google Sheets append error:", err);
    return false;
  }
}

export type SheetSubmissionRow = {
  timestamp: string;
  payrollMasterName: string;
  coCode: string;
  workToBeDone: string;
  detail: string;
  additionalDetail: string;
  pending: string;
  remarks: string;
  fieldOfficerName: string;
  assignedBy: string;
};

export async function getAllSubmissionsFromSheet(): Promise<SheetSubmissionRow[] | null> {
  if (!SHEET_ID || !KEY_JSON) return null;
  const sheets = getSheetsClient();
  if (!sheets) return null;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "FORM_RESPONSES!A:J",
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const dataRows = rows.slice(1);

    return dataRows.map((row) => ({
      timestamp: (row[0] ?? "").toString().trim(),
      payrollMasterName: (row[1] ?? "").toString().trim(),
      coCode: (row[2] ?? "").toString().trim(),
      workToBeDone: (row[3] ?? "").toString().trim(),
      detail: (row[4] ?? "").toString().trim(),
      additionalDetail: (row[5] ?? "").toString().trim(),
      pending: (row[6] ?? "").toString().trim(),
      remarks: (row[7] ?? "").toString().trim(),
      fieldOfficerName: (row[8] ?? "").toString().trim(),
      assignedBy: (row[9] ?? "").toString().trim(),
    })).filter(r => r.payrollMasterName || r.coCode || r.workToBeDone);
  } catch (err) {
    console.error("Google Sheets getAllSubmissions error:", err);
    return null;
  }
}

export const isGoogleSheetsConfigured = !!(SHEET_ID && KEY_JSON);
