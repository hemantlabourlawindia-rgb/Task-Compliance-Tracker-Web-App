import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, dropdownOptionsTable } from "@workspace/db";
import {
  AddDropdownOptionParams,
  AddDropdownOptionBody,
  DeleteDropdownOptionParams,
  DeleteDropdownOptionBody,
} from "@workspace/api-zod";
import { getDropdownsFromSheet } from "../lib/googleSheets";

const router: IRouter = Router();

const VALID_CATEGORIES = ["payroll", "company", "work", "pending", "officer", "assigned"] as const;

router.get("/dropdowns", async (_req, res): Promise<void> => {
  const sheetData = await getDropdownsFromSheet();

  if (sheetData) {
    res.json(sheetData);
    return;
  }

  if (!db) {
    res.json({ payroll: [], company: [], work: [], pending: [], officer: [], assigned: [] });
    return;
  }

  const options = await db
    .select()
    .from(dropdownOptionsTable)
    .orderBy(dropdownOptionsTable.sortOrder, dropdownOptionsTable.value);

  const result: Record<string, string[]> = {
    payroll: [],
    company: [],
    work: [],
    pending: [],
    officer: [],
    assigned: [],
  };

  for (const opt of options) {
    if (opt.category in result) {
      result[opt.category].push(opt.value);
    }
  }

  res.json(result);
});

router.post("/dropdowns/:category", async (req, res): Promise<void> => {
  if (!db) {
    res.status(503).json({ error: "Database not configured. Set DATABASE_URL to manage dropdowns." });
    return;
  }

  const params = AddDropdownOptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = AddDropdownOptionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const category = params.data.category;
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  const [option] = await db
    .insert(dropdownOptionsTable)
    .values({ category, value: body.data.value })
    .returning();

  res.status(201).json(option);
});

router.delete("/dropdowns/:category", async (req, res): Promise<void> => {
  if (!db) {
    res.status(503).json({ error: "Database not configured. Set DATABASE_URL to manage dropdowns." });
    return;
  }

  const params = DeleteDropdownOptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = DeleteDropdownOptionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const category = params.data.category;
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  const deleted = await db
    .delete(dropdownOptionsTable)
    .where(and(eq(dropdownOptionsTable.category, category), eq(dropdownOptionsTable.value, body.data.value)))
    .returning();

  if (!deleted.length) { res.status(404).json({ error: "Option not found" }); return; }

  res.sendStatus(204);
});

export default router;
