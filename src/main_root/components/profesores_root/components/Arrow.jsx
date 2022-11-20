import PropTypes from 'prop-types';
import '../css/arrow.css';

export default function Arrow(props) {
  const { handleArrow } = props;
  return (
    <>
      <div className="arrow-container left">
        <i
          id="left"
          className="icon-keyboard_arrow_left"
          onClick={handleArrow}
          onKeyDown={handleArrow}
          role="button"
          tabIndex={0}
          aria-label="arrow-left-icon"
        />
      </div>
      <div className="arrow-container right">
        <i
          id="right"
          className="icon-keyboard_arrow_right"
          onClick={handleArrow}
          onKeyDown={handleArrow}
          role="button"
          tabIndex={0}
          aria-label="arrow-left-icon"
        />
      </div>
    </>
  );
}

Arrow.propTypes = {
  handleArrow: PropTypes.func.isRequired,
};
