import React from 'react';
import '../css/day.css';
import Template from './Template';

export default function Day(props) {
  const { hours } = props.hours;
  const classContainer = 'day';
  const classChild = 'day-hour';
  return (
    <Template
      content={hours}
      classContainer={classContainer}
      classChild={classChild}
      keyword='range'
    />
  );
}
