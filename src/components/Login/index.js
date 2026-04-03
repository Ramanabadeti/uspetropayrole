import { Component } from 'react';
import './index.css'

class Login extends Component {
  state = {
    username: '',
    password: '',
    errorMsg: '',
    showError: false,
    logInUsers: []
  };

  componentDidMount() {
    fetch("http://localhost:5050/api/employees")
      .then(res => res.json())
      .then(data => {
        console.log("Loaded users:", data); // Optional: for debugging
        this.setState({ logInUsers: data });
      })
      .catch(err => console.error("Failed to load employee list:", err));
  }

  onChangeUsername = (event) => this.setState({ username: event.target.value });
  onChangePassword = (event) => this.setState({ password: event.target.value });

  onSubmitForm = (event) => {
    event.preventDefault();
    const { username, password, logInUsers } = this.state;

    const matchedUser = logInUsers.find(user =>
      user.name?.toLowerCase().trim() === username.toLowerCase().trim() &&
      user.password?.toString().trim() === password.trim()
    );

    if (matchedUser) {
        localStorage.setItem("logInUser", JSON.stringify(matchedUser));
      
        // ✅ Force full page reload so App.js can read the new user
        if (matchedUser.role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = `/employee/${matchedUser.name}`;
        }
      }else{
        this.setState({ showError: true, errorMsg: "Invalid Username Or Password"})
      }
      
  };

  render() {
    const { errorMsg, showError } = this.state;

    return (
      <div className="login-page">
      <div className="loginContainer">
        <img
            src='/image.png' // or "/logo.png" if from public
            alt="US Petro Logo"
            className="login-logo"
        />
        <h1>US PETRO</h1> {/* ⬅️ now outside the form */}
        <form onSubmit={this.onSubmitForm} className="loginForm">
          <label htmlFor='username'>Username</label>
          <input
            onChange={this.onChangeUsername}
            id='username'
            type='text'
            placeholder='Enter username'
            required
          />
          <label htmlFor='password'>Password</label>
          <input
            onChange={this.onChangePassword}
            id='password'
            type='password'
            placeholder='Enter password'
            required
          />
          <button type='submit'>Log In</button>
          {showError && <p>{errorMsg}</p>}
        </form>
      </div>
    </div>
    );
  }
}

export default Login;