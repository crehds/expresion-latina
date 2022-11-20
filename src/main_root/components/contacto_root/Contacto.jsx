import { Component } from 'react';
import PropTypes from 'prop-types';
import Mapa from './components/Mapa';
import Online from './components/Online';

import './css/contacto.css';

function showContact(contact) {
  switch (contact) {
    case 'online':
      return <Online />;
    default:
      return <Mapa />;
  }
}

export default class Contact extends Component {
  constructor(props) {
    super(props);
    this.state = {
      content: 'mapa',
    };
  }

  componentWillUnmount() {
    const { handleLoading } = this.props;
    handleLoading();
  }

  setContent = (event) => {
    const { id } = event.target;
    this.setState({
      content: id,
    });
  };

  render() {
    const { content } = this.state;
    return (
      <div className="contacto">
        <div
          id="mapa"
          className="pestaña"
          onClick={this.setContent}
          onKeyDown={this.setContent}
          role="button"
          tabIndex={0}
        >
          <h3>Mapa</h3>
        </div>
        <div
          id="online"
          className="pestaña"
          onClick={this.setContent}
          onKeyDown={this.setContent}
          role="button"
          tabIndex={0}
        >
          <h3>Online</h3>

        </div>
        {showContact(content)}
      </div>
    );
  }
}

Contact.propTypes = {
  handleLoading: PropTypes.func.isRequired,
};
