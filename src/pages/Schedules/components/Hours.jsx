import HOURS from '../api/hours';

import '../css/hours.css';

function Hours() {
  return (
    <div className="hours">
      {HOURS.map((hour) => (
        <div key={hour.id} className="hour">
          <p
            style={{ whiteSpace: 'pre', margin: 'auto' }}
            className="text-sm"
          >
            {hour.hour}
          </p>
        </div>
      ))}
    </div>
  );
}

export default Hours;
