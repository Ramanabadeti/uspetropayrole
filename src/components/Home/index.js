import { Component } from "react";
import DateTime from "../DateTime";
import "./index.css";

class EmployeeHome extends Component {
  state = {
    allDates: [],
    allIn: [],
    allOut: [],
    allTotalTime: [],
    allPay: [],
    clockInFullTime: null,
    isClockIn: false,
    inTime: null,
    inDate: null,
    outTime: null,
    outDate: null,
    records: [],
    empName: "",
    month: null,
    year: null,
    payRate: 0,
    hideClockInBtn: false,
    totalHoursWorked: 0.0,
  };

  clockInFnc = async () => {
    try {
      const now = new Date();
      const presentMonth = now.getMonth() + 1;
      const presentYear = now.getFullYear();
      const employeeName = this.props.empName;

      const clockInDetails = {
        empName: employeeName,
        clockInFullTime: now.toISOString(),
        inTime: now.toLocaleTimeString(),
        inDate: now.toLocaleDateString(),
        month: String(presentMonth),
        year: String(presentYear),
      };

      const response = await fetch("http://localhost:5050/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clockInDetails),
      });

      if (!response.ok) {
        throw new Error("Failed to clock in");
      }

      this.setState({ hideClockInBtn: true });
      setTimeout(() => this.setState({ hideClockInBtn: false }), 15000);

      this.loadClockInData(employeeName);
    } catch (error) {
      console.error("Clock-in error:", error);
    }
  };

  getEmpDetails = () => {
    const employeeName = this.props.empName;

    return fetch("http://localhost:5050/api/employee-list")
      .then((res) => res.json())
      .then((data) => {
        const employee = data.find((each) => each.name === employeeName);
        if (!employee) throw new Error("Employee not found");

        return 15;
      });
  };

 componentDidMount() {
  const employeeName = this.props.empName;
  const loggedInUser = JSON.parse(localStorage.getItem("logInUser"));

  if (!loggedInUser || loggedInUser.name !== employeeName) {
    window.location.href = "/login";
    return;
  }

  this.loadClockInData(employeeName);

  this.renderEmployeeLogs();
}

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.empName !== this.props.empName) {
      this.loadClockInData(this.props.empName);
    }

    if (
      (prevState.month !== this.state.month || prevState.year !== this.state.year) &&
      this.state.month &&
      this.state.year
    ) {
      this.renderEmployeeLogs();
    }
  }

  loadClockInData = (employeeName) => {
    fetch(`http://localhost:5050/clock-in/${employeeName}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not clocked in");
        return res.json();
      })
      .then((clockInData) => {
        this.setState({
          empName: employeeName,
          clockInFullTime: new Date(clockInData.clockInFullTime),
          inTime: clockInData.inTime,
          inDate: clockInData.inDate,
          isClockIn: true,
          month: String(clockInData.month),
          year: String(clockInData.year),
        });
      })
      .catch(() => {
        const now = new Date();
        this.setState({
          empName: employeeName,
          isClockIn: false,
          inTime: null,
          inDate: null,
          clockInFullTime: null,
          month: String(now.getMonth() + 1),
          year: String(now.getFullYear()),
        });

        this.renderEmployeeLogs();
      });
  };

  clockOutFnc = async () => {
    try {
      this.setState({ hideClockInBtn: true });
      setTimeout(() => this.setState({ hideClockInBtn: false }), 15000);

      const { inDate, inTime, empName, clockInFullTime, month, year } = this.state;

      if (!clockInFullTime) {
        throw new Error("Missing clock-in time");
      }

      const now = new Date();
      const outDate = now.toLocaleDateString();
      const outTime = now.toLocaleTimeString();

      const fullSeconds = Math.floor((now - clockInFullTime) / 1000);
      const hours = Math.floor(fullSeconds / 3600);
      const minutes = Math.floor((fullSeconds % 3600) / 60);
      const seconds = fullSeconds % 60;

      const decimalHours = Number((hours + minutes / 60 + seconds / 3600).toFixed(2));
      const durationFormat = `${hours}:${String(minutes).padStart(2, "0")}:${String(
        seconds
      ).padStart(2, "0")}`;

      const hourlyRate = await this.getEmpDetails();
      const dayPay = Number((decimalHours * hourlyRate).toFixed(2));

      const response = await fetch("http://localhost:5050/clock-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empName,
          clockInDate: inDate,
          clockInTime: inTime,
          clockOutDate: outDate,
          clockOutTime: outTime,
          clockInFullTime: clockInFullTime.toISOString(),
          clockOutFullTime: now.toISOString(),
          totalHours: durationFormat,
          decimalHours,
          hourlyRate,
          dayPay,
          month: String(month),
          year: String(year),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save clock-out data");
      }

      await this.renderEmployeeLogs();

      this.setState({
        isClockIn: false,
        inTime: null,
        inDate: null,
        outTime: null,
        outDate: null,
        clockInFullTime: null,
      });
    } catch (error) {
      console.error("Error during clock-out:", error);
    }
  };

  renderEmployeeLogs = () => {
    const employeeName = this.props.empName;
    const { month, year } = this.state;

    return fetch("http://localhost:5050/api/employee-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeName,
        month: month ? String(month) : undefined,
        year: year ? String(year) : undefined,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const dates = data.map((d) => d.clockInDate);
        const inTimes = data.map((d) => d.clockInTime);
        const outTimes = data.map((d) => d.clockOutTime);
        const workingTimes = data.map((d) => d.totalHours);
        const numWorkTimes = data.map((d) => Number(d.decimalHours || 0));

        const sumOfFullHours = numWorkTimes
          .reduce((accumulator, currentValue) => accumulator + currentValue, 0)
          .toFixed(2);

        this.setState({
          allDates: dates,
          allIn: inTimes,
          allOut: outTimes,
          allTotalTime: workingTimes,
          totalHoursWorked: sumOfFullHours,
        });
      })
      .catch((error) => {
        console.error("Error loading employee logs:", error);
      });
  };

  onLogOut = () => {
    localStorage.removeItem("logInUser");
    window.location.href = "/login";
  };

  render() {
    const {
      empName,
      inTime,
      inDate,
      isClockIn,
      allDates,
      allIn,
      allOut,
      allTotalTime,
      hideClockInBtn,
      totalHoursWorked,
    } = this.state;

    return (
      <div>
        <nav className="navbar">
          <button className="back-btn" onClick={() => this.props.navigate("/login")}>
            Back
          </button>
          <h1 className="nav-title">Time Sheet</h1>
          <button className="logout-btn" onClick={this.onLogOut}>
            Logout
          </button>
        </nav>

        <div>
          <h3>{empName}</h3>
        </div>

        <DateTime />

        {!hideClockInBtn &&
          (isClockIn ? (
            <button className="clock-out" onClick={this.clockOutFnc}>
              Clock Out
            </button>
          ) : (
            <button className="clock-in" onClick={this.clockInFnc}>
              Clock In
            </button>
          ))}

        {isClockIn ? (
          <div>
            <h4>Today You Started At</h4>
            <h1>
              {inDate} {inTime}
            </h1>
            <h3>Enjoy Your Shift</h3>
          </div>
        ) : (
          <h4>Go ahead and Clock In</h4>
        )}

        <div className="employee-logs">
          <div className="header">
            <div className="header-row">DATE</div>
            <div className="header-row">IN</div>
            <div className="header-row">OUT</div>
            <div className="header-row">TOTAL HOURS</div>
          </div>

          <div className="time-logs">
            <div className="row">
              {allDates.map((each, index) => (
                <div key={index}>{each}</div>
              ))}
            </div>
            <div className="row">
              {allIn.map((each, index) => (
                <div key={index}>{each}</div>
              ))}
            </div>
            <div className="row">
              {allOut.map((each, index) => (
                <div key={index}>{each}</div>
              ))}
            </div>
            <div className="row">
              {allTotalTime.map((each, index) => (
                <div key={index}>{each}</div>
              ))}
            </div>
          </div>

          <div className="employee-logs">
            <div>Total Number Of Hours : {totalHoursWorked}</div>
          </div>
        </div>
      </div>
    );
  }
}

export default EmployeeHome;