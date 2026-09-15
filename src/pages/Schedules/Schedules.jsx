import { Component } from 'react';

import { getActiveDays, getSessionsForWeekday, hasPublishedSchedule } from '../../data/selectors';
import DayAgenda from './components/DayAgenda';
import DayPicker from './components/DayPicker';
import ScheduleIcon from './components/ScheduleIcon';
import WeekColumns from './components/WeekColumns';

import './css/schedules.css';

const WIDE_SCREEN = '(min-width: 768px)';

/** Today when the academy teaches today, otherwise the first day it does. */
function initialWeekday(days) {
  const today = new Date().getDay();
  if (days.some((day) => day.weekday === today)) return today;
  return days[0]?.weekday ?? today;
}

class Schedules extends Component {
  constructor(props) {
    super(props);

    this.days = getActiveDays();
    this.mediaQuery = window.matchMedia(WIDE_SCREEN);

    this.state = {
      selectedWeekday: initialWeekday(this.days),
      // Read before the first paint, so the right layout renders straight away
      // instead of flashing the other one.
      isWide: this.mediaQuery.matches,
    };
  }

  componentDidMount() {
    this.mediaQuery.addEventListener('change', this.handleViewportChange);
  }

  componentWillUnmount() {
    this.mediaQuery.removeEventListener('change', this.handleViewportChange);
  }

  handleViewportChange = (event) => this.setState({ isWide: event.matches });

  handleSelectDay = (selectedWeekday) => this.setState({ selectedWeekday });

  render() {
    const { selectedWeekday, isWide } = this.state;
    const currentWeekday = new Date().getDay();

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

    // Only one layout is rendered. Shipping both and hiding one with CSS would
    // put the entire week in the DOM of every phone.
    if (isWide) {
      return (
        <div className="schedules">
          <ScheduleIcon />
          <WeekColumns
            days={this.days}
            sessionsByWeekday={getSessionsForWeekday}
            currentWeekday={currentWeekday}
          />
        </div>
      );
    }

    const selectedDay = this.days.find((day) => day.weekday === selectedWeekday);

    return (
      <div className="schedules">
        <ScheduleIcon />
        <DayPicker
          days={this.days}
          selectedWeekday={selectedWeekday}
          onSelect={this.handleSelectDay}
        />
        {selectedDay && (
          <DayAgenda day={selectedDay} sessions={getSessionsForWeekday(selectedWeekday)} />
        )}
      </div>
    );
  }
}

export default Schedules;
