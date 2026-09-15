import * as academy from './index';

/**
 * @typedef {object} EnrichedSession
 * @property {string} id
 * @property {object} day    resolved day entity
 * @property {object} slot   resolved time slot entity
 * @property {object} genre  resolved genre entity
 * @property {object|null} teacher resolved teacher entity, when the class has one
 */

/**
 * Builds the derived views over a set of academy entities.
 *
 * Takes its data rather than reaching for the module so the views can be
 * exercised against a deliberately sparse fixture: the real dataset cannot
 * cover a closed day or a double-booked hour without inventing classes.
 */
export function createSelectors(data) {
  const {
    days, timeSlots, sessions, getDayById, getTimeSlotById, getGenreById, getTeacherById,
  } = data;

  const byStart = (a, b) => a.slot.start.localeCompare(b.slot.start);

  function enrich(session) {
    const day = getDayById(session.dayId);
    const slot = getTimeSlotById(session.slotId);
    const genre = getGenreById(session.genreId);

    // A session referencing something that does not exist is dropped rather
    // than rendered half-blank. The academy.json test makes that unreachable
    // for committed data, but generated data reaches this at runtime.
    if (!day || !slot || !genre) return null;

    return {
      ...session,
      day,
      slot,
      genre,
      teacher: session.teacherId ? getTeacherById(session.teacherId) ?? null : null,
    };
  }

  let enrichedCache = null;

  function allEnriched() {
    if (!enrichedCache) enrichedCache = sessions.map(enrich).filter(Boolean);
    return enrichedCache;
  }

  /**
   * Classes on one calendar weekday, earliest first.
   * A day the academy is closed returns [] — that is data, not an error.
   *
   * @param {number} weekday 0 is Sunday, matching Date#getDay()
   * @returns {EnrichedSession[]}
   */
  function getSessionsForWeekday(weekday) {
    return allEnriched()
      .filter((session) => session.day.weekday === weekday)
      .sort(byStart);
  }

  /**
   * Time slots that hold at least one class, so the grid never renders a row
   * that is empty across every day.
   */
  function getActiveTimeSlots() {
    const used = new Set(allEnriched().map((session) => session.slot.id));
    return timeSlots.filter((slot) => used.has(slot.id));
  }

  /**
   * One row per active time slot, one column per day in display order.
   *
   * Every cell is an array. An empty array means no class, which is the normal
   * case and needs no special handling by the caller; more than one entry means
   * concurrent classes in different rooms.
   *
   * @returns {EnrichedSession[][][]}
   */
  function buildWeekMatrix() {
    const activeSlots = getActiveTimeSlots();
    const enriched = allEnriched();

    return activeSlots.map((slot) => days.map((day) => enriched.filter(
      (session) => session.slot.id === slot.id && session.day.id === day.id,
    )));
  }

  /** Whether any class at all is published. */
  function hasPublishedSchedule() {
    return allEnriched().length > 0;
  }

  return {
    getSessionsForWeekday,
    getActiveTimeSlots,
    buildWeekMatrix,
    hasPublishedSchedule,
  };
}

const selectors = createSelectors(academy);

export const {
  getSessionsForWeekday,
  getActiveTimeSlots,
  buildWeekMatrix,
  hasPublishedSchedule,
} = selectors;
