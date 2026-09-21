import academy from './academy.json';
import { resolveTeacherImage, resolveVideoAsset } from './assets';

/**
 * Freezes deeply, so a component that accidentally mutates shared content
 * fails loudly at the assignment instead of silently corrupting another page.
 * Modules run in strict mode, so the write throws rather than being ignored.
 */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.getOwnPropertyNames(value).forEach((key) => deepFreeze(value[key]));
    Object.freeze(value);
  }
  return value;
}

function indexById(collection) {
  return new Map(collection.map((entry) => [entry.id, entry]));
}

export const studio = deepFreeze({ ...academy.studio });

/**
 * The studio's WhatsApp as a link, or null when it has none.
 *
 * The schema makes every contact field but the name nullable, so the number
 * has to be checked before it is read. That check and the digits-only rule
 * wa.me wants were written out at each of the three call sites, which is two
 * chances to forget the guard and take a route down with a TypeError.
 */
export const whatsappLink = studio.whatsapp
  ? `https://wa.me/${studio.whatsapp.replace(/\D/g, '')}`
  : null;

/** Display order is array order; it is independent of the weekday numbers. */
export const days = deepFreeze(academy.days.map((day) => ({ ...day })));

export const timeSlots = deepFreeze(
  [...academy.timeSlots].sort((a, b) => a.start.localeCompare(b.start)),
);

export const genres = deepFreeze(academy.genres.map((genre) => ({ ...genre })));

/**
 * Genres students can enrol in. Excludes anything that occupies the schedule
 * without being a dance style, such as a cast rehearsal.
 */
export const classGenres = genres.filter((genre) => genre.kind !== 'rehearsal');

/** Up to two initials, for teachers the academy has no photo of yet. */
function initialsOf(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/**
 * Whole years between a birth date and today, or null when the academy has not
 * told us.
 *
 * Derived rather than stored: an age typed into a spreadsheet is wrong within
 * the year and nothing in the system can tell. Accepts a bare year too, since
 * that is often all anyone knows; the age is then correct to within one.
 */
function ageFrom(birthDate, today = new Date()) {
  if (!birthDate) return null;

  const [year, month = '01', day = '01'] = birthDate.split('-');
  const born = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(born.getTime())) return null;

  let age = today.getFullYear() - born.getFullYear();

  // Their birthday has not come round yet this year.
  const beforeBirthday = today.getMonth() < born.getMonth()
    || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;

  return age >= 0 && age < 120 ? age : null;
}

/** Each teacher carries its bundled image URL, resolved once at module load. */
export const teachers = deepFreeze(
  academy.teachers.map((teacher) => ({
    ...teacher,
    image: teacher.imageKey ? resolveTeacherImage(teacher.imageKey) : undefined,
    initials: initialsOf(teacher.name),
    age: ageFrom(teacher.birthDate),
    achievements: teacher.achievements ?? [],
  })),
);

export const videos = deepFreeze(
  academy.videos.map((video) => ({
    ...video,
    src: video.externalUrl || resolveVideoAsset(video.assetKey),
  })),
);

export const sessions = deepFreeze(academy.sessions.map((session) => ({ ...session })));

/**
 * What students have said. Empty until the academy adds any, which is why the
 * section that renders them removes itself rather than announcing a gap.
 */
export const reviews = deepFreeze((academy.reviews ?? []).map((review) => ({ ...review })));

const daysByWeekday = new Map(days.map((day) => [day.weekday, day]));
const daysById = indexById(days);
const slotsById = indexById(timeSlots);
const genresById = indexById(genres);
const genresBySlug = new Map(genres.map((genre) => [genre.slug, genre]));
const teachersById = indexById(teachers);
const videosById = indexById(videos);

/**
 * The single replacement for the hardcoded day arrays this codebase used to
 * carry in three places, two of them ordered differently from the third.
 *
 * @param {number} weekday 0 is Sunday, matching Date#getDay()
 */
export function getDayByWeekday(weekday) {
  return daysByWeekday.get(weekday);
}

export function getDayById(id) {
  return daysById.get(id);
}

export function getTimeSlotById(id) {
  return slotsById.get(id);
}

export function getGenreById(id) {
  return genresById.get(id);
}

/** Genres are addressed by slug in the URL, never by display name. */
export function getGenreBySlug(slug) {
  return genresBySlug.get(slug);
}

export function getTeacherById(id) {
  return teachersById.get(id);
}

export function getTeachersByGenreId(genreId) {
  return teachers.filter((teacher) => (teacher.genreIds ?? []).includes(genreId));
}

export function getVideoById(id) {
  return videosById.get(id);
}

/**
 * Videos explicitly tied to a genre, either by the video naming the genre or
 * by the genre listing the video.
 */
export function getVideosByGenreId(genreId) {
  const genre = getGenreById(genreId);
  const listed = (genre?.videoIds ?? []).map(getVideoById).filter(Boolean);
  const claimed = videos.filter((video) => video.genreId === genreId);

  return [...new Set([...listed, ...claimed])];
}

/**
 * The academy's own reel: footage belonging to the school rather than to one
 * style or one teacher.
 *
 * A genre page with none of its own shows these instead of an empty box. Most
 * styles have no footage yet, so without a fallback the page a visitor
 * reaches by pressing a class is blank more often than not.
 */
export function getAcademyVideos() {
  return videos.filter((video) => !video.genreId && !video.teacherId);
}

/**
 * Videos tied to one teacher, by the same two routes a genre uses: the video
 * naming the teacher, or the teacher listing the video.
 *
 * Two routes rather than one because the two sides are filled by different
 * people — the spreadsheet names a teacher's video on their own row, while a
 * video added by hand to academy.json is easier to point at its owner.
 */
export function getVideosByTeacherId(teacherId) {
  const teacher = getTeacherById(teacherId);
  const listed = (teacher?.videoIds ?? []).map(getVideoById).filter(Boolean);
  const claimed = videos.filter((video) => video.teacherId === teacherId);

  return [...new Set([...listed, ...claimed])];
}
