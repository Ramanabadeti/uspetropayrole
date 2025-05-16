import { Component } from "react";
import ShardContext from "../../Context";

class Admin extends Component {
  static contextType = ShardContext;  
  state = {
    addNewEmpId: "",
    addNewEmpName: "",
    addNewEmpPay: "",
    GetEmpId:null,
    empData:[]
  };

  onChangeId = (event) => {
    this.setState({ addNewEmpId: event.target.value });
  };

  onChangeName = (event) => {
    this.setState({ addNewEmpName: event.target.value });
  };

  onChangePay = (event) => {
    this.setState({ addNewEmpPay: event.target.value });
  };

  AddEmpDetails = (event) => {
    event.preventDefault();
    const { addNewEmpId, addNewEmpName, addNewEmpPay} = this.state;
    const { setEmpDetails } = this.context;

    const newEmployeeDetails = {
      num: addNewEmpId,
      name: addNewEmpName,
      pay: addNewEmpPay
    };

    setEmpDetails((prev) => [...prev, newEmployeeDetails]);


    this.setState({
      addNewEmpId: "",
      addNewEmpName: "",
      addNewEmpPay: ""
    });
  };

  displayEmpDetails= ()=>{
    fetch("http://localhost:5050/api/employees")
    .then(res => res.json())
    .then(data => {
      this.setState({ empData: data });
    })
    .catch(err => {
      console.error("Failed to load employee data:", err);
    });
  };

  render() {
    const { empDetails } = this.context;
    const { addNewEmpId, addNewEmpName, addNewEmpPay } = this.state;

    return (
      <div>
        <h1>Admin Settings</h1>
        
        {/* <div className="add-employee">
          <form onSubmit={this.AddEmpDetails}>
            <label htmlFor="newEmpId">New Employee ID</label>
            <input
              value={addNewEmpId}
              onChange={this.onChangeId}
              id="newEmpId"
              type="number"
            />
            <br/>
            <label htmlFor="newEmpName">New Employee Name</label>
            <input
              value={addNewEmpName}
              onChange={this.onChangeName}
              id="newEmpName"
              type="text"
            />
            <br/>
            <label htmlFor="newEmpPay">New Employee Pay</label>
            <input
              value={addNewEmpPay}
              onChange={this.onChangePay}
              id="newEmpPay"
              type="number"
            />
            <br/>
            <button type="submit">ADD</button>
          </form>
        </div>

        <div className="set-pay-rate">
            <h3>ID | Name | PayRate</h3>
          {empDetails.map((each) => (
            
            <p key={each.num}>
              {each.num}.{each.name}:${each.pay}
            </p>
          ))}
        </div> */}
          <button onClick={this.displayEmpDetails}>Get Employee Details</button>
          <div>
            <h2>Employee Details from Excel</h2>
            {Array.isArray(this.state.empData) && this.state.empData.map((each, index) => (
            <p key={index}>
                {each.no} | {each.name} | ${each.pay}
            </p>
            ))}
          </div>
      </div>
    );
  };
}

export default Admin;
