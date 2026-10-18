const { z } = require("zod");

/**
 * Request shapes for every endpoint. The point is not ceremony: these reject
 * the inputs that used to be coerced to 0 or an empty string and stored.
 */

const trimmed = (max = 200) => z.string().trim().max(max);
const requiredText = (label, max = 200) =>
  trimmed(max).min(1, `${label} is required`);

/** Month as "1".."12", year as a 4-digit string. Stored as TEXT historically. */
const monthString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 12, {
    message: "Month must be 1-12",
  });

const yearString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{4}$/.test(v), { message: "Year must be a 4-digit year" });

/** Accepts "12.50" from a form field as well as 12.5 from JSON. */
const money = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : Number(String(v).trim())))
  .refine((v) => Number.isFinite(v), { message: "Must be a number" })
  .refine((v) => v >= 0, { message: "Cannot be negative" })
  .refine((v) => v <= 1_000_000, { message: "Unreasonably large" });

/** `2026-07-05` or `7/5/2026` — both shapes exist in the database. */
const dateString = trimmed(20).refine(
  (v) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(v) || /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(v),
  { message: "Must be a date like 2026-07-05 or 7/5/2026" }
);

/** `15:04`, `15:04:05` or `3:04:05 PM`. */
const timeString = trimmed(20).refine(
  (v) => /^\d{1,2}:\d{2}(:\d{2})?\s*([AaPp][Mm])?$/.test(v),
  { message: "Must be a time like 15:04 or 3:04:05 PM" }
);

const login = z.object({
  username: requiredText("Username", 100),
  password: z.string().min(1, "Password is required").max(200),
});

const changePassword = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(200),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(200),
});

const employeeBody = z.object({
  no: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || String(v).trim() === "") return null;
      const num = Number(v);
      return Number.isFinite(num) ? num : null;
    }),
  name: requiredText("Name", 100),
  // Optional on update: an admin editing a mail address should not have to
  // retype the password, which the old PUT required and then stored in clear.
  password: z.string().min(4, "Password must be at least 4 characters").max(200).optional(),
  role: z.enum(["admin", "employee"]).default("employee"),
  mailID: z.union([trimmed(200).email("Must be a valid email"), z.literal("")]).optional().default(""),
  hourlyRate: money.optional().default(0),
  active: z.coerce.boolean().optional().default(true),
});

const createEmployee = employeeBody.refine((v) => !!v.password, {
  message: "Password is required for a new employee",
  path: ["password"],
});

const updateEmployee = employeeBody;

const idParam = z.object({
  id: z.coerce.number().int().positive("Must be a positive id"),
});

const clockIn = z.object({
  // The server decides the clock-in instant; the client no longer gets to
  // name it. Month/year are derived from it too.
  empName: requiredText("Employee name", 100).optional(),
});

const clockOut = z.object({
  empName: requiredText("Employee name", 100).optional(),
});

const employeeLogsQuery = z.object({
  employeeName: requiredText("Employee name", 100),
  month: monthString.optional(),
  year: yearString.optional(),
});

const timeEntriesQuery = z.object({
  employeeName: trimmed(100).optional(),
  month: monthString.optional(),
  year: yearString.optional(),
  limit: z.coerce.number().int().positive().max(2000).optional().default(1000),
});

const updateTimeEntry = z.object({
  clockInDate: dateString.optional(),
  clockInTime: timeString.optional(),
  clockOutDate: dateString.optional(),
  clockOutTime: timeString.optional(),
  hourlyRate: money.optional(),
  editReason: requiredText("Edit reason", 500),
});

const createAdminNote = z.object({
  empName: requiredText("Employee name", 100),
  noteDate: dateString,
  note: trimmed(2000).optional().default(""),
  amountPaid: money.optional().default(0),
  amountPending: money.optional().default(0),
  month: monthString,
  year: yearString,
});

const adminNotesQuery = z.object({
  employeeName: requiredText("Employee name", 100),
  month: monthString.optional(),
  year: yearString.optional(),
});

const employeeStatsQuery = z.object({
  employeeName: requiredText("Employee name", 100),
});

module.exports = {
  adminNotesQuery,
  changePassword,
  clockIn,
  clockOut,
  createAdminNote,
  createEmployee,
  dateString,
  employeeLogsQuery,
  employeeStatsQuery,
  idParam,
  login,
  money,
  monthString,
  timeEntriesQuery,
  timeString,
  updateEmployee,
  updateTimeEntry,
  yearString,
};
