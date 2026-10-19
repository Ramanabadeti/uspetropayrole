import { useParams } from "react-router-dom";
import EmployeeHome from "./Home";

function EmployeeHomeWrapper() {
  const { name } = useParams(); // /employee/Ramana -> name = "Ramana"
  return <EmployeeHome empName={name} />;
}

export default EmployeeHomeWrapper;
