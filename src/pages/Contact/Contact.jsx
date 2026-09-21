import { Component } from 'react';

import { Page } from '../../components';
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
    const { content } = this.state;
    return (
      <Page title="Contacto" className="contact">
        <div className="contact__tabs">
          <button
            className="contact__option"
            type="button"
            aria-pressed={content === 'map'}
            onClick={() => this.handleContent('map')}
          >
            <span className="heading-xs">Mapa</span>
          </button>
          <button
            className="contact__option"
            type="button"
            aria-pressed={content === 'info'}
            onClick={() => this.handleContent('info')}
          >
            <span className="heading-xs">Info</span>
          </button>
        </div>
        {this.showContent()}
      </Page>
    );
  }
}

export default Contact;
