import PropTypes from 'prop-types';
import { Grid } from './components';
import './css/loader.css';

const LOADERS = {
  grid: <Grid />,
};

function Loader({ loaderName }) {
  return (
    <div className="loader">
      {LOADERS[loaderName]}
    </div>
  );
}

Loader.propTypes = {
  loaderName: PropTypes.string.isRequired,
};

export default Loader;
