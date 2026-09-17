import PropTypes from 'prop-types';

import Teacher from './Teacher';

import '../css/teachers-grid.css';

/**
 * Every teacher at once, for screens with room for them.
 *
 * The carousel exists because four large cards are all a phone can hold. A
 * desktop can show the whole faculty, and paging through nine people four at a
 * time is a small-screen compromise imposed on a big screen.
 */
function TeachersGrid(props) {
  const { teachers, showProfile } = props;

  return (
    <ul className="teachers-grid">
      {teachers.map((teacher) => (
        <li key={teacher.id}>
          <Teacher showProfile={showProfile} teacher={teacher} />
        </li>
      ))}
    </ul>
  );
}

TeachersGrid.propTypes = {
  teachers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
  showProfile: PropTypes.func.isRequired,
};

export default TeachersGrid;
