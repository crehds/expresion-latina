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
   * Teachers with at least one class in the published schedule.
   *
   * Who currently teaches is answered by the schedule itself, so nobody has to
   * keep a second list in step: a teacher who stops appearing stops being
   * current, on the next import, with no edit anywhere.
   *
   * @returns {Set<string>}
   */
  function getActiveTeacherIds() {
    return new Set(
      allEnriched()
        .map((session) => session.teacher?.id)
        .filter(Boolean),
    );
  }

  /**
   * The soonest day that actually holds classes, starting from `fromWeekday`.
   *
   * The landing page answers "what can I dance today?" and must answer it on a
   * Sunday too, so a closed day rolls forward rather than rendering an empty
   * state. Seven steps cover the whole week; if none of them hold a class the
   * schedule is unpublished and the caller gets null.
   *
   * @param {number} fromWeekday 0 is Sunday, matching Date#getDay()
   * @returns {{day: object, sessions: EnrichedSession[], isToday: boolean}|null}
   */
  function getNextOpenDay(fromWeekday) {
    for (let step = 0; step < 7; step += 1) {
      const weekday = (fromWeekday + step) % 7;
      const daySessions = getSessionsForWeekday(weekday);

      if (daySessions.length > 0) {
        return { day: daySessions[0].day, sessions: daySessions, isToday: step === 0 };
      }
    }

    return null;
  }

  /**
   * Days that hold at least one class, in display order.
   *
   * The academy currently teaches Monday to Friday, so the week view shows
   * five columns. Adding a Saturday class adds its column; this is derived,
   * never configured.
   *
   * @returns {object[]}
   */
  function getActiveDays() {
    const used = new Set(allEnriched().map((session) => session.day.id));
    return days.filter((day) => used.has(day.id));
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
    getNextOpenDay,
    getActiveTeacherIds,
    getActiveDays,
    getActiveTimeSlots,
    buildWeekMatrix,
    hasPublishedSchedule,
  };
}

const selectors = createSelectors(academy);

/**
 * The teachers of a genre who are actually teaching it this month.
 *
 * A teacher keeps their genreIds after they stop appearing in the schedule, so
 * the plain lookup in the data layer answers "who has ever been linked to this
 * style". The faculty page shows only who is dictating this month, and the
 * class pages saying something different is the site contradicting itself.
 *
 * Composed here rather than inside createSelectors on purpose: that factory
 * takes an injectable fixture so the schedule views can be exercised against
 * sparse data, and this needs the real genre links, not the schedule shape.
 */
export function getActiveTeachersByGenreId(genreId) {
  const active = selectors.getActiveTeacherIds();

  return academy.getTeachersByGenreId(genreId).filter((teacher) => active.has(teacher.id));
}

export const {
  getSessionsForWeekday,
  getNextOpenDay,
  getActiveTeacherIds,
  getActiveDays,
  getActiveTimeSlots,
  buildWeekMatrix,
  hasPublishedSchedule,
} = selectors;
