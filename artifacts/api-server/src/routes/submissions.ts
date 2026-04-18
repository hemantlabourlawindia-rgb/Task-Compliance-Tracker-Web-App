import { Router, type IRouter } from "express";
import { eq, desc, count, sql, and, gte, lte, isNotNull, ne } from "drizzle-orm";
import { db, submissionsTable } from "@workspace/db";
import {
  CreateSubmissionBody,
  ListSubmissionsQueryParams,
  GetSubmissionParams,
  DeleteSubmissionParams,
} from "@workspace/api-zod";
import {
  appendSubmissionToSheet,
  getAllSubmissionsFromSheet,
  isGoogleSheetsConfigured,
} from "../lib/googleSheets";

const router: IRouter = Router();

function parseSheetTimestamp(ts: string): Date {
  try {
    const [datePart, timePart] = ts.split(" ");
    const [day, month, year] = datePart.split("/").map(Number);
    const [hours, minutes, seconds] = (timePart ?? "00:00:00").split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds);
  } catch {
    return new Date();
  }
}

router.post("/submissions/sync-from-sheet", async (_req, res): Promise<void> => {
  if (!db) {
    res.status(503).json({ error: "Database not configured. Set DATABASE_URL to enable sync." });
    return;
  }
  if (!isGoogleSheetsConfigured) {
    res.status(503).json({ error: "Google Sheets is not configured" });
    return;
  }

  const rows = await getAllSubmissionsFromSheet();
  if (rows === null) {
    res.status(502).json({ error: "Failed to fetch data from Google Sheet" });
    return;
  }

  if (rows.length === 0) {
    res.json({ inserted: 0, skipped: 0, message: "No rows found in FORM_RESPONSES" });
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.payrollMasterName || !row.workToBeDone || !row.pending) {
      skipped++;
      continue;
    }
    const submittedAt = row.timestamp ? parseSheetTimestamp(row.timestamp) : new Date();
    try {
      await db.insert(submissionsTable).values({
        payroll: row.payrollMasterName,
        company: row.coCode,
        work: row.workToBeDone,
        detail1: row.detail || "-",
        detail2: row.additionalDetail || null,
        pending: row.pending,
        remarks: row.remarks || null,
        officer: row.fieldOfficerName || null,
        assigned: row.assignedBy || null,
        submittedAt,
      });
      inserted++;
    } catch {
      skipped++;
    }
  }

  res.json({
    inserted,
    skipped,
    total: rows.length,
    message: `Synced ${inserted} rows from Google Sheet.${skipped > 0 ? ` ${skipped} rows skipped.` : ""}`,
  });
});

router.get("/submissions/summary", async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

  // --- Google Sheets fallback (no database) ---
  if (!db) {
    const rows = await getAllSubmissionsFromSheet();
    if (rows === null) {
      res.status(502).json({ error: "Failed to load dashboard data." });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = rows;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(r => parseSheetTimestamp(r.timestamp) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => parseSheetTimestamp(r.timestamp) <= end);
    }

    const todayRows = filtered.filter(r => parseSheetTimestamp(r.timestamp) >= today);

    const byWorkMap: Record<string, number> = {};
    const byPendingMap: Record<string, number> = {};
    const byOfficerMap: Record<string, { total: number; done: number; pending: number }> = {};
    const byDoerMap: Record<string, { total: number; done: number; pending: number }> = {};

    for (const r of filtered) {
      if (r.workToBeDone) byWorkMap[r.workToBeDone] = (byWorkMap[r.workToBeDone] ?? 0) + 1;
      if (r.pending) byPendingMap[r.pending] = (byPendingMap[r.pending] ?? 0) + 1;

      const isDone = r.pending.toLowerCase() === "done";

      if (r.fieldOfficerName) {
        const o = byOfficerMap[r.fieldOfficerName] ?? { total: 0, done: 0, pending: 0 };
        o.total++;
        if (isDone) o.done++; else o.pending++;
        byOfficerMap[r.fieldOfficerName] = o;
      }

      if (r.payrollMasterName) {
        const d = byDoerMap[r.payrollMasterName] ?? { total: 0, done: 0, pending: 0 };
        d.total++;
        if (isDone) d.done++; else d.pending++;
        byDoerMap[r.payrollMasterName] = d;
      }
    }

    const byWork = Object.entries(byWorkMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([work, count]) => ({ work, count }));

    const byPending = Object.entries(byPendingMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pending, count]) => ({ pending, count }));

    const byOfficer = Object.entries(byOfficerMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([officer, stats]) => ({ officer, ...stats }));

    const byDoer = Object.entries(byDoerMap)
      .sort((a, b) => b[1].pending - a[1].pending)
      .map(([doer, stats]) => ({ doer, ...stats }));

    const recentSubmissions = filtered
      .slice()
      .sort((a, b) => parseSheetTimestamp(b.timestamp).getTime() - parseSheetTimestamp(a.timestamp).getTime())
      .slice(0, 5)
      .map((r, i) => ({
        id: i + 1,
        payroll: r.payrollMasterName,
        company: r.coCode,
        work: r.workToBeDone,
        detail1: r.detail,
        detail2: r.additionalDetail || null,
        pending: r.pending,
        remarks: r.remarks || null,
        officer: r.fieldOfficerName || null,
        assigned: r.assignedBy || null,
        submittedAt: parseSheetTimestamp(r.timestamp).toISOString(),
      }));

    res.json({
      total: filtered.length,
      todayCount: todayRows.length,
      byWork,
      byPending,
      byOfficer,
      byDoer,
      recentSubmissions,
    });
    return;
  }

  // --- Database path ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateConditions = [];
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    dateConditions.push(gte(submissionsTable.submittedAt, start));
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateConditions.push(lte(submissionsTable.submittedAt, end));
  }

  const dateFilter = dateConditions.length > 0 ? and(...dateConditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(submissionsTable).where(dateFilter);
  const [todayResult] = await db.select({ count: count() }).from(submissionsTable).where(and(gte(submissionsTable.submittedAt, today), dateFilter));

  const byWork = await db.select({ work: submissionsTable.work, count: count() }).from(submissionsTable).where(dateFilter).groupBy(submissionsTable.work).orderBy(desc(count())).limit(10);
  const byPending = await db.select({ pending: submissionsTable.pending, count: count() }).from(submissionsTable).where(dateFilter).groupBy(submissionsTable.pending).orderBy(desc(count())).limit(10);

  const byOfficer = await db
    .select({
      officer: submissionsTable.officer,
      total: count(),
      done: sql<number>`cast(sum(case when lower(${submissionsTable.pending}) = 'done' then 1 else 0 end) as int)`,
      pending: sql<number>`cast(sum(case when lower(${submissionsTable.pending}) != 'done' then 1 else 0 end) as int)`,
    })
    .from(submissionsTable)
    .where(and(isNotNull(submissionsTable.officer), ne(submissionsTable.officer, ""), dateFilter))
    .groupBy(submissionsTable.officer)
    .orderBy(desc(count()));

  const byDoer = await db
    .select({
      doer: submissionsTable.payroll,
      total: count(),
      done: sql<number>`cast(sum(case when lower(${submissionsTable.pending}) = 'done' then 1 else 0 end) as int)`,
      pending: sql<number>`cast(sum(case when lower(${submissionsTable.pending}) != 'done' then 1 else 0 end) as int)`,
    })
    .from(submissionsTable)
    .where(and(isNotNull(submissionsTable.payroll), ne(submissionsTable.payroll, ""), dateFilter))
    .groupBy(submissionsTable.payroll)
    .orderBy(desc(sql`cast(sum(case when lower(${submissionsTable.pending}) != 'done' then 1 else 0 end) as int)`));

  const recentSubmissions = await db.select().from(submissionsTable).where(dateFilter).orderBy(desc(submissionsTable.submittedAt)).limit(5);

  res.json({
    total: totalResult.count,
    todayCount: todayResult.count,
    byWork,
    byPending,
    byOfficer: byOfficer.map(r => ({ officer: r.officer ?? "Unassigned", total: r.total, done: r.done ?? 0, pending: r.pending ?? 0 })),
    byDoer: byDoer.map(r => ({ doer: r.doer ?? "Unknown", total: r.total, done: r.done ?? 0, pending: r.pending ?? 0 })),
    recentSubmissions,
  });
});

