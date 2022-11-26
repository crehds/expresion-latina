import PropTypes from 'prop-types';

import '../css/poster.css';

function Poster(props) {
  const { filename, url } = props;
  return (
    <div className="poster">
      <img className="poster__img" src={url} alt={filename} />
    </div>
  );
}

Poster.propTypes = {
  filename: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
};

export default Poster;
