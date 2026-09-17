import PropTypes from 'prop-types';

import placeholder from '../../../assets/images/posters/Poster_Casting.jpg';

import '../css/poster.css';

function Poster({ filename, url, priority = false }) {
  // A remote poster whose file has gone missing would otherwise render as a
  // broken-image icon inside the carousel.
  const handleError = (event) => {
    const image = event.target;
    if (image.src.endsWith(placeholder)) return;
    image.src = placeholder;
  };

  return (
    <div className="poster">
      <img
        className="poster__img"
        src={url}
        alt={filename}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
      />
    </div>
  );
}

Poster.propTypes = {
  filename: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  // The first slide is visible immediately, so it must not be deferred.
  priority: PropTypes.bool,
};

export default Poster;
