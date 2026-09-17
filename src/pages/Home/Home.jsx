import Carousel from 'nuka-carousel';
import { Component } from 'react';

import createAdaptedPoster from './adapters/posters';
import FALLBACK_POSTERS from './api/fallbackPosters';
import Hero from './components/Hero';
import Poster from './components/Poster';
import TodayStrip from './components/TodayStrip';
import getPosters from './services/posters';

import './css/home.css';

export default class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      posters: FALLBACK_POSTERS,
    };
  }

  componentDidMount() {
    this.abortController = new AbortController();
    this.handlePosters();
  }

  componentWillUnmount() {
    // handlePosters resolves after an await, so leaving the page mid-request
    // would otherwise set state on an unmounted component.
    this.abortController.abort();
  }

  handlePosters = async () => {
    try {
      const posters = await getPosters({ signal: this.abortController.signal });
      const adaptedPosters = posters.map(createAdaptedPoster).filter(Boolean);

      // A successful but empty response is not a legitimate state for this
      // site, so keep the bundled posters rather than emptying the carousel.
      if (!adaptedPosters.length) return;

      this.setState({ posters: adaptedPosters });
    } catch (error) {
      // The bundled posters are already on screen, so there is nothing to undo.
      if (import.meta.env.DEV) console.warn(error.message);
    }
  };

  render() {
    const {
      posters,
    } = this.state;
    return (
      <main className="home">
        <Hero />

        <TodayStrip />

        <section className="home__posters" aria-label="Novedades de la academia">
          <Carousel
            autoplay
            style={{ height: '100%' }}
            wrapAround
            autoplayInterval={8000}
            pauseOnHover
            defaultControlsConfig={{
              pagingDotsStyle: {
                fill: 'var(--accent)',
                padding: '0px 20px',
              },
            }}
            renderCenterLeftControls={({ previousSlide }) => (
              <div className="home__arrow home__arrow--left">
                <i
                  className="icon-keyboard_arrow_left home__arrow-icon"
                  onClick={previousSlide}
                  onKeyDown={previousSlide}
                  role="button"
                  tabIndex={0}
                  aria-label="arrow-left-icon"
                />
              </div>
            )}
            renderCenterRightControls={({ nextSlide }) => (
              <div className="home__arrow home__arrow--right">
                <i
                  className="icon-keyboard_arrow_right home__arrow-icon"
                  onClick={nextSlide}
                  onKeyDown={nextSlide}
                  role="button"
                  tabIndex={0}
                  aria-label="arrow-right-icon"
                />
              </div>
            )}
          >
            {posters.map((poster, index) => (
              <Poster
                key={poster.id}
                filename={poster.filename}
                url={poster.url}
                priority={index === 0}
              />
            ))}
          </Carousel>
        </section>
      </main>
    );
  }
}
