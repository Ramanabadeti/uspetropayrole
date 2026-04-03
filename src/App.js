import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SelectEmployee from './components/SelectEmployee'; // or EmployeeHomeWrapper if you're skipping selection
import EmployeeHomeWrapper from './components/EmployeeHomeWrapper';
import Admin from './components/Admin';
import './App.css';
import Login from './components/Login';
import PunchWayShowcase from './components/PunchWayShowcase';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* <Route path="/" element={<SelectEmployee />} /> */}
          <Route path = '/' element={<SelectEmployee/>}/>
          <Route path = '/admin' element={<Admin/>}/>
          <Route path='/login' element={<Login/>} />
          <Route path="/employee/:name" element={<EmployeeHomeWrapper />} />
          <Route path='/showcase' element={<PunchWayShowcase />} />

        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;