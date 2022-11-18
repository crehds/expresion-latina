import { Component } from 'react';
import PropTypes from 'prop-types';

import Videos from './components/Videos';
import Generos from './components/Generos';
import { GENEROS } from '../../../api/clases.json';
import { VIDEOS } from '../../../api/videos.json';

function addAnimation(elements) {
  elements.forEach((element, i) => setTimeout(
    (e) => {
      e.style.animationName = 'opacidad';
      e.style.animationDuration = '4s';
      e.style.aniamtionIterationCount = '1';
      e.style.animationTimingFunction = 'steps(8)';
      e.style.opacity = '1';
    },
    100 * i,
    element,
  ));
}

export default class Clases extends Component {
  constructor(props) {
    super(props);
    this.state = {
      contentClases: 'Generos',
      generos: GENEROS,
      generoSelected: '',
      ref: [],
    };
  }

  componentDidUpdate(prevProps, prevState) {
    const { ref } = this.state;
    if (prevState !== this.state) {
      addAnimation(ref);
    }
  }

  componentWillUnmount() {
    const { handleLoading } = this.props;
    handleLoading();
  }

  toggleContent = (event) => {
    const { contentClases } = this.state;
    if (contentClases === 'Generos') {
      this.setGeneroSelected(event.target.id);
      return setTimeout(() => this.setState({ contentClases: 'Videos' }), 1000);
    }
    return this.setState({ contentClases: 'Generos' });
  };

  setGeneroSelected = (generoSelected) => {
    this.setState({ generoSelected });
  };

  setGeneroRef = (element) => this.setState((prevState) => ({ ref: [...prevState.ref, element] }));

  cleanRef = () => {
    this.setState({ ref: [] });
  };

  render() {
    const { generos, contentClases, generoSelected } = this.state;

    if (contentClases === 'Generos') {
      return (
        <Generos
          generos={generos}
          toggleContent={this.toggleContent}
          setGeneroRef={this.setGeneroRef}
        />
      );
    }
    return (
      <Videos
        videos={VIDEOS}
        toggleContent={this.toggleContent}
        contentTitle={generoSelected}
        cleanRef={this.cleanRef}
      />
    );
  }
}

Clases.propTypes = {
  handleLoading: PropTypes.func.isRequired,
};
