import { Link } from 'react-router-dom';

import { getNextOpenDay } from '../../../data/selectors';
import SessionCard from '../../Schedules/components/SessionCard';

import '../css/today-strip.css';

const MAX_VISIBLE = 4;

/**
 * What is on today, on the landing page, without a click.
 *
 * On a day the academy is closed this rolls forward to the next open one and
 * says so, which is more useful than an empty state on a Sunday. If nothing at
 * all is published the section removes itself rather than announcing a gap.
 */
function TodayStrip() {
  const open = getNextOpenDay(new Date().getDay());

  if (!open) return null;

  const { day, sessions, isToday } = open;
  const visible = sessions.slice(0, MAX_VISIBLE);
  const hidden = sessions.length - visible.length;

  return (
    <section className="today-strip" aria-labelledby="today-strip-heading">
      <header className="today-strip__header">
        <h2 className="heading-sm today-strip__heading" id="today-strip-heading">
          {isToday ? `Hoy, ${day.name.toLowerCase()}` : `Próxima clase: ${day.name}`}
        </h2>
        <Link className="text-md today-strip__link" to="/schedules">
          Ver la semana
        </Link>
      </header>

      <ul className="today-strip__list">
        {visible.map((session) => (
          <li key={session.id}>
            <SessionCard session={session} />
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <p className="text-sm today-strip__more">
          {`y ${hidden} ${hidden === 1 ? 'clase más' : 'clases más'} este día`}
        </p>
      )}
    </section>
  );
}

export default TodayStrip;
