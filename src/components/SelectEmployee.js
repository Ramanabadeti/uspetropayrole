import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SelectEmployee.css";

function SelectEmployee() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/login");
  }, [navigate]);

  return <div className="select-employee-container"></div>;
}

export default SelectEmployee;