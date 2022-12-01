import HOURS from '../api/hours';

import '../css/hours.css';

function Hours() {
  return (
    <div className="hours">
      {HOURS.map((hour) => (
        <div key={hour.id} style={{ display: 'flex' }}>
          <p style={{ whiteSpace: 'pre', margin: 'auto' }}>{hour.hour}</p>
        </div>
      ))}
    </div>
  );
}

export default Hours;
