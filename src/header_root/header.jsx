import { Component } from 'react';
import PropTypes from 'prop-types';
import './css/header.css';
import Menu from './components/menu';
import Logo from './components/logo';

export default class Header extends Component {
  constructor(props) {
    super(props);

    this.state = {
      profile: false,
    };
  }

  componentDidMount() {
    const { handleHeadProfile } = this.props;
    handleHeadProfile(this.handleStateProfile);
  }

  handleStateProfile = (state) => this.setState({ profile: state });

  render() {
    const { handleContent } = this.props;
    const { profile } = this.state;
    return (
      <header className="App-header">
        <Logo />
        <Menu
          profile={profile}
          handleContent={handleContent}
        />
      </header>
    );
  }
}

Header.propTypes = {
  handleContent: PropTypes.func.isRequired,
  handleHeadProfile: PropTypes.func.isRequired,
};
