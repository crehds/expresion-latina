import Carousel from 'nuka-carousel';
import { Component } from 'react';

import createAdaptedPosters from './adapters/posters';
import Poster from './components/Poster';
import getPosters from './services/posters';

import './css/home.css';

export default class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      slideIndex: 0,
      posters: [],
    };
  }

  componentDidMount() {
    this.handlePosters();
  }

  handlePosters = async () => {
    const posters = await getPosters();
    const adaptedPosters = posters.map(createAdaptedPosters);
    return this.setState({
      posters: adaptedPosters,
    });
  };

  render() {
    const {
      posters,
      slideIndex,
    } = this.state;
    let timer;
    return (
      <Carousel
        autoplay
        style={{ height: '100%' }}
        slideIndex={slideIndex}
        beforeSlide={() => {
          clearTimeout(timer);
        }}
        afterSlide={(sIndex) => {
          if (sIndex === posters.length - 1) {
            timer = setTimeout(() => this.setState({ slideIndex: 0 }), 5000);
          } else {
            this.setState({ slideIndex: sIndex });
          }
        }}
        defaultControlsConfig={{
          pagingDotsStyle: {
            fill: 'rgba(95, 209, 249, 1)',
            padding: '0px 20px',
          },
        }}
        renderCenterLeftControls={({ previousSlide }) => (
          <div className="posters_arrow">
            <i
              className="icon-keyboard_arrow_left"
              onClick={previousSlide}
              onKeyDown={previousSlide}
              role="button"
              tabIndex={0}
              aria-label="arrow-left-icon"
            />
          </div>
        )}
        renderCenterRightControls={({ nextSlide }) => (
          <div className="posters_arrow">
            <i
              className="icon-keyboard_arrow_right"
              onClick={nextSlide}
              onKeyDown={nextSlide}
              role="button"
              tabIndex={0}
              aria-label="arrow-right-icon"
            />
          </div>
        )}
      >
        {posters.map((poster) => (
          <Poster
            key={poster.id}
            filename={poster.filename}
            url={poster.url}
          />
        ))}
      </Carousel>
    );
  }
}
