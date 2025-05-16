const express = require('express');
const cors = require('cors');
const fs = require('fs');
const XLSX = require('xlsx'); 

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

app.post('/clock-data', (req, res) => {
  const { name, clockInDate, clockInTime, clockOutTime, clockOutDate, TotalHours, fileNameFormat, decimalHours, dayPayDollars } = req.body;
    const tempFilePath='C:/Users/US Petro/OneDrive/Desktop/blanksheet.xlsx'
  
  const saveFilePath = fileNameFormat;

  let workbook;

  // If file exists, load it
  if (fs.existsSync(saveFilePath)) {
    workbook = XLSX.readFile(saveFilePath);
  } else {
    workbook = XLSX.readFile(tempFilePath);
    console.log("writing to Blank sheet")
  }

  let worksheet;

  // If sheet with employee name exists, load it, otherwise create new
  if (workbook.Sheets[name]) {
    worksheet = workbook.Sheets[name];
  } else {
    worksheet = XLSX.utils.aoa_to_sheet([[ "name", "clockInDate", "clockInTime", "clockOutTime", "clockOutDate", "TotalHours", "hoursInDecimal", "dayPay" ]]);
    workbook.Sheets[name] = worksheet;
    workbook.SheetNames.push(name);
  }

  // Add new data
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  data.push([ name, clockInDate, clockInTime, clockOutTime, clockOutDate, TotalHours, decimalHours, dayPayDollars ]);

  const newSheet = XLSX.utils.aoa_to_sheet(data);
  workbook.Sheets[name] = newSheet;

  XLSX.writeFile(workbook, saveFilePath);

  res.send({ status: 'saved' });
  console.log("Saved to:", saveFilePath, "Sheet:", name);
});

app.get("/api/employees", (req, res) => {
    const tempFilePath = "C:/Users/US Petro/OneDrive/Desktopp/blanksheet.xlsx";
    const {fileNameFormat} = req.body
    const filePath = fileNameFormat
    let workbook
    if (fs.existsSync(filePath)) {
      workbook = XLSX.readFile(filePath);
    } else {
      workbook = XLSX.readFile(tempFilePath);
      console.log("writing to Blank sheet")
    }

    try {
      const sheetName = workbook.SheetNames['EmployeeDetails']; 
      
      // ← get first sheet name
      const worksheet = workbook.Sheets[sheetName]; // ← use it here
  
      const jsonData = XLSX.utils.sheet_to_json(worksheet); // Expects columns: no, name, pay
      res.json(jsonData);
    } catch (err) {
      console.error("Error reading Excel:", err);
      res.status(500).json({ error: "Failed to parse Excel file" });
    }
  });

  app.post('/api/employee-logs', (req, res) => {
    const { fileNameFormat, sheetName } = req.body;
    const tempFilePath= "C:/Users/US Petro/OneDrive/Desktop/blanksheet.xlsx"
    let filePath = fileNameFormat;

    if (!filePath || !sheetName) {
      return res.status(400).json({ error: "Missing fileNameFormat or sheetName" });
    }
  
    if (!fs.existsSync(filePath)) {

      filePath = tempFilePath;
      console.log("writing to blank sheet")
    }
    console.log(filePath)
  
    try {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[sheetName];
  
      if (!sheet) {
        return res.status(400).json({ error: `Sheet '${sheetName}' not found` });
      }
  
      const data = XLSX.utils.sheet_to_json(sheet);
      res.json(data);
    } catch (err) {
      console.error("❌ Failed to read Excel file:", err);
      res.status(500).json({ error: "Error reading Excel file" });
    }
  });
  

// to get employee names
  app.get('/api/employee-list', (req, res) => {
    const filePath = 'C:/Users/US Petro/OneDrive/Desktop/blanksheet.xlsx'
  
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
  
    try {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets["EmployeeDetails"];
      if (!sheet) {
        return res.status(400).json({ error: "Sheet 'EmployeeDetails' not found" });
      }
  
      const data = XLSX.utils.sheet_to_json(sheet); 
  
      const names = data.map(emp => emp.name); 
      console.log(data)
      res.json(data);
    } catch (err) {
      console.error("Failed to read Excel file:", err);
      res.status(500).json({ error: "Error reading employee list" });
    }
  });
  

app.listen(5050, () => console.log('Server running on http://localhost:5050'));
