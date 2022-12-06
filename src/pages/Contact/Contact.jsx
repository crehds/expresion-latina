import { Component } from 'react';
import Info from './components/Info';
import Map from './components/Map';

import './css/contact.css';

const CONTACT_COMPONENTS = {
  info: <Info />,
  map: <Map />,
};

class Contact extends Component {
  constructor(props) {
    super(props);
    this.state = {
      content: 'map',
    };
  }

  handleContent = (content) => (
    this.setState({ content })
  );

  showContent = () => {
    const { content } = this.state;
    const childToRender = CONTACT_COMPONENTS[content];
    return childToRender;
  };

  render() {
    return (
      <div className="contact">
        <button
          id="mapa"
          className="contact__option"
          type="button"
          onClick={() => this.handleContent('map')}
        >
          <h3 className="heading-xs">Mapa</h3>
        </button>
        <button
          id="mapa"
          className="contact__option"
          type="button"
          onClick={() => this.handleContent('info')}
        >
          <h3 className="heading-xs">Info</h3>
        </button>
        {this.showContent()}
      </div>
    );
  }
}

export default Contact;
