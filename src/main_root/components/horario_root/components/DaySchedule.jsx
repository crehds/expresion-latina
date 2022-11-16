import React from 'react';
import Template from './Template';
import '../css/dayschedule.css';

export default function DaySchedule(props) {
  const { generos } = props.generos;
  const itemsSchedule = [];

  for (let index = 0; index < props.daysLength; index++) {
    if (props.actualDay === index - 6) {
      itemsSchedule.push(
        <Template
          content={generos}
          classContainer='day-schedule grid-active'
          classChild='day-schedule-item'
          keyword='name'
          key={index}
        />
      );
    } else {
      if (props.actualDay === index + 1) {
        itemsSchedule.push(
          <Template
            content={generos}
            classContainer='day-schedule grid-active'
            classChild='day-schedule-item'
            keyword='name'
            key={index}
          />
        );
      } else {
        itemsSchedule.push(
          <Template
            content={generos}
            classContainer='day-schedule'
            classChild='day-schedule-item'
            keyword='name'
            key={index}
          />
        );
      }
    }
  }

  return <div className='days-schedule'>{itemsSchedule}</div>;
}
