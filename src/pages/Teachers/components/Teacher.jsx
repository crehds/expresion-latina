import PropTypes from 'prop-types';

import '../css/teacher.css';

const IMAGE_BACKGROUND = 'linear-gradient(110.3deg,rgba(72, 85, 99, 1) 8.8%,rgba(127, 146, 166, 1) 95.1%';

function Teacher(props) {
  const { showProfile, teacher } = props;
  return (
    <div
      className="teacher"
      onClick={() => showProfile(teacher)}
      onKeyDown={() => showProfile(teacher)}
      role="presentation"
    >
      {teacher.image ? (
        <img
          className="teacher__image"
          src={teacher.image}
          alt={teacher.name}
          style={{ backgroundImage: IMAGE_BACKGROUND }}
        />
      ) : (
        // Teaching here does not require the academy to have a photo on file.
        <div className="teacher__placeholder" aria-label={teacher.name}>
          <span aria-hidden="true">{teacher.initials}</span>
        </div>
      )}
      <p className="text-sm teacher__name">{teacher.name}</p>
    </div>
  );
}

Teacher.propTypes = {
  showProfile: PropTypes.func.isRequired,
  teacher: PropTypes.shape({
    name: PropTypes.string.isRequired,
    image: PropTypes.string,
    initials: PropTypes.string,
  }).isRequired,
};

export default Teacher;
