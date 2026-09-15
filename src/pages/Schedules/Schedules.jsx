import { Component } from 'react';

import { days } from '../../data';
import { buildWeekMatrix, getActiveTimeSlots, hasPublishedSchedule } from '../../data/selectors';
import ScheduleIcon from './components/ScheduleIcon';

import './css/schedules.css';

class Schedules extends Component {
  constructor(props) {
    super(props);
    this.state = {
      currentWeekday: new Date().getDay(),
    };
  }

  render() {
    const { currentWeekday } = this.state;

    // No grid is allocated up front. Rows come from the hours that actually
    // hold a class, columns from the days, and every cell is a list that is
    // usually empty. The page used to allocate 12x7 cells and fill all of
    // them, which is why its data source invented a class for each one.
    const slots = getActiveTimeSlots();
    const matrix = buildWeekMatrix();

    if (!hasPublishedSchedule()) {
      return (
        <div className="schedules">
          <ScheduleIcon />
          <p className="text-md schedules__empty">
            Todavía no publicamos el horario de esta semana.
          </p>
        </div>
      );
    }

    return (
      <div className="schedules">
        <ScheduleIcon />
        <table className="schedules__table">
          <thead>
            <tr>
              <th scope="col" className="schedules__corner"><span className="sr-only">Hora</span></th>
              {days.map((day) => (
                <th
                  key={day.id}
                  scope="col"
                  className={`schedules__day${day.weekday === currentWeekday ? ' schedules__day--today' : ''}`}
                >
                  {day.shortName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, rowIndex) => (
              <tr key={slot.id}>
                <th scope="row" className="schedules__hour">{slot.label}</th>
                {days.map((day, columnIndex) => {
                  const classes = matrix[rowIndex][columnIndex];
                  return (
                    <td key={`${slot.id}-${day.id}`} className="schedules__cell">
                      {classes.map((session) => (
                        <span key={session.id} className="text-sm schedules__class">
                          {session.genre.name}
                        </span>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

export default Schedules;
