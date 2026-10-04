/**
 * Attendance occurrence identity (Design D1).
 *
 * A session (src/data/selectors.js) describes a recurring weekly class --
 * "Mondays, 19:00, Salsa, Sala 1". An occurrence pins that down to one real,
 * dated instance -- "Monday 2026-09-28". Its identity, (classDate,
 * startTime, genreId, roomKey), is built only here, from an enriched
 * session and a Lima calendar date, and never invented anywhere else: the
 * database mirrors the same tuple
 * (supabase/migrations/20260924150000_attendance_confirmations.sql).
 */

import {
  addDays, limaInstant, todayInLima, weekdayOf,
} from '../../../shared/limaCalendar';

const ROOM_KEY_MAX_LENGTH = 60;

/**
 * The fields of an occurrence's identity, in key order. The single source
 * of the key format: `occurrenceKey` joins them, and the schedule match
 * validates a confirmation against the same list.
 */
export const OCCURRENCE_KEY_FIELDS = Object.freeze(['classDate', 'startTime', 'genreId', 'roomKey']);

// Matches `normalise`'s diacritics strip in scripts/data/parse-workbook.mjs,
// which writes the same range with the literal combining characters. Here it
// is an escaped code point range so the source stays ASCII: both mean
// "Combining Diacritical Marks", U+0300-U+036F.
const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;

/**
 * The same slug algorithm as `toSlug` in scripts/data/build-academy.mjs
 * (via its `normalise` helper in scripts/data/parse-workbook.mjs),
 * reproduced rather than imported: the build script pulls in exceljs,
 * which has no place in this runtime domain code. Any change to the build
 * script's algorithm must be mirrored here.
 *
 * @param {string} value
 * @returns {string}
 */
function slugifyRoom(value) {
  const normalised = String(value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  return normalised
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * One dated instance of an enriched session.
 *
 * @param {object} session an enriched session (src/data/selectors.js):
 *   { day: { weekday }, slot: { start, end }, genre: { id, name }, room }
 * @param {string} isoDate the class date; must fall on the session's own
 *   weekday, or the resulting identity would describe a class that does
 *   not exist
 * @returns {{
 *   classDate: string, startTime: string, endTime: string, genreId: string,
 *   roomKey: string, genreName: string, roomLabel: string, startsAt: Date,
 * }}
 */
export function occurrenceOn(session, isoDate) {
  if (weekdayOf(isoDate) !== session.day.weekday) {
    throw new Error(
      `${isoDate} does not fall on this session's weekday (${session.day.weekday}).`,
    );
  }

  const roomKey = slugifyRoom(session.room);
  if (!roomKey || roomKey.length > ROOM_KEY_MAX_LENGTH) {
    throw new Error(`Session room does not produce a usable room key: ${JSON.stringify(session.room)}`);
  }

  return {
    classDate: isoDate,
    startTime: session.slot.start,
    endTime: session.slot.end,
    genreId: session.genre.id,
    roomKey,
    genreName: session.genre.name,
    roomLabel: session.room,
    startsAt: limaInstant(isoDate, session.slot.start),
  };
}

/**
 * The soonest occurrence of `session` that has not started yet: today, on
 * the Lima calendar, when today is the session's weekday and its start
 * time has not passed; the same weekday one week later otherwise.
 *
 * @param {object} session
 * @param {Date} now
 * @returns {ReturnType<occurrenceOn>}
 */
export function nextOccurrence(session, now) {
  const today = todayInLima(now);
  const daysUntilWeekday = (session.day.weekday - weekdayOf(today) + 7) % 7;
  const candidateDate = addDays(today, daysUntilWeekday);
  const candidate = occurrenceOn(session, candidateDate);

  if (candidate.startsAt.getTime() > now.getTime()) return candidate;

  return occurrenceOn(session, addDays(candidateDate, 7));
}

/**
 * The stable string form of an occurrence's identity (Design D1): a
 * Set/Map key mirrored by the database's own unique constraint on
 * (member_id, class_date, start_time, genre_id, room_key).
 *
 * @param {{classDate: string, startTime: string, genreId: string, roomKey: string}} occurrence
 * @returns {string}
 */
export function occurrenceKey(occurrence) {
  return OCCURRENCE_KEY_FIELDS.map((field) => occurrence[field]).join('|');
}