router.get("/submissions", async (req, res): Promise<void> => {
  const params = ListSubmissionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 50;
  const offset = params.data.offset ?? 0;

  // --- Google Sheets fallback ---
  if (!db) {
    const rows = await getAllSubmissionsFromSheet();
    if (rows === null) {
      res.status(502).json({ error: "Failed to fetch submissions from Google Sheet" });
      return;
    }
    const total = rows.length;
    const items = rows
      .slice()
      .sort((a, b) => parseSheetTimestamp(b.timestamp).getTime() - parseSheetTimestamp(a.timestamp).getTime())
      .slice(offset, offset + limit)
      .map((r, i) => ({
        id: offset + i + 1,
        payroll: r.payrollMasterName,
        company: r.coCode,
        work: r.workToBeDone,
        detail1: r.detail,
        detail2: r.additionalDetail || null,
        pending: r.pending,
        remarks: r.remarks || null,
        officer: r.fieldOfficerName || null,
        assigned: r.assignedBy || null,
        submittedAt: parseSheetTimestamp(r.timestamp).toISOString(),
      }));
    res.json({ items, total });
    return;
  }

  // --- Database path ---
  const [totalResult] = await db.select({ count: count() }).from(submissionsTable);
  const items = await db.select().from(submissionsTable).orderBy(desc(submissionsTable.submittedAt)).limit(limit).offset(offset);

  res.json({ items, total: totalResult.count });
});

router.post("/submissions", async (req, res): Promise<void> => {
  const body = CreateSubmissionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  // --- Google Sheets only (no database) ---
  if (!db) {
    const ok = await appendSubmissionToSheet(body.data);
    if (!ok) {
      res.status(502).json({ error: "Failed to save to Google Sheet. Check GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY." });
      return;
    }
    res.status(201).json({ ...body.data, id: null, submittedAt: new Date().toISOString() });
    return;
  }

  // --- Database path (also writes to sheet as backup) ---
  const [submission] = await db.insert(submissionsTable).values(body.data).returning();

  appendSubmissionToSheet(body.data).catch((err) =>
    console.error("Sheet append failed:", err)
  );

  res.status(201).json(submission);
});

router.get("/submissions/:id", async (req, res): Promise<void> => {
  if (!db) {
    res.status(503).json({ error: "Database not configured." });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSubmissionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id));

  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  res.json(submission);
});

router.delete("/submissions/:id", async (req, res): Promise<void> => {
  if (!db) {
    res.status(503).json({ error: "Database not configured." });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteSubmissionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const deleted = await db.delete(submissionsTable).where(eq(submissionsTable.id, params.data.id)).returning();

  if (!deleted.length) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
