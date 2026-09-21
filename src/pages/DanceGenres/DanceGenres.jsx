import { Component } from 'react';
import { Route, Routes } from 'react-router-dom';

import { classGenres } from '../../data';
import { DanceVideos, Genres } from './components';

// Kept as a class on purpose: pages in this codebase are class components
// while the migration to hooks is still pending. Dropping the constructor and
// componentDidMount that only copied static data into state left nothing but
// render(), which is what the rule objects to.
// eslint-disable-next-line react/prefer-stateless-function
class DanceGenres extends Component {
  render() {
    return (
      <Routes>
        <Route path="/" element={<Genres danceGenres={classGenres} />} />
        {/* Addressed by slug: a display name like "Latin Urban" arrives
            percent-encoded and matches no genre. */}
        <Route path="/:genreSlug/videos" element={<DanceVideos />} />
      </Routes>
    );
  }
}

export default DanceGenres;
