import { Component } from 'react';
import PropTypes from 'prop-types';
import './css/reviews.css';

// optimize if you can
function handleLoad() {
  const img = document.getElementById('user-1');
  const userImg = new Image();
  userImg.onload = () => {
    img.src = userImg.src;
    setTimeout(() => {
      img.style.display = 'block';
      img.style.animationName = 'aparitionLogo2';
      img.style.animationTimingFunction = 'cubic-bezier(0.445, 0.05, 0.55, 0.95)';
      img.style.animationDuration = '1s';
      img.style.animationIterationCount = '1';
    }, 1000);
  };
  userImg.src = 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?cs=srgb&dl=actitud-apariencia-atractivo-belleza-415829.jpg&fm=jpg';
}

export default class Reviews extends Component {
  componentDidMount() {
    handleLoad();
  }

  componentWillUnmount() {
    const { handleLoading } = this.props;
    handleLoading();
  }

  render() {
    return (
      <div className="reseñas">
        <textarea
          className="reseña-user"
          name="reseña"
          id="1"
          cols="30"
          rows="5"
          placeholder="Aun sin contenido"
          value="Excelente escuela. Todos los profesores están bien capacitados ,excepto un
          tal mishel, que dice ser campeón."
          readOnly
        />

        <div className="randomuser">
          <div className="randomuser-image">
            <img id="user-1" src="" alt="userrostro" />
          </div>
          <div className="randomuser-data">Evelyn</div>
        </div>
      </div>
    );
  }
}

Reviews.propTypes = {
  handleLoading: PropTypes.func.isRequired,
};
