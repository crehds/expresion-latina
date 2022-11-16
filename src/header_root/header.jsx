import React, { Component } from 'react';
import './css/header.css';
import Menu from './components/menu';
import Logo from './components/logo';

export default class Header extends Component {
  state = {
    profile: false
  };

  handleStateProfile = (state) => this.setState({ profile: state });

  componentDidMount() {
    this.props.handleHeadProfile(this.handleStateProfile);
  }
  render() {
    return (
      <header className='App-header'>
        <Logo />
        {
          <Menu
            profile={this.state.profile}
            handleContent={this.props.handleContent}
          />
        }
      </header>
    );
  }
}
