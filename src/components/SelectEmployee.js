import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/SelectEmployee.css"

function SelectEmployee() {
  const [employees, setEmployees] = useState([]);
  const navigate = useNavigate();

  const handleSelect = (e) => {
    const name = e.target.value;
    if (name) navigate(`/employee/${name}`);
  };

  useEffect(() => {
    fetch("http://localhost:5050/api/employee-list",)
      .then((res) => res.json())
      .then((data) => {
        console.log("Received from API:", data); 
        setEmployees(data);
      })
      .catch((err) => console.error("Failed to load employee list", err));
  }, []);

  return (
    <div className="select-employee-container">
        <div className="select-card">
            <h2>Select Employee</h2>
            <h6>Select your name to clock In</h6>
            <select onChange={handleSelect} className="employee-dropdown">
            <option value="">-- Select --</option>
            {employees.map((each, index) => (
                <option key={index} value={each.name}>{each.name}</option>
            ))}
            </select>
        </div>
</div>
  );
}

export default SelectEmployee;
