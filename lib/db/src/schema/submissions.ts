import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  payroll: text("payroll").notNull(),
  company: text("company").notNull(),
  work: text("work").notNull(),
  detail1: text("detail1").notNull(),
  detail2: text("detail2"),
  pending: text("pending").notNull(),
  remarks: text("remarks"),
  officer: text("officer"),
  assigned: text("assigned"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({
  id: true,
  submittedAt: true,
});
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissionsTable.$inferSelect;
