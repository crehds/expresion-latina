import React, { Component } from 'react';
import './css/horario.css';
import Day from './components/Day';
import DayTitles from './components/DayTitles';
import DaySchedule from './components/DaySchedule';
import hours from '../../../api/hours.json';
import days from '../../../api/days.json';
import generos from '../../../api/generos.json';
import IconSchedule from './components/IconSchedule';

export default class Horario extends Component {
  state = {
    actualDay: new Date().getDay()
  };

  componentWillUnmount() {
    this.props.handleLoading();
  }

  render() {
    return (
      <div className='horario'>
        <IconSchedule />
        <DayTitles days={days} actualDay={this.state.actualDay} />
        <Day hours={hours} />
        <DaySchedule
          generos={generos}
          daysLength={days.days.length}
          hoursLength={hours.hours.length}
          actualDay={this.state.actualDay}
        />
      </div>
    );
  }
}
