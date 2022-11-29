import DAYS from './days';
import HOURS from './hours';
import DANCE_GENRES from '../../DanceGenres/api/danceGenres';

const danceGenresLength = DANCE_GENRES.length;

const SCHEDULES = DAYS.map((day) => {
  const hours = HOURS.slice().map((hour) => {
    const random = Math.floor(Math.random() * danceGenresLength);
    const danceGenre = DANCE_GENRES[random];
    return {
      ...hour,
      danceGenre,
    };
  });

  return {
    ...day,
    hours,
  };
});

export default SCHEDULES;
