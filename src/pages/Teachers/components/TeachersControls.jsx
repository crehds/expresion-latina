import PropTypes from 'prop-types';

import '../css/teachers-controls.css';

function TeachersControls(props) {
  const { handleTeachersCarousel } = props;
  return (
    <>
      <div className="teacher-control teacher-control--left">
        <button
          type="button"
          className="teacher-control__button"
          onClick={() => handleTeachersCarousel('left')}
        >
          <i className="icon-keyboard_arrow_left teacher-control__icon " />
        </button>
      </div>
      <div className="teacher-control teacher-control--right">
        <button
          type="button"
          className="teacher-control__button"
          onClick={() => handleTeachersCarousel('right')}
        >
          <i
            className="icon-keyboard_arrow_right teacher-control__icon"
          />
        </button>
      </div>
    </>
  );
}
TeachersControls.propTypes = {
  handleTeachersCarousel: PropTypes.func.isRequired,
};
export default TeachersControls;
