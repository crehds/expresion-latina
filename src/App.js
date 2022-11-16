import React, { Component } from 'react';
// import logo from './logo.svg';
import Header from './header_root/header';
import './App.css';
import Main from './main_root/Main';
import Footer from './footer_root/footer';

export default class App extends Component {
  state = {
    content: 'Login',
    headerFunc: undefined
  };

  handleContent = (state) => {
    this.setState({
      content: state
    });
  };

  handleHeadProfile = (func) => this.setState({ headerFunc: func });

  render() {
    const { content } = this.state;
    return (
      <div className='App'>
        <Header
          handleContent={this.handleContent}
          handleHeadProfile={this.handleHeadProfile}
        />
        <Main content={content} headerFunc={this.state.headerFunc} />
        <Footer />
      </div>
    );
  }
}
