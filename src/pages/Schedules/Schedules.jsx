import { Component } from 'react';
import createAdaptedSchedules from './adapters/schedules';
import DAYS from './api/days';
import HOURS from './api/hours';
import SCHEDULES from './api/schedules';
import Classes from './components/Classes';
import Hours from './components/Hours';
import ScheduleIcon from './components/ScheduleIcon';

import './css/schedules.css';

function buildEmptySchedule() {
  const initialSchedule = Array.from({ length: 12 }, (_, i) => {
    const days = Array.from({ length: 7 }, (foo, j) => ({ id: `${i}-${j}` }));
    return days;
  });

  return initialSchedule;
}

function handleSchedules(formattedSchedule) {
  const scheduleToSet = buildEmptySchedule();
  formattedSchedule.forEach((schedule) => {
    const hourIndex = HOURS.findIndex((hour) => hour.hour === schedule.hour);
    const dayIndex = DAYS.findIndex((day) => day.name === schedule.day);
    const { id } = schedule;

    scheduleToSet[hourIndex][dayIndex] = {
      id,
      ...schedule,
    };
  });
  return scheduleToSet;
}

class Schedules extends Component {
  constructor(props) {
    super(props);
    this.state = {
      currentDay: new Date().getDay(),
      schedules: buildEmptySchedule(),
    };
  }

  componentDidMount() {
    const schedules = createAdaptedSchedules(SCHEDULES);
    const formattedSchedules = handleSchedules(schedules);
    this.setState({ schedules: formattedSchedules });
  }

  render() {
    const { currentDay, schedules } = this.state;
    return (
      <div className="schedules">
        <ScheduleIcon />
        <Hours />
        <Classes classes={schedules} currentDay={currentDay} />
      </div>
    );
  }
}

export default Schedules;
