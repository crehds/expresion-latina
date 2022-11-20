import { Component } from 'react';
import PropTypes from 'prop-types';
import './css/horario.css';
import Day from './components/Day';
import DayTitles from './components/DayTitles';
import DaySchedule from './components/DaySchedule';
import { HOURS } from '../../../api/hours.json';
import { DAYS } from '../../../api/days.json';
import { GENEROS } from '../../../api/generos.json';
import IconSchedule from './components/IconSchedule';

export default class Horario extends Component {
  constructor(props) {
    super(props);
    this.state = {
      actualDay: new Date().getDay(),
    };
  }

  componentWillUnmount() {
    const { handleLoading } = this.props;
    handleLoading();
  }

  render() {
    const { actualDay } = this.state;
    return (
      <div className="horario">
        <IconSchedule />
        <DayTitles days={DAYS} actualDay={actualDay} />
        <Day hours={HOURS} />
        <DaySchedule
          generos={GENEROS}
          daysLength={DAYS.length}
          actualDay={actualDay}
        />
      </div>
    );
  }
}

Horario.propTypes = {
  handleLoading: PropTypes.func.isRequired,
};
