import PropTypes from 'prop-types';
import '../css/iconconfig.css';

export default function IconConfig(props) {
  const { handleDisplayConfig } = props;
  return (
    <i
      className="icon3-settings icon-modal-config"
      onClick={handleDisplayConfig}
      onKeyDown={handleDisplayConfig}
      role="button"
      tabIndex={0}
      aria-label="icon-config"
    />
  );
}

IconConfig.propTypes = {
  handleDisplayConfig: PropTypes.func.isRequired,
};
