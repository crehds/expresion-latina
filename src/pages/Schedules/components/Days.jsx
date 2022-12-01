import DAYS from '../api/days';

import '../css/days.css';

function Days() {
  return (
    <div className="days">
      {DAYS.map((day) => (
        <div key={day.id}>
          {day.name}
        </div>
      ))}
    </div>
  );
}
export default Days;
