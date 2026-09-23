import { Component } from 'react';

import createAdaptedPoster from './adapters/posters';
import FALLBACK_POSTERS from './api/fallbackPosters';
import Hero from './components/Hero';
import PosterStrip from './components/PosterStrip';
import ReviewsStrip from './components/ReviewsStrip';
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

        <section className="home__posters" aria-labelledby="home-posters-heading">
          <h2 className="heading-md home__posters-heading" id="home-posters-heading">
            Novedades
          </h2>
          <PosterStrip posters={posters} />
        </section>

        <div className="home__band">
          <TodayStrip />
        </div>

        <ReviewsStrip />
      </main>
    );
  }
}
