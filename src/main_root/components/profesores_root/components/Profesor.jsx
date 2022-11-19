import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import '../css/profesor.css';
import logoDefault from '../../../../assets/imageseymreact/logoEL.png';

export default class Profesor extends PureComponent {
  componentDidMount() {
    this.handleLoad();
  }

  componentDidUpdate(prevProps) {
    const { src } = this.props;
    if (prevProps.src !== src) {
      this.handleLoad();
    }
  }

  handleLoad = () => {
    const { id } = this.props;
    const img = document.getElementById(`prof-image-${id}`);
    img.addEventListener('load', this.setSrc, false);
  };

  setSrc = (event) => {
    const { src } = this.props;
    const elementImg = event.target;
    elementImg.src = src;
    elementImg.removeEventListener('load', this.setSrc, false);
  };

  render() {
    const { handleProfile, id, profesor } = this.props;
    return (
      <div
        id={`prof-${id}`}
        className="div-profesor"
        onClick={handleProfile}
        onKeyDown={handleProfile}
        role="presentation"
      >
        <img
          id={`prof-image-${id}`}
          alt={profesor}
          src={logoDefault}
          style={{
            backgroundImage:
              'linear-gradient(110.3deg,rgba(72, 85, 99, 1) 8.8%,rgba(127, 146, 166, 1) 95.1%',
          }}
        />
      </div>
    );
  }
}

Profesor.propTypes = {
  id: PropTypes.number.isRequired,
  profesor: PropTypes.string.isRequired,
  src: PropTypes.string.isRequired,
  handleProfile: PropTypes.func.isRequired,
};
