import { Component } from 'react';

import { Page } from '../../components';
import { whatsappLink } from '../../data';
import { getActiveDays, getSessionsForWeekday, hasPublishedSchedule } from '../../data/selectors';
import AttendanceProvider from '../../features/attendance/composition/AttendanceProvider';
import AttendanceReadError from '../../features/attendance/ui/AttendanceReadError';
import InactiveMembershipNotice from '../../features/attendance/ui/InactiveMembershipNotice';
import SessionAttendance from '../../features/attendance/ui/SessionAttendance';
import DayAgenda from './components/DayAgenda';
import DayPicker from './components/DayPicker';
import WeekColumns from './components/WeekColumns';

import './css/schedules.css';

const WIDE_SCREEN = '(min-width: 768px)';

/** Today when the academy teaches today, otherwise the first day it does. */
function initialWeekday(days) {
  const today = new Date().getDay();
  if (days.some((day) => day.weekday === today)) return today;
  return days[0]?.weekday ?? today;
}

// What goes under each class: the attendance control of a signed-in member. It
// renders nothing for anyone else, so the card is what it was without it. Above the
// schedule, two notices of the same kind: the read failure and a membership that is
// not active (said once here, not on every card). Both render nothing otherwise.
const renderSessionAction = (session) => (
  <SessionAttendance session={session} whatsappLink={whatsappLink} />
);

class ScheduleView extends Component {
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
        <Page title="Horarios" className="schedules">
          <p className="text-md schedules__empty">
            Todavía no publicamos el horario de esta semana.
          </p>
        </Page>
      );
    }

    // Only one layout is rendered. Shipping both and hiding one with CSS would
    // put the entire week in the DOM of every phone.
    if (isWide) {
      return (
        <Page title="Horarios" lead="Las clases de la semana, día por día." className="schedules">
          <AttendanceReadError />
          <InactiveMembershipNotice whatsappLink={whatsappLink} />
          <WeekColumns
            days={this.days}
            sessionsByWeekday={getSessionsForWeekday}
            currentWeekday={currentWeekday}
            renderSessionAction={renderSessionAction}
          />
        </Page>
      );
    }

    const selectedDay = this.days.find((day) => day.weekday === selectedWeekday);

    return (
      <Page title="Horarios" lead="Elige un día para ver sus clases." className="schedules">
        <AttendanceReadError />
        <InactiveMembershipNotice whatsappLink={whatsappLink} />
        <DayPicker
          days={this.days}
          selectedWeekday={selectedWeekday}
          onSelect={this.handleSelectDay}
        />
        {selectedDay && (
          <DayAgenda
            day={selectedDay}
            sessions={getSessionsForWeekday(selectedWeekday)}
            renderSessionAction={renderSessionAction}
          />
        )}
      </Page>
    );
  }
}

// The provider sits here, and not in App.jsx, so that it exists only on this page.
// It is inert for anyone without a signed-in member and never starts the session.
function Schedules() {
  return (
    <AttendanceProvider>
      <ScheduleView />
    </AttendanceProvider>
  );
}

export default Schedules;
