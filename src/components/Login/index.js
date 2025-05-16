import {Component} from 'react';
import {Navigate, Redirect, Route} from 'react-router-dom';

class Login extends Component{
    state = {isCorrectCred:false, errMgs:"", showErrMgs: false, username:'', password:''}

    onChangeUsername=(event)=>{
        this.setState({username: event.target.value});
    } 

    onchangePass=(event)=>{
        this.setState({password: event.target.value});
    }

    onSubmitForm= (event)=>{
        event.preventDefault()
        const {username, password} = this.state;
        if(username==="ramana" && password ==="Mega4@244"){
            this.setState({isCorrectCred: true, showErrMgs:false})
        }else if(username==="ramana" && password !=="Mega4@244"){
            this.setState({isCorrectCred:false, errMgs:"wrong password", showErrMgs:true})
        }else if(username!=="ramana" && password ==="Mega4@244"){
            this.setState({isCorrectCred:false, errMgs:"wrong username", showErrMgs:true})
        }else if(username!=="ramana" && password !=="Mega4@244"){
            this.setState({isCorrectCred:false, errMgs:"wrong username and password", showErrMgs:true})
        }else {
            this.setState({isCorrectCred:false, errMgs:"please enter username and password", showErrMgs:true})
        }
    }

    render(){
        const {errMgs, showErrMgs, isCorrectCred} = this.state;
        if(isCorrectCred== true){
            return <Navigate to="/"/>
        }
        
        return(
            <div>
                <h1>US PETRO</h1>
                <form onSubmit={this.onSubmitForm} className='loginContainer'>
                    <label htmlFor='username'>Username</label>
                    <input onChange={this.onChangeUsername} id='username' type='text' placeholder='enter username ......' />
                    <label htmlFor="password">Password</label>
                    <input onChange={this.onchangePass} id='password' type='password' placeholder='enter password .....'/>
                    <button type='submit'>LogIn</button>
                </form>
                {showErrMgs&& <p>{errMgs}</p>}
            </div>
        )
    }
}

export default Login;