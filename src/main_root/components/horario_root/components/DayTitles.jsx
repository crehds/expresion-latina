import React from 'react';
import '../css/daytitles.css';
import Template from './Template';

export default function DayTitles(props) {
  const { days } = props.days;
  const classContainer = 'day-titles';
  const classChild = 'day-title';
  return (
    <Template
      content={days}
      classContainer={classContainer}
      classChild={classChild}
      keyword='abbreviation'
      gridActive={props.actualDay}
    />
  );
}
