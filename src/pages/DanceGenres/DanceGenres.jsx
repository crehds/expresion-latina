import { Component } from 'react';
import { Route, Routes } from 'react-router-dom';
import DANCE_GENRES from './api/danceGenres';
import { DanceVideos, Genres } from './components';

import './css/dance-genres.css';

class DanceGenres extends Component {
  constructor(props) {
    super(props);
    this.state = {
      danceGenres: [],
    };
  }

  componentDidMount() {
    this.setState({ danceGenres: DANCE_GENRES });
  }

  render() {
    const { danceGenres } = this.state;

    return (
      <Routes>
        <Route
          path="/"
          element={<Genres danceGenres={danceGenres} />}
        />
        <Route path="/:danceGenreId/videos" element={<DanceVideos />} />
      </Routes>

    );
  }
}

export default DanceGenres;
