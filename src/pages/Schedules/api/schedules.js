import DAYS from './days';
import HOURS from './hours';
import DANCE_GENRES from '../../DanceGenres/api/danceGenres';
import generateRandomNumber from '../../../utils/randomNumber';

const danceGenresLength = DANCE_GENRES.length;
const daysLength = DAYS.length;
const hoursLength = HOURS.length;
const scheduleLength = daysLength * hoursLength;

const schedule = [];

while (schedule.length < scheduleLength) {
  const randomD = generateRandomNumber(daysLength);
  const randomH = generateRandomNumber(hoursLength);
  const randomDc = generateRandomNumber(danceGenresLength);

  const newSchedule = {
    hour: HOURS[randomH].hour,
    day: DAYS[randomD].name,
    danceGenre: DANCE_GENRES[randomDc],
  };

  const index = schedule.find((cv) => cv?.hour === newSchedule.hour && cv?.day === newSchedule.day);

  if (!index) schedule.push({ id: schedule.length + 1, ...newSchedule });
}

export default schedule;
