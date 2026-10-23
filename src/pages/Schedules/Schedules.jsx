import { Component } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Page } from '../../components';
import { getTeacherById, whatsappLink } from '../../data';
import { getActiveDays, getSessionsForWeekday, hasPublishedSchedule } from '../../data/selectors';
import AttendanceProvider from '../../features/attendance/composition/AttendanceProvider';
import AttendanceLegend from '../../features/attendance/ui/AttendanceLegend';
import AttendanceReadError from '../../features/attendance/ui/AttendanceReadError';
import MembershipRequiredModal from '../../features/attendance/ui/MembershipRequiredModal';
import SessionAttendance from '../../features/attendance/ui/SessionAttendance';
import TeacherPanel from '../Teachers/components/TeacherPanel';
import DayAgenda from './components/DayAgenda';
import DayPicker from './components/DayPicker';
import WeekColumns from './components/WeekColumns';

import './css/schedules.css';

const WIDE_SCREEN = '(min-width: 768px)';

// The router state that marks a profile opened from this page, as opposed to one
// reached by a shared link.
const OPENED_FROM_SCHEDULE = 'openedFromSchedule';

/** Today when the academy teaches today, otherwise the first day it does. */
function initialWeekday(days) {
  const today = new Date().getDay();
  if (days.some((day) => day.weekday === today)) return today;
  return days[0]?.weekday ?? today;
}

// What goes under each class: the attendance control of a signed-in member. It
// renders nothing for anyone else, so the card is what it was without it.
const renderSessionAction = (session) => (
  <SessionAttendance session={session} whatsappLink={whatsappLink} />
);

// Where a teacher's name goes: back to this page with that teacher in the address,
// which opens the profile over the schedule (see Schedules below). The state says the
// visit began here, so that closing the profile can go back instead of forward.
const teacherLink = (teacher) => ({
  to: `/schedules?teacher=${encodeURIComponent(teacher.id)}`,
  state: { [OPENED_FROM_SCHEDULE]: true },
});

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
          <AttendanceLegend />
          <WeekColumns
            days={this.days}
            sessionsByWeekday={getSessionsForWeekday}
            currentWeekday={currentWeekday}
            renderSessionAction={renderSessionAction}
            teacherLink={teacherLink}
          />
        </Page>
      );
    }

    const selectedDay = this.days.find((day) => day.weekday === selectedWeekday);

    return (
      <Page title="Horarios" lead="Elige un día para ver sus clases." className="schedules">
        <AttendanceReadError />
        <AttendanceLegend />
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
            teacherLink={teacherLink}
          />
        )}
      </Page>
    );
  }
}

// The provider sits here, and not in App.jsx, so that it exists only on this page.
// It is inert for anyone without a signed-in member and never starts the session.
//
// Which teacher's profile is open lives in the address (?teacher=<id>), so the back
// button closes it and a link to it can be shared. The profile is a sibling of the
// schedule, not a wrapper around it: the search changing re-renders this component,
// but ScheduleView keeps its place in the tree, so the chosen day (and the scroll)
// stay put. Nothing in the app scrolls on a location change.
//
// An unknown id shows the schedule alone, the same as the teachers page does.
function Schedules() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const teacherId = searchParams.get('teacher');
  const teacher = teacherId ? getTeacherById(teacherId) : null;

  // Opened from a card: the previous entry is this page without the profile, so going
  // back is exactly what the back button would do. Reached by a link: there may be no
  // previous entry on this site at all, so drop the parameter in place instead.
  const closeProfile = () => {
    if (location.state?.[OPENED_FROM_SCHEDULE]) {
      navigate(-1);
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('teacher');
      return next;
    }, { replace: true });
  };

  return (
    <AttendanceProvider>
      <ScheduleView />
      {teacher && <TeacherPanel teacher={teacher} onClose={closeProfile} />}
      <MembershipRequiredModal whatsappLink={whatsappLink} />
    </AttendanceProvider>
  );
}

export default Schedules;
