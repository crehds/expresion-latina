import React from 'react';
import '../css/template.css';

export default function Template(props) {
  return (
    <div className={props.classContainer}>
      {props.content.map((content, index) => {
        if (props.gridActive === index - 6) {
          return (
            <div className={`${props.classChild} grid-active`} key={content.id}>
              {content[props.keyword]}
            </div>
          );
        }
        if (props.gridActive === index + 1) {
          return (
            <div className={`${props.classChild} grid-active`} key={content.id}>
              {content[props.keyword]}
            </div>
          );
        }
        return (
          <div className={props.classChild} key={content.id}>
            {content[props.keyword]}
          </div>
        );
      })}
    </div>
  );
}
