import React, { useEffect, useMemo, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "./index.css";

const Admin = () => {
  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [payRate, setPayRate] = useState("");
  const [noteDate, setNoteDate] = useState([]);
  const [note, setNote] = useState([]);
  const [paid, setPaid] = useState([]);
  const [noteDateInput, setNoteDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [emailList, setEmailList] = useState([]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editClockInDate, setEditClockInDate] = useState("");
  const [editClockInTime, setEditClockInTime] = useState("");
  const [editClockOutDate, setEditClockOutDate] = useState("");
  const [editClockOutTime, setEditClockOutTime] = useState("");
  const [editReason, setEditReason] = useState("");

  useEffect(() => {
    fetch("http://localhost:5050/api/emails")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEmailList(data);
        } else {
          console.error("Email list is not an array:", data);
        }
      })
      .catch((err) => console.error("Failed to fetch email list:", err));
  }, []);

  useEffect(() => {
    fetch("http://localhost:5050/api/employees")
      .then((res) => res.json())
      .then((data) => setEmployees(data))
      .catch((err) => console.error("Failed to load employees", err));
  }, []);

  const handleSearch = async () => {
    setEntries([]);
    setNoteDate([]);
    setNote([]);
    setPaid([]);

    if (!selectedEmployee || !selectedMonth || !selectedYear || !payRate) {
      alert("Please select employee, month, year, and enter pay rate.");
      return;
    }

    try {
      const response = await fetch("http://localhost:5050/api/employee-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          employeeName: selectedEmployee,
          month: String(selectedMonth),
          year: String(selectedYear)
        })
      });

      const data = await response.json();

      const validData = Array.isArray(data) ? data : [];
      setEntries(validData);

      const fileNameFormat = `/Users/ramanabadeti/Desktop/PROJECTS/PunchWay/${selectedMonth}-${selectedYear} paysheet.xlsx`;

      const bodyNote = { fileNameFormat };
      fetch("http://localhost:5050/api/admin-note-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyNote),
      })
        .then((res) => res.json())
        .then((noteData) => {
          const filteredNotes = noteData.filter(
            (d) => d.employeeName === selectedEmployee
          );
          setNoteDate(filteredNotes.map((d) => d.noteDate));
          setNote(filteredNotes.map((d) => d.note));
          setPaid(filteredNotes.map((d) => parseFloat(d.amountPaid) || 0));
        })
        .catch((err) => {
          console.error("Failed to load notes:", err);
        });
    } catch (err) {
      console.error("Failed to load logs:", err);
    }
  };

  const openEditForm = (entry) => {
    setSelectedEntry(entry);
    setEditClockInDate(entry.clockInDate || "");
    setEditClockInTime(entry.clockInTime || "");
    setEditClockOutDate(entry.clockOutDate || "");
    setEditClockOutTime(entry.clockOutTime || "");
    setEditReason("");
    setIsEditOpen(true);
  };

  const closeEditForm = () => {
    setSelectedEntry(null);
    setEditClockInDate("");
    setEditClockInTime("");
    setEditClockOutDate("");
    setEditClockOutTime("");
    setEditReason("");
    setIsEditOpen(false);
  };

  const saveEditedEntry = async () => {
    if (!selectedEntry) return;

    try {
      const response = await fetch(
        `http://localhost:5050/api/time-entry/${selectedEntry.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            clockInDate: editClockInDate,
            clockInTime: editClockInTime,
            clockOutDate: editClockOutDate,
            clockOutTime: editClockOutTime,
            hourlyRate: Number(payRate || selectedEntry.hourlyRate || 0),
            editReason,
            editedBy: "admin"
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update entry");
      }

      alert("Time entry updated successfully");
      closeEditForm();
      handleSearch();
    } catch (error) {
      console.error("Error updating entry:", error);
      alert(error.message || "Failed to update entry");
    }
  };

  const handleSendMail = async () => {
    if (!Array.isArray(emailList)) {
      alert("Email list is not loaded correctly.");
      return;
    }

    const canvas = await html2canvas(document.body, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    const today = new Date().toISOString().split("T")[0];
    const pdfFileName = `${selectedEmployee}_payroll_${today}.pdf`;
    pdf.save(pdfFileName);

    const employeeEmail =
      emailList.find((e) => e.name === selectedEmployee)?.mailID || "";
    const managerEmail =
      emailList.find((e) => e.role?.toLowerCase() === "admin")?.mailID || "";

    const subject = encodeURIComponent(`Payroll - ${today}`);
    const body = encodeURIComponent(
      `Hi,\n\nAttached is the payroll summary for ${selectedEmployee} on ${today}.\n\nRegards,\nAdmin`
    );

    const mailtoURL = `https://mail.google.com/mail/?view=cm&fs=1&to=${managerEmail},${employeeEmail}&su=${subject}&body=${body}`;
    window.open(mailtoURL, "_blank");
  };

  const handleLogout = () => {
    localStorage.removeItem("logInUser");
    window.location.href = "/login";
  };

  const handleSubmitNote = () => {
    if (!noteDateInput || !noteInput || !amountPaidInput) {
      alert("Please enter date, note, and amount paid.");
      return;
    }

    const filePath = `/Users/ramanabadeti/Desktop/PROJECTS/PunchWay/${selectedMonth}-${selectedYear} paysheet.xlsx`;

    fetch("http://localhost:5050/api/save-admin-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath,
        empName: selectedEmployee,
        sheetName: "NotesSheet",
        noteDate: noteDateInput,
        note: noteInput,
        amountPaid: amountPaidInput,
        amountPending: 0
      }),
    })
      .then((res) => res.json())
      .then(() => {
        alert("Note saved successfully");
        setNoteDateInput("");
        setNoteInput("");
        setAmountPaidInput("");
        handleSearch();
      })
      .catch((err) => {
        console.error("Error saving note:", err);
        alert("Failed to save note.");
      });
  };

  const allPay = useMemo(() => {
    return entries.map((entry) => {
      const rate = Number(payRate || entry.hourlyRate || 0);
      const hours = Number(entry.decimalHours || 0);
      return (hours * rate).toFixed(2);
    });
  }, [entries, payRate]);

  const totalHours = useMemo(() => {
    return entries.reduce((sum, entry) => sum + Number(entry.decimalHours || 0), 0);
  }, [entries]);

  const totalPay = useMemo(() => {
    return allPay.reduce((sum, val) => sum + Number(val || 0), 0);
  }, [allPay]);

  const totalPaid = paid.reduce((sum, val) => sum + parseFloat(val || 0), 0);
  const pendingPay = (totalPay - totalPaid).toFixed(2);

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Admin Page</h2>
        <div>
          <span style={{ marginRight: "10px" }}>Admin</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div
        style={{
          marginTop: "30px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <label>Employee:</label>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
        >
          <option value="">--Select--</option>
          {employees.map((emp, index) => (
            <option key={index} value={emp.name}>
              {emp.name}
            </option>
          ))}
        </select>

        <label>Month:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          <option value="">--Month--</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {i + 1}
            </option>
          ))}
        </select>

        <label>Year:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
        >
          <option value="">--Year--</option>
          {[2025, 2026, 2027].map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>

        <label>Pay Rate ($/hr):</label>
        <input
          type="number"
          value={payRate}
          onChange={(e) => setPayRate(e.target.value)}
          style={{ width: "80px" }}
          placeholder="Rate"
          required
        />

        <button onClick={handleSearch}>Search</button>
      </div>

      <div className="employee-logs">
  <table className="admin-table">
    <thead>
  <tr>
    <th>NAME</th>
    <th>DATE</th>
    <th>IN</th>
    <th>OUT</th>
    <th>TOTAL HOURS</th>
    <th>DECIMAL HOURS</th>
    <th>PAY PER DAY</th>
    <th>STATUS</th>
    <th>ACTION</th>
  </tr>
</thead>

    <tbody>
  {entries.map((entry, index) => (
    <tr key={entry.id}>
      <td>{entry.empName}</td>
      <td>{entry.clockInDate}</td>
      <td>{entry.clockInTime}</td>
      <td>{entry.clockOutTime}</td>
      <td>{entry.totalHours}</td>
      <td>{Number(entry.decimalHours || 0).toFixed(2)}</td>
      <td>${allPay[index]}</td>
      <td>{entry.status}</td>
      <td>
        <button onClick={() => openEditForm(entry)}>Edit</button>
      </td>
    </tr>
  ))}

  {entries.length > 0 && (
    <tr className="totals-row">
      <td>TOTAL</td>
      <td>--</td>
      <td>--</td>
      <td>--</td>
      <td>--</td>
      <td>{totalHours.toFixed(2)}</td>
      <td>${totalPay.toFixed(2)}</td>
      <td>--</td>
      <td>--</td>
    </tr>
  )}
</tbody>
  </table>
</div>

      {isEditOpen && (
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        >
          <h3>Edit Time Entry</h3>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Clock In Date"
              value={editClockInDate}
              onChange={(e) => setEditClockInDate(e.target.value)}
            />

            <input
              type="text"
              placeholder="Clock In Time"
              value={editClockInTime}
              onChange={(e) => setEditClockInTime(e.target.value)}
            />

            <input
              type="text"
              placeholder="Clock Out Date"
              value={editClockOutDate}
              onChange={(e) => setEditClockOutDate(e.target.value)}
            />

            <input
              type="text"
              placeholder="Clock Out Time"
              value={editClockOutTime}
              onChange={(e) => setEditClockOutTime(e.target.value)}
            />

            <input
              type="text"
              placeholder="Reason for edit"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              style={{ minWidth: "250px" }}
            />
          </div>

          <div style={{ marginTop: "10px" }}>
            <button onClick={saveEditedEntry}>Save</button>
            <button onClick={closeEditForm} style={{ marginLeft: "10px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <h1>ADMIN NOTE AND REMARK</h1>
      <div className="employee-logs remark">
        <input
          type="date"
          value={noteDateInput}
          onChange={(e) => setNoteDateInput(e.target.value)}
        />
        <input
          type="text"
          placeholder="Note"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
        />
        <input
          type="text"
          placeholder="Amount Paid"
          value={amountPaidInput}
          onChange={(e) => setAmountPaidInput(e.target.value)}
        />
        <button onClick={handleSubmitNote}>Submit Note</button>
        <button onClick={handleSendMail}>Send Email</button>
      </div>

      <div className="employee-logs remark">
        <div className="header">
          <div className="header-row">DATE</div>
          <div className="header-row">NOTE</div>
          <div className="header-row">AMOUNT PAID</div>
          <div className="header-row">AMOUNT PENDING</div>
        </div>
        <div className="time-logs">
          <div className="row">
            {noteDate.map((each, index) => (
              <div key={index}>{each}</div>
            ))}
          </div>
          <div className="row">
            {note.map((each, index) => (
              <div key={index}>{each}</div>
            ))}
          </div>
          <div className="row">
            {paid.map((each, index) => (
              <div key={index}>${each}</div>
            ))}
          </div>
          <div className="row">
            {paid.map((_, index) => (
              <div key={index}>{index === paid.length - 1 ? `$${pendingPay}` : ""}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;