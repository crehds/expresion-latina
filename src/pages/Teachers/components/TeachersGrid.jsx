import PropTypes from 'prop-types';

import Teacher from './Teacher';

import '../css/teachers-grid.css';

/**
 * The teachers dictating this month.
 *
 * Who that is comes from the schedule, so nobody maintains a roster by hand:
 * a teacher with no session this month is not on this page, and publishing
 * next month's schedule is all it takes to put them back.
 *
 * There used to be a second list under "Pasaron por la academia" holding
 * everyone else. The academy does not want past teachers presented as part of
 * the faculty, so the page shows the current one only.
 */
function TeachersGrid({ teachers, activeIds, showProfile }) {
  const current = teachers.filter((teacher) => activeIds.has(teacher.id));

  if (current.length === 0) {
    return (
      <p className="text-md teachers-grid__empty">
        Todavía no publicamos quiénes dictan este mes.
      </p>
    );
  }

  return (
    <ul className="teachers-grid__list">
      {current.map((teacher) => (
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
  activeIds: PropTypes.instanceOf(Set).isRequired,
  showProfile: PropTypes.func.isRequired,
};

export default TeachersGrid;
