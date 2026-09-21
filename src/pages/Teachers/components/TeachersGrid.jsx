import PropTypes from 'prop-types';

import Teacher from './Teacher';

import '../css/teachers-grid.css';

/**
 * Every teacher at once, for screens with room for them.
 *
 * Whoever teaches this month comes first and is labelled as current; the rest
 * follow under their own heading. Both lists are derived from the schedule, so
 * nobody maintains a roster by hand.
 */
function TeachersGrid({ teachers, activeIds, showProfile }) {
  const current = teachers.filter((teacher) => activeIds.has(teacher.id));
  const past = teachers.filter((teacher) => !activeIds.has(teacher.id));

  const section = (title, list, modifier) => (list.length === 0 ? null : (
    <section className={`teachers-grid__section teachers-grid__section--${modifier}`}>
      <h2 className="heading-xs teachers-grid__heading">{title}</h2>
      <ul className="teachers-grid__list">
        {list.map((teacher) => (
          <li key={teacher.id}>
            <Teacher showProfile={showProfile} teacher={teacher} />
          </li>
        ))}
      </ul>
    </section>
  ));

  return (
    <div className="teachers-grid">
      {section('Dictando este mes', current, 'current')}
      {section('Pasaron por la academia', past, 'past')}
    </div>
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
