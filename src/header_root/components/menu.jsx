import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import '../css/menu.css';
import HamburgerMenu from './HamburgerMenu';
import Options from './Options';
import UserImage from './UserImage';

class Menu extends PureComponent {
  sendContent = (event) => {
    const { handleContent } = this.props;
    handleContent(event.target.id);
  };

  handleIsMenuActive = () => {
    const hamburger = document.getElementById('hamburger');
    const hamburgerClass = hamburger.classList;
    const menuClass = document.getElementById('menu').classList;

    // TODO: Optimized
    if (hamburgerClass.contains('is-active')) {
      hamburgerClass.remove('is-active');
      menuClass.remove('is-active');
      hamburger.style.animationName = 'none';
      document.removeEventListener('click', this.removeListener);
    } else {
      hamburgerClass.add('is-active');
      hamburger.style.animationName = 'gradientefect';
      menuClass.add('is-active');
      document.addEventListener('click', this.removeListener);
    }
  };

  removeListener = (event) => {
    const template = document.getElementById('menu').contains(event.target);
    if (!template) {
      this.handleIsMenuActive();
    }
  };

  render() {
    const { profile } = this.props;
    return (
      <div id="menu" className="menu">
        <HamburgerMenu handleIsMenuActive={this.handleIsMenuActive} />
        {profile && <UserImage />}
        <Options sendContent={this.sendContent} profile={profile} />
      </div>
    );
  }
}

export default Menu;

Menu.propTypes = {
  handleContent: PropTypes.func.isRequired,
  profile: PropTypes.bool.isRequired,
};
