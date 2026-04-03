import React from "react";
import "./index.css";
import loginImg from "./images/login page.png";
import employeeImg from "./images/employee page.png";
import adminImg from "./images/admin page.png";
import editImg from "./images/edit page.png";

const features = [
  {
    title: "Employee Time Tracking",
    desc: "Employees can log in, clock in, clock out, and view their work history without losing active session data after refresh.",
  },
  {
    title: "Admin Time Corrections",
    desc: "Admins can edit incorrect clock-in and clock-out records, and the system automatically recalculates hours and pay.",
  },
  {
    title: "SQLite Database",
    desc: "Attendance and payroll data are stored locally in SQLite instead of Excel, making the system more reliable and easier to manage.",
  },
  {
    title: "Offline-First Workflow",
    desc: "PunchWay is built to keep working even when internet access is unavailable, which is ideal for small business environments.",
  },
  {
    title: "Payroll Notes & PDF Reports",
    desc: "Admins can add payroll notes, track payments, generate PDF summaries, and keep better records.",
  },
  {
    title: "Historical Data Import",
    desc: "Older Excel-based payroll data can be imported into the database so the system maintains complete history.",
  },
];

const stats = [
  { label: "Offline-capable", value: "Yes" },
  { label: "Database", value: "SQLite" },
  { label: "Admin edits", value: "Enabled" },
  { label: "Historical import", value: "Supported" },
];

const stack = [
  "React.js",
  "Node.js",
  "Express.js",
  "SQLite",
  "REST APIs",
  "JavaScript",
  "HTML/CSS",
];

const screens = [
  {
    title: "Login Page",
    text: "Secure login for employees and admin.",
    image: loginImg
  },
  {
    title: "Employee Dashboard",
    text: "Employees can clock in and view work logs.",
    image: employeeImg
  },
  {
    title: "Admin Dashboard",
    text: "Admin can manage payroll and edit entries.",
    image: adminImg
  },
  {
    title: "Edit Entry",
    text: "Admin can correct late clock-ins.",
    image: editImg
  }
];

function PunchWayShowcase() {
  return (
    <div className="showcase-page">
        <nav className="nav">
  <h2>PunchWay</h2>

  {/* <div>
    <a href="#features">Features</a>
    <a href="#screens">Screens</a>
    <a href="#stack">Tech</a>
  </div> */}
</nav>
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-left">
            <p className="badge">Offline-first fullstack payroll solution</p>
            <h1>PunchWay</h1>
            <h2>Employee Time Tracking & Payroll System</h2>
            <p className="hero-text">
              PunchWay is a modern payroll and attendance system for small
              businesses. It helps employees clock in and out easily while
              giving admins a reliable way to review hours, edit incorrect
              entries, calculate payroll, and manage records.
            </p>

            <div className="hero-buttons">
              <button>View Features</button>
              <button className="secondary-btn">See Architecture</button>
            </div>

            <div className="stats-grid">
              {stats.map((item) => (
                <div key={item.label} className="stat-card">
                  <h3>{item.value}</h3>
                  <p>{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-right">
            <div className="dashboard-preview">
              <div className="preview-header">
                <div>
                  <p className="small-label">Admin Overview</p>
                  <h3>March Payroll Summary</h3>
                </div>
                <span className="status-badge">Payroll Ready</span>
              </div>

              <div className="summary-cards">
                <div className="summary-card">
                  <p>Total Hours</p>
                  <h4>162.75</h4>
                </div>
                <div className="summary-card">
                  <p>Total Pay</p>
                  <h4>$2441.25</h4>
                </div>
                <div className="summary-card">
                  <p>Corrections</p>
                  <h4>5</h4>
                </div>
              </div>

              <div className="mini-table">
                <div className="mini-table-header">
                  <span>Name</span>
                  <span>Date</span>
                  <span>In</span>
                  <span>Out</span>
                  <span>Status</span>
                </div>
                <div className="mini-table-row">
                  <span>Ramana</span>
                  <span>03/14/2026</span>
                  <span>09:00 AM</span>
                  <span>05:30 PM</span>
                  <span>Completed</span>
                </div>
                <div className="mini-table-row">
                  <span>OP</span>
                  <span>03/14/2026</span>
                  <span>09:10 AM</span>
                  <span>05:15 PM</span>
                  <span>Corrected</span>
                </div>
                <div className="mini-table-row">
                  <span>John</span>
                  <span>03/14/2026</span>
                  <span>08:55 AM</span>
                  <span>05:05 PM</span>
                  <span>Completed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="problem-section">
        <div className="section-heading">
          <p className="badge light">Problem & Solution</p>
          <h2>Why PunchWay was built</h2>
          <p>
            Small businesses often manage attendance and payroll using manual
            methods or Excel sheets. That creates payroll mistakes, makes editing
            difficult, and becomes unreliable when internet access is unavailable.
            PunchWay replaces that with a clean fullstack system built for real
            business use.
          </p>
        </div>

        <div className="problem-grid">
          <div className="info-box">
            <h3>For Employees</h3>
            <p>
              A simple workflow for logging in, clocking in, clocking out, and
              checking work history.
            </p>
          </div>
          <div className="info-box">
            <h3>For Admins</h3>
            <p>
              A reliable interface for reviewing hours, correcting entries,
              calculating pay, and managing payroll records.
            </p>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="section-heading center">
          <p className="badge light">Features</p>
          <h2>Built for real payroll workflows</h2>
          <p>
            PunchWay combines attendance tracking, payroll review, correction tools,
            and local database storage into one system.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature) => (
            <div key={feature.title} className="feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="screens-section">
        <div className="section-heading">
          <p className="badge light">Product Screens</p>
          <h2>Show the product clearly</h2>
          <p>
            These blocks can be replaced with your actual PunchWay screenshots.
          </p>
        </div>

        <div className="screens-grid">
          {screens.map((screen) => (
            <div key={screen.title} className="screen-card">
             <img src={screen.image} className="screen-img" alt={screen.title} />
              <h3>{screen.title}</h3>
              <p>{screen.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="architecture-section">
        <div className="section-heading center dark-text">
          <p className="badge dark">Architecture</p>
          <h2>Clean fullstack architecture</h2>
          <p>
            PunchWay is designed so the frontend handles the user experience,
            the backend manages business logic and APIs, and SQLite stores data
            locally for reliable offline operation.
          </p>
        </div>

        <div className="architecture-grid">
          <div className="architecture-card">
            <h3>React Frontend</h3>
            <p>
              Employee and admin interfaces for clock-in, payroll review,
              editing, and reporting.
            </p>
          </div>
          <div className="architecture-card">
            <h3>Node + Express Backend</h3>
            <p>
              Handles attendance APIs, payroll logic, and admin correction routes.
            </p>
          </div>
          <div className="architecture-card">
            <h3>SQLite Database</h3>
            <p>
              Stores employees, active sessions, time entries, and admin edit history locally.
            </p>
          </div>
        </div>
      </section>

      <section className="stack-section">
        <div className="section-heading">
          <p className="badge light">Tech Stack</p>
          <h2>Built with practical fullstack tools</h2>
          <p>
            The project uses tools that are simple, reliable, and realistic for
            business software development.
          </p>
        </div>

        <div className="stack-list">
          {stack.map((item) => (
            <span key={item} className="stack-badge">
              {item}
            </span>
          ))}
        </div>
      </section>

      <footer className="showcase-footer">
        <p>PunchWay — Employee Time Tracking & Payroll Showcase</p>
        <p>Built with React, Node.js, Express, and SQLite</p>
      </footer>
    </div>
  );
}

export default PunchWayShowcase;