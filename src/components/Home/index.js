import { Component, useEffect, useState } from "react";
import DateTime from "../DateTime";
import './index.css'



class EmployeeHome extends Component{
    state = {allDates:[],allIn:[], allOut:[], allTotalTime:[], allPay:[] ,clockInFullTime:null, isClockIn:false, inTime: null, inDate: null, outTime:null, outDate: null, records:[], empName:"", month:null, year:null, payRate:0}


    clockInFnc=()=>{
        let now = new Date();
        const presentMonth = now.getMonth();
        const presentYear = now.getFullYear();
        
        const employeeName = this.props.empName;

        
        const clockInDetails = {empName:employeeName, clockInFullTime: now ,inTime:now.toLocaleTimeString(), inDate: now.toLocaleDateString(), isClockIn: true, month:presentMonth+1, year:presentYear}


        const allClockLogs = JSON.parse(localStorage.getItem("clockInDetails")) || {};

        allClockLogs[employeeName] = clockInDetails;
        localStorage.setItem("clockInDetails" , JSON.stringify(allClockLogs))


        this.componentDidMount();
        
    }

    getEmpDetails = () => {
        const employeeName = this.props.empName;
        return fetch("http://localhost:5050/api/employee-list")
          .then(res => res.json())
          .then(data => {
            const employee = data.find(each => each.name === employeeName);
            if (employee) {
              return employee.pay;
            } else {
              throw new Error("Employee not found");
            }
          });
      };
      

    componentDidMount() {
        const employeeName = this.props.empName;
        const allClockIns = JSON.parse(localStorage.getItem("clockInDetails")) || {};
        const clockInData = allClockIns[employeeName];
        
      
        if (clockInData && clockInData.isClockIn) {
          this.setState({
            empName: employeeName,
            clockInFullTime: new Date(clockInData.clockInFullTime),
            inTime: clockInData.inTime,
            inDate: clockInData.inDate,
            isClockIn: true,
            month: clockInData.month,
            year: clockInData.year,
          });
        } else {
          this.setState({
            empName: employeeName,
            isClockIn: false,
          });
        }
      }

      componentDidUpdate(prevProps, prevState) {
        if (prevProps.empName !== this.props.empName) {
          this.loadClockInData(this.props.empName);

        }
        if (
            (prevState.month !== this.state.month || prevState.year !== this.state.year) &&
            this.state.month && this.state.year
          ) {
            this.renderEmployeeLogs();
          }
        
      }
      

      loadClockInData = (employeeName) => {
        const allClockIns = JSON.parse(localStorage.getItem("clockInDetails")) || {};
        const clockInData = allClockIns[employeeName];
        
        if (clockInData && clockInData.isClockIn) {
          this.setState({
            empName: employeeName,
            clockInFullTime: new Date(clockInData.clockInFullTime),
            inTime: clockInData.inTime,
            inDate: clockInData.inDate,
            isClockIn: true,
            month: clockInData.month,
            year: clockInData.year,
          });
        } else {
          this.setState({
            empName: employeeName,
            isClockIn: false,
            inTime: null,
            inDate: null,
            clockInFullTime: null,
            month: null,
            year: null
          });
        }
      };
      
      

