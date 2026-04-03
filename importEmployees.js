const XLSX = require("xlsx");
const connectDB = require("./db");

async function importEmployeesFromExcel() {
  const db = await connectDB();

  // Change this to your new Mac path
  const filePath = "/Users/ramanabadeti/Desktop/PROJECTS/PunchWay/blank pay sheet.xlsx";

  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets["EmployeeDetails"];

  if (!worksheet) {
    throw new Error("Sheet 'EmployeeDetails' not found in Excel file");
  }

  const employees = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  for (const emp of employees) {
    await db.run(
      `
      INSERT INTO employees (emp_no, name, password, role, mail_id, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET
        emp_no = excluded.emp_no,
        password = excluded.password,
        role = excluded.role,
        mail_id = excluded.mail_id,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        emp.no ?? null,
        emp.name ?? "",
        emp.password?.toString() ?? "",
        emp.role ?? "employee",
        emp.mailID ?? ""
      ]
    );
  }

  console.log(`Imported ${employees.length} employees successfully.`);
}

module.exports = importEmployeesFromExcel;