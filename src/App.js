import { Route, BrowserRouter, Routes } from 'react-router-dom';
import { useState } from 'react';
import Login from './components/Login';
import Admin from './components/Admin';
import Home from './components/Home'; // Will become employee-specific
import SelectEmployee from './components/SelectEmployee';
import ShardContext from './Context';
import './App.css';
import EmployeeHomeWrapper from './components/EmployeeHomeWrapper';

function App() {
  const [empDetails, setEmpDetails] = useState([]);

  return (
    <div className="App">
      <ShardContext.Provider value={{ empDetails, setEmpDetails }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/" element={<SelectEmployee />} />
            <Route path="/employee/:name" element={<EmployeeHomeWrapper />} />
          </Routes>
        </BrowserRouter>
      </ShardContext.Provider>
    </div>
  );
}

export default App;
