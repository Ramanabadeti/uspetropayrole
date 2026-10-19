import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import StatsChart from "./StatsChart";
import api, { ApiError } from "../../api";
import { useAuth } from "../../auth";
import "./index.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const todayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMDY = (isoDate) => {
  if (!isoDate || !isoDate.includes("-")) return isoDate || "";
  const [year, month, day] = isoDate.split("-");
  return `${month}/${day}/${year}`;
};

const Admin = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [error, setError] = useState("");
  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [payRate, setPayRate] = useState("");
  const [noteDate, setNoteDate] = useState([]);
  const [note, setNote] = useState([]);
  const [paid, setPaid] = useState([]);
  const [noteDateInput, setNoteDateInput] = useState(todayIsoDate());
  const [noteInput, setNoteInput] = useState("");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [emailList, setEmailList] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [statsRange, setStatsRange] = useState("12");

  // The floating Print button gets out of the way while the chart is on
  // screen, so it never sits on top of the graph.
  const chartSectionRef = useRef(null);
  const [isChartOnScreen, setIsChartOnScreen] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editClockInDate, setEditClockInDate] = useState("");
  const [editClockInTime, setEditClockInTime] = useState("");
  const [editClockOutDate, setEditClockOutDate] = useState("");
  const [editClockOutTime, setEditClockOutTime] = useState("");
  const [editReason, setEditReason] = useState("");
  const [overrideRate, setOverrideRate] = useState(false);
  const [editHourlyRate, setEditHourlyRate] = useState("");

  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const emptyEmployeeForm = {
    no: "",
    name: "",
    password: "",
    role: "employee",
    mailID: "",
    hourlyRate: "",
    active: true,
  };
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);

  // A 401 means the session lapsed, which should put the admin back on the
  // login screen rather than leaving a page of empty tables with an error in
  // the console.
  const handleError = useCallback(
    (err) => {
      if (err instanceof ApiError && err.isAuthError) {
        navigate("/login", { replace: true });
        return;
      }
      const detail = err.details?.map((d) => `${d.field}: ${d.message}`).join("; ");
      setError(detail ? `${err.message} (${detail})` : err.message || "Something went wrong");
    },
    [navigate]
  );

  const loadEmployees = useCallback(async () => {
    try {
      setEmployees(await api.employees());
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    // The legacy workbook is optional — a missing PUNCHWAY_DATA_DIR should
    // not stop the rest of the admin page from working.
    api
      .emails()
      .then(setEmailList)
      .catch(() => setEmailList([]));
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const startAddEmployee = () => {
    setEditingEmployeeId(null);
    setEmployeeForm(emptyEmployeeForm);
  };

  const startEditEmployee = (emp) => {
    setEditingEmployeeId(emp.id);
    setEmployeeForm({
      no: emp.no ?? "",
      name: emp.name ?? "",
      // The roster no longer carries passwords at all, so there is nothing to
      // prefill — blank means "leave it unchanged".
      password: "",
      role: emp.role ?? "employee",
      mailID: emp.mailID ?? "",
      hourlyRate: emp.hourlyRate ?? "",
      active: emp.active === undefined ? true : !!emp.active,
    });
  };

  const saveEmployee = async () => {
    setError("");
    const isEditing = editingEmployeeId !== null;

    if (!employeeForm.name) {
      setError("Name is required.");
      return;
    }
    // Only a new employee must have a password — editing a mail address or a
    // rate no longer forces the admin to retype one.
    if (!isEditing && !employeeForm.password) {
      setError("A password is required for a new employee.");
      return;
    }

    const payload = { ...employeeForm };
    if (!payload.password) delete payload.password;
    if (payload.hourlyRate === "") payload.hourlyRate = 0;

    try {
      if (isEditing) {
        await api.updateEmployee(editingEmployeeId, payload);
      } else {
        await api.createEmployee(payload);
      }
      setEditingEmployeeId(null);
      setEmployeeForm(emptyEmployeeForm);
      await loadEmployees();
    } catch (err) {
      handleError(err);
    }
  };

  const handleSearch = async () => {
    setEntries([]);
    setNoteDate([]);
    setNote([]);
    setPaid([]);
    setMonthlyStats([]);

    setError("");

    // The pay rate box is no longer required to search: it is a display
    // override for the PDF, not the rate the entries are priced at.
    if (!selectedEmployee || !selectedMonth || !selectedYear) {
      setError("Please select an employee, month and year.");
      return;
    }

    const period = {
      employeeName: selectedEmployee,
      month: String(selectedMonth),
      year: String(selectedYear),
    };

    try {
      const [logs, notes, stats] = await Promise.all([
        api.employeeLogs(period),
        api.adminNotes(period),
        api.employeeStats(selectedEmployee),
      ]);

      setEntries(logs);
      setNoteDate(notes.map((d) => d.noteDate));
      setNote(notes.map((d) => d.note));
      setPaid(notes.map((d) => parseFloat(d.amountPaid) || 0));
      setMonthlyStats(stats);
    } catch (err) {
      handleError(err);
    }
  };

  const openEditForm = (entry) => {
    setSelectedEntry(entry);
    setEditClockInDate(entry.clockInDate || "");
    setEditClockInTime(entry.clockInTime || "");
    setEditClockOutDate(entry.clockOutDate || "");
    setEditClockOutTime(entry.clockOutTime || "");
    setEditReason("");
    // Shows the rate this entry is actually priced at, which is not
    // necessarily the rate in the filter box above it.
    setEditHourlyRate(String(entry.hourlyRate ?? ""));
    setOverrideRate(false);
    setIsEditOpen(true);
  };

  const closeEditForm = () => {
    setSelectedEntry(null);
    setEditClockInDate("");
    setEditClockInTime("");
    setEditClockOutDate("");
    setEditClockOutTime("");
    setEditReason("");
    setEditHourlyRate("");
    setOverrideRate(false);
    setIsEditOpen(false);
  };

  const saveEditedEntry = async () => {
    if (!selectedEntry) return;
    setError("");

    if (!editReason.trim()) {
      setError("Please say why this entry is being corrected.");
      return;
    }

    // The rate is only sent when the admin deliberately ticked the override.
    // Previously this request always carried `payRate` from the filter box at
    // the top of the page, so correcting a clock-out time silently repriced
    // the day at whatever happened to be typed up there — entry 626 went
    // $113.70 -> $410.54 -> $98.54 across an edit and its exact reversal,
    // because the rate drifted 15 -> 13 while the hours came back to where
    // they started. Omitting it means "keep this entry's own rate".
    const patch = {
      clockInDate: editClockInDate,
      clockInTime: editClockInTime,
      clockOutDate: editClockOutDate,
      clockOutTime: editClockOutTime,
      editReason: editReason.trim(),
    };

    if (overrideRate) {
      patch.hourlyRate = Number(editHourlyRate || 0);
    }

    try {
      await api.updateTimeEntry(selectedEntry.id, patch);
      closeEditForm();
      await handleSearch();
    } catch (err) {
      handleError(err);
    }
  };

  const buildPayrollPdf = () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const monthName =
      MONTH_NAMES[Number(selectedMonth) - 1] || selectedMonth || "";

    pdf.setFontSize(16);
    pdf.text("US PETRO — Payroll Statement", 14, 18);
    pdf.setFontSize(11);
    pdf.text(`Employee: ${selectedEmployee}`, 14, 27);
    pdf.text(`Pay Period: ${monthName} ${selectedYear}`, 14, 33);
    // Saying "$0.00/hr" when the box is empty would be worse than saying
    // nothing — the rows below are priced per entry in that case.
    pdf.text(
      displayRate
        ? `Pay Rate: $${displayRate.toFixed(2)}/hr`
        : "Pay Rate: as recorded per day",
      14,
      39
    );
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 45);

    autoTable(pdf, {
      startY: 51,
      head: [["Date", "In", "Out", "Total Hours", "Pay"]],
      body: entries.map((entry, index) => [
        entry.clockInDate,
        entry.clockInTime,
        entry.clockOutTime,
        entry.totalHours,
        `$${allPay[index]}`,
      ]),
      foot: [["Total", "", "", totalHours.toFixed(2), `$${totalPay.toFixed(2)}`]],
      headStyles: { fillColor: [33, 46, 64] },
      footStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold" },
    });

    if (noteDate.length > 0) {
      const afterEntriesY = pdf.lastAutoTable.finalY + 12;
      pdf.setFontSize(13);
      pdf.text("Payments", 14, afterEntriesY);

      autoTable(pdf, {
        startY: afterEntriesY + 4,
        head: [["Date", "Note", "Amount Paid"]],
        body: noteDate.map((date, index) => [
          formatMDY(date),
          note[index] || "",
          `$${paid[index]}`,
        ]),
        foot: [
          ["", "Total Paid", `$${totalPaid.toFixed(2)}`],
          ["", "Pending Balance", `$${pendingPay}`],
        ],
        headStyles: { fillColor: [33, 46, 64] },
        footStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold" },
      });
    }

    return pdf;
  };

  useEffect(() => {
    const section = chartSectionRef.current;
    if (!section) {
      setIsChartOnScreen(false);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsChartOnScreen(entry.isIntersecting),
      // Any sliver of the chart in view is enough to stand down; the button
      // is meant to clear the graph entirely, not overlap its edge.
      { threshold: 0 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [selectedEmployee, monthlyStats.length]);

  const handlePrint = () => {
    if (entries.length === 0) {
      alert("Search for an employee's entries before printing.");
      return;
    }

    // Same document the email goes out with, so a printed statement and an
    // emailed one can never disagree.
    const pdf = buildPayrollPdf();
    pdf.autoPrint();

    const printWindow = window.open(pdf.output("bloburl"), "_blank");
    if (!printWindow) {
      // Pop-up blocked: hand over the identical file instead of silently
      // doing nothing.
      const today = new Date().toISOString().split("T")[0];
      pdf.save(`${selectedEmployee}_payroll_${today}.pdf`);
    }
  };

  const handleSendMail = async () => {
    if (!Array.isArray(emailList)) {
      alert("Email list is not loaded correctly.");
      return;
    }

    const pdf = buildPayrollPdf();

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

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleSubmitNote = async () => {
    setError("");

    if (!selectedEmployee || !selectedMonth || !selectedYear) {
      setError("Search for an employee, month and year above before submitting a payment.");
      return;
    }

    if (!noteDateInput || !amountPaidInput) {
      setError("Please enter a date and an amount paid.");
      return;
    }

    try {
      await api.createAdminNote({
        empName: selectedEmployee,
        noteDate: noteDateInput,
        note: noteInput,
        amountPaid: amountPaidInput,
        amountPending: 0,
        month: String(selectedMonth),
        year: String(selectedYear),
      });

      setNoteDateInput(todayIsoDate());
      setNoteInput("");
      setAmountPaidInput("");
      await handleSearch();
    } catch (err) {
      handleError(err);
    }
  };

  // Day pay shown on screen is worked out here, from the hours on each entry
  // and the rate in the Pay Rate box.
  //
  // This is deliberate, because the stored day_pay is useless for most of
  // this data: 615 of the 628 entries came from the Excel import, which
  // hardcoded hourly_rate to 0 and only found a pay column in 13 rows, so
  // reading the stored figure shows $0.00 for almost every historical day.
  // Typing the rate that applied gives a real number for all of them.
  //
  // It is a projection, not a correction. Nothing here is written back, and
  // an entry's stored rate only changes when an admin deliberately ticks
  // "Also change this day's pay rate" in the edit form. Letting this box
  // reach the database is what repriced entry 626 from $15/hr to $13/hr
  // behind the scenes.
  const displayRate = Number(payRate) > 0 ? Number(payRate) : null;

  const allPay = useMemo(
    () =>
      entries.map((entry) => {
        // The typed rate applies to every row; with the box empty each day
        // falls back to whatever it is actually priced at.
        const rate = displayRate ?? Number(entry.hourlyRate || 0);
        return (Number(entry.decimalHours || 0) * rate).toFixed(2);
      }),
    [entries, displayRate]
  );

  const totalHours = useMemo(() => {
    return entries.reduce((sum, entry) => sum + Number(entry.decimalHours || 0), 0);
  }, [entries]);

  const totalPay = useMemo(() => {
    return allPay.reduce((sum, val) => sum + Number(val || 0), 0);
  }, [allPay]);

  const totalPaid = paid.reduce((sum, val) => sum + parseFloat(val || 0), 0);
  const pendingPay = (totalPay - totalPaid).toFixed(2);

  const filteredStats = useMemo(() => {
    if (statsRange === "all") return monthlyStats;
    return monthlyStats.slice(-Number(statsRange));
  }, [monthlyStats, statsRange]);

  return (
    <div style={{ padding: "20px" }}>
      {error && (
        <div className="admin-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}
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

      <button
        onClick={handlePrint}
        aria-hidden={isChartOnScreen}
        style={{
          position: "fixed",
          top: "90px",
          right: "24px",
          zIndex: 100,
          margin: 0,
          opacity: isChartOnScreen ? 0 : 1,
          visibility: isChartOnScreen ? "hidden" : "visible",
          pointerEvents: isChartOnScreen ? "none" : "auto",
          transition: "opacity 0.2s ease, visibility 0.2s ease",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
        }}
      >
        Print
      </button>

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

        <label title="Used to work out the pay shown below and on the PDF. Does not change any stored entry.">
          Pay Rate ($/hr):
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={payRate}
          onChange={(e) => setPayRate(e.target.value)}
          style={{ width: "80px" }}
          placeholder="Rate"
        />

        <button onClick={handleSearch}>Search</button>
      </div>

      {entries.length > 0 && (
        <p className="pay-projection-note">
          {displayRate
            ? `Day pay below is hours \u00d7 $${displayRate.toFixed(2)}/hr. Changing the rate here updates the figures on screen and on the PDF; it does not change any saved entry.`
            : "No rate entered, so each day is shown at its own saved rate. Most imported entries have no saved rate, which is why they read $0.00 \u2014 type the rate that applied above."}
        </p>
      )}

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

      {selectedEmployee && monthlyStats.length > 0 && (
        <div
          ref={chartSectionRef}
          style={{
            marginTop: "30px",
            padding: "20px",
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <h3 style={{ margin: 0 }}>Statistics — {selectedEmployee}</h3>
            <div>
              <label style={{ marginRight: "8px" }}>Range:</label>
              <select
                value={statsRange}
                onChange={(e) => setStatsRange(e.target.value)}
              >
                <option value="6">Last 6 months</option>
                <option value="12">Last 12 months</option>
                <option value="24">Last 24 months</option>
                <option value="all">Entire history</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "20px" }}>
            <StatsChart stats={filteredStats} />
          </div>
        </div>
      )}

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
              placeholder="Reason for edit (required)"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              style={{ minWidth: "250px" }}
              required
            />
          </div>

          <div className="edit-rate-row">
            <label>
              <input
                type="checkbox"
                checked={overrideRate}
                onChange={(e) => setOverrideRate(e.target.checked)}
              />
              Also change this day&apos;s pay rate
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={editHourlyRate}
              onChange={(e) => setEditHourlyRate(e.target.value)}
              disabled={!overrideRate}
              style={{ width: "90px" }}
            />
            <span className="edit-rate-hint">
              {overrideRate
                ? "This day will be repriced at the rate above."
                : `Keeping $${Number(selectedEntry?.hourlyRate || 0).toFixed(2)}/hr.`}
            </span>
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
          placeholder="Note (optional)"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
        />
        <input
          type="text"
          placeholder="Amount Paid"
          required
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
              <div key={index}>{formatMDY(each)}</div>
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

      <div style={{ marginTop: "40px" }}>
        <button
          onClick={() => {
            setShowEmployeeDetails((prev) => !prev);
            if (!showEmployeeDetails) startAddEmployee();
          }}
        >
          {showEmployeeDetails ? "Hide" : "View"} Employee Details
        </button>

        {showEmployeeDetails && (
          <div
            style={{
              marginTop: "20px",
              padding: "20px",
              border: "1px solid #ccc",
              borderRadius: "8px",
            }}
          >
            <table className="admin-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>NAME</th>
                  <th>RATE</th>
                  <th>ROLE</th>
                  <th>EMAIL</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>{emp.no}</td>
                    <td>{emp.name}</td>
                    {/* This column used to print everyone's plaintext
                        password onto the admin screen. */}
                    <td>${Number(emp.hourlyRate || 0).toFixed(2)}</td>
                    <td>{emp.role}</td>
                    <td>{emp.mailID}</td>
                    <td>{emp.active ? "active" : "inactive"}</td>
                    <td>
                      <button onClick={() => startEditEmployee(emp)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ marginTop: "30px" }}>
              {editingEmployeeId !== null ? "Edit Employee" : "Add New Employee"}
            </h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="number"
                placeholder="No"
                style={{ width: "60px" }}
                value={employeeForm.no}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, no: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Name"
                value={employeeForm.name}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                type="password"
                placeholder={
                  editingEmployeeId !== null ? "New password (leave blank to keep)" : "Password"
                }
                autoComplete="new-password"
                value={employeeForm.password}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, password: e.target.value }))}
              />
              <select
                value={employeeForm.role}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="employee">employee</option>
                <option value="admin">admin</option>
              </select>
              <input
                type="email"
                placeholder="Email"
                value={employeeForm.mailID}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, mailID: e.target.value }))}
              />
              {/* The rate lives on the employee now. It was a hardcoded 15 in
                  the employee screen, so nobody could ever be paid anything
                  else without an admin editing each day by hand. */}
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="$/hr"
                style={{ width: "80px" }}
                value={employeeForm.hourlyRate}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, hourlyRate: e.target.value }))}
              />
              <label title="An inactive employee cannot sign in; their history is kept.">
                <input
                  type="checkbox"
                  checked={!!employeeForm.active}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active
              </label>
              <button onClick={saveEmployee}>
                {editingEmployeeId !== null ? "Save Changes" : "Add Employee"}
              </button>
              {editingEmployeeId !== null && (
                <button onClick={startAddEmployee}>Cancel</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;