      clockOutFnc = async () => {
        const { inDate, inTime, empName, clockInFullTime, month, year } = this.state;
        let now = new Date();
        const outDate = now.toLocaleDateString();
        const outTime = now.toLocaleTimeString();
        
        const fullSeconds = Math.floor((now - clockInFullTime) / 1000);
        const hours = Math.floor(fullSeconds / 3600);
        const minutes = Math.floor((fullSeconds % 3600) / 60);
        const seconds = fullSeconds % 60;
      
        const decimalHours = (hours + minutes / 60 + seconds / 3600).toFixed(2);
        const durationFormat = `${hours}:${minutes}:${seconds}`;
        
      
        try {
          const payRate = await this.getEmpDetails(); // Wait here
          const dayPayDollars = (decimalHours * payRate).toFixed(2);
          console.log(dayPayDollars)
          const fileNameFormat = `C:/Users/US Petro/OneDrive/Desktop/${month}-${year}.xlsx`;
      
          await fetch('http://localhost:5050/clock-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: empName,
              clockInDate: inDate,
              clockInTime: inTime,
              clockOutTime: outTime,
              clockOutDate: outDate,
              TotalHours: durationFormat,
              fileNameFormat,
              decimalHours,
              dayPayDollars,
            }),
          });

          await this.renderEmployeeLogs();
      
          // Remove from localStorage
          const allClockIns = JSON.parse(localStorage.getItem('clockInDetails')) || {};
          delete allClockIns[empName];
          localStorage.setItem('clockInDetails', JSON.stringify(allClockIns));
      
          // Reset state (this triggers re-render and shows Clock In again)
          this.setState({
            empName: '',
            isClockIn: false,
            inTime: null,
            inDate: null,
            outTime: null,
            outDate: null,
            clockInFullTime: null,
            payRate: 0,
          });
      
        } catch (error) {
          console.error("Error during logout/clockOut:", error);
        }
        
        
      };
      

      renderEmployeeLogs = () => {
        const employeeName = this.props.empName;
        const {month, year} = this.state

        const fileNameFormat = `C:/Users/US Petro/OneDrive/Desktop/${month}-${year}.xlsx`;
      
        return fetch("http://localhost:5050/api/employee-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileNameFormat, sheetName: employeeName }),
        })
          .then(res => res.json())
          .then(data => {
            const dates = data.map(d => d.clockInDate);
            const inTimes = data.map(d => d.clockInTime);
            const outTimes = data.map(d => d.clockOutTime);
            const workingTimes = data.map(d => d.hoursInDecimal);
            const allPay = data.map(d => d.dayPay);
            this.setState({
              allDates: dates,
              allIn: inTimes,
              allOut: outTimes,
              allTotalTime: workingTimes,
              allPay: allPay
            });
          });
      };
      

    render(){
        const {empName, inTime, inDate, isClockIn, allDates, allIn, allOut, allTotalTime, allPay} = this.state;

        return(
        <div>
            <nav className="navbar">
                <button className="back-btn" onClick={() => this.props.navigate('/')}>Back</button>
                <h1 className="nav-title">Time Sheet</h1>
            </nav>
            <div>
                
                <h3>{this.props.empName}</h3>
            </div>
            
            <div>
                
                <DateTime></DateTime>

                
                {isClockIn?(<button onClick={this.clockOutFnc}>Clock Out</button>):
                (<button onClick={this.clockInFnc}>Clock In</button>)}
                
                {isClockIn?(<div>
                    <h4> Today You Started At </h4>
                    <h1>{inDate} {inTime} </h1>
                    <h3>Enjoy Your Shift</h3>
                    </div>):
                (<h4>Go ahead and Clock In</h4>)}
            </div>


            <div className="employee-logs">
                <div className="header">
                    <div className="header-row">DATE</div>
                    <div className="header-row">IN</div> 
                    <div className="header-row">OUT</div> 
                    <div className="header-row">TOTAL HOURS</div> 
                    <div className="header-row">PAY PER DAY</div> 
                </div>
                <div className="time-logs">
                    
                    <div className="row">{allDates.map((each, index)=><div key={index}>{each}</div>)}</div>
                    <div className="row">{allIn.map((each, index)=><div key={index}>{each}</div>)}</div>
                    <div className="row">{allOut.map((each, index)=><div key={index}>{each}</div>)}</div>
                    <div className="row">{allTotalTime.map((each, index)=><div key={index}>{each}</div>)}</div>
                    <div className="row">{allPay.map((each, index)=><div key={index}>{each}</div>)}</div>
                </div>
            </div>


        </div>)
    }
}

export default EmployeeHome