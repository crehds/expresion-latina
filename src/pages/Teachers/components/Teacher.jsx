import PropTypes from 'prop-types';

import '../css/teacher.css';

function Teacher(props) {
  const { showProfile, teacher } = props;
  return (
    <div
      className="teacher"
      onClick={() => showProfile(teacher)}
      onKeyDown={() => showProfile(teacher)}
      role="presentation"
    >
      <img
        className="teacher__image"
        src={teacher?.src}
        alt="teacher"
        style={{ backgroundImage: 'linear-gradient(110.3deg,rgba(72, 85, 99, 1) 8.8%,rgba(127, 146, 166, 1) 95.1%' }}
      />
    </div>
  );
}
Teacher.propTypes = {
  showProfile: PropTypes.func.isRequired,
  teacher: PropTypes.instanceOf(Object).isRequired,
};
export default Teacher;
