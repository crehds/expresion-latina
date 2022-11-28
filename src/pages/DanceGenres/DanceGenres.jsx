import { Component } from 'react';
import { Route, Routes } from 'react-router-dom';
import DANCE_GENRES from './api/danceGenres';
import DanceGenre from './components/DanceGenre';

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
      <div className="dance-genres">
        <Routes>
          <Route
            path="/"
            element={danceGenres.map((danceGenre) => (
              <DanceGenre key={danceGenre.id} name={danceGenre.name} />
            ))}
          />
        </Routes>

      </div>
    );
  }
}

export default DanceGenres;
