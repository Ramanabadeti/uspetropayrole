import { useNavigate, useParams } from "react-router-dom";
import EmployeeHome from "./Home";

function EmployeeHomeWrapper() {
  const { name } = useParams(); // e.g., /employee/Ramana → name = "Ramana"
  const navigate = useNavigate();
  return <EmployeeHome empName={name} navigate={navigate}  />;

}

export default EmployeeHomeWrapper;
