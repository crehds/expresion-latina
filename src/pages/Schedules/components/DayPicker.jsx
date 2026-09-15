import PropTypes from 'prop-types';

import '../css/day-picker.css';

/**
 * Day chips for narrow screens.
 *
 * Toggle buttons rather than a tablist: a tablist promises arrow-key roving
 * focus, and a half-implemented one misleads the people who rely on it.
 */
function DayPicker(props) {
  const { days, selectedWeekday, onSelect } = props;

  return (
    <div className="day-picker" role="group" aria-label="Elegir día">
      {days.map((day) => {
        const isSelected = day.weekday === selectedWeekday;
        return (
          <button
            key={day.id}
            type="button"
            className={`text-sm day-picker__chip${isSelected ? ' day-picker__chip--selected' : ''}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(day.weekday)}
          >
            <span aria-hidden="true">{day.shortName}</span>
            <span className="sr-only">{day.name}</span>
          </button>
        );
      })}
    </div>
  );
}

DayPicker.propTypes = {
  days: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    shortName: PropTypes.string.isRequired,
    weekday: PropTypes.number.isRequired,
  })).isRequired,
  selectedWeekday: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default DayPicker;
