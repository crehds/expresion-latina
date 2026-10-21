/**
 * The only door between the attendance feature and the `attendance_confirmations`
 * table in Supabase (Design: Interfaces, D10). It is what a signed-in member's
 * schedule page uses to read their own confirmations, to confirm a class and to
 * cancel one. The database stays the authority: the policies refuse a confirm
 * outside the 7-day window or the paid periods, and a cancel after the start.
 *
 * `createAttendanceAdapter(getClient)` takes the lazy client getter and calls it
 * only when a method runs, so creating the adapter never loads supabase-js. Every
 * method resolves to a result (`ok` / `fail`) and never throws: the shared request
 * runner maps a rejected `getClient()` and any error the client returns to a
 * result code, and a failure carries the code and nothing of the error.
 *
 * An occurrence leaves this module as the camelCase object the attendance domain
 * works on. The database prints a `time` column as 'HH:MM:SS'; the whole-minute
 * CHECKs of the table guarantee the seconds are zero, so the mapper accepts only
 * 'HH:MM' or 'HH:MM:00' and turns both into 'HH:MM', the form an occurrence key
 * uses. Anything else is a bug and fails the whole read instead of being cut.
 */
import { RESULT_CODES, fail } from '../../../shared/backend/resultCodes';
import { createRequestRunner } from '../../../shared/backend/requestRunner';

// Exactly the columns the table grants an INSERT on, and what a read maps.
const OCCURRENCE_COLUMNS = 'class_date, start_time, end_time, genre_id, room_key, genre_name, room_label';

// unique_violation: the occurrence is already confirmed, which is what the member
// asked for, so a repeated confirm (a double click, a second tab) is a success.
const ALREADY_CONFIRMED = '23505';

const WHOLE_MINUTE = /^(\d{2}:\d{2})(:00)?$/;

function toWholeMinute(value) {
  const match = typeof value === 'string' ? WHOLE_MINUTE.exec(value) : null;
  if (!match) {
    throw new Error('A class time is not a whole minute.');
  }
  return match[1];
}

const toOccurrence = (row) => ({
  classDate: row.class_date,
  startTime: toWholeMinute(row.start_time),
  endTime: toWholeMinute(row.end_time),
  genreId: row.genre_id,
  roomKey: row.room_key,
  genreName: row.genre_name,
  roomLabel: row.room_label,
});

// The administrator's list also names the member (the foreign key to profiles is
// followed by the embed) and keeps the member id, which is only a React key.
const ADMIN_COLUMNS = `member_id, ${OCCURRENCE_COLUMNS}, profiles(full_name)`;

// Rows per request of the administrator's list.
const ADMIN_PAGE_SIZE = 500;

// A confirmation of the administrator's list. A profile that did not come with
// the row, or has no name, gives a null name: the screen words that, not the mapper.
const toListedConfirmation = (row) => {
  const name = row.profiles?.full_name;
  return {
    memberId: row.member_id,
    fullName: typeof name === 'string' && name.trim() !== '' ? name : null,
    ...toOccurrence(row),
  };
};

export function createAttendanceAdapter(getClient) {
  // Runs `call(client)` and turns whatever it returns or throws into a result.
  // `call` returns `{ error, data }`-shaped values; `read` maps `data` on success.
  const run = createRequestRunner(getClient);

  return {
    // The member's own confirmations from a date on. The filter on the member is
    // not optional: the policy lets an administrator read every member's rows, so
    // without it the administrator's own schedule page would list everyone's.
    listOwnConfirmations: ({ userId, fromDate }) => run(
      (client) => client
        .from('attendance_confirmations')
        .select(OCCURRENCE_COLUMNS)
        .eq('member_id', userId)
        .gte('class_date', fromDate),
      (rows) => (rows ?? []).map(toOccurrence),
    ),

    // Everyone's confirmations from `fromDate` to `toDate`, for the administrator's
    // attendee list. There is no filter on the member on purpose: the policy lets
    // an administrator read every member's rows, which is what this list is for.
    // Only the member's name comes from the profile; no email, period or status.
    //
    // The list is read in pages until one comes back short, because the API cuts a
    // single answer at a fixed number of rows and a list cut short would pass for
    // the whole one. The id is the last sort key so that the pages never overlap.
    listUpcomingConfirmations: ({ fromDate, toDate }) => run(
      async (client) => {
        const rows = [];
        for (let from = 0; ; from += ADMIN_PAGE_SIZE) {
          // eslint-disable-next-line no-await-in-loop -- each page waits for the one before
          const page = await client
            .from('attendance_confirmations')
            .select(ADMIN_COLUMNS)
            .gte('class_date', fromDate)
            .lte('class_date', toDate)
            .order('class_date')
            .order('start_time')
            .order('id')
            .range(from, from + ADMIN_PAGE_SIZE - 1);
          if (page.error) {
            return { data: null, error: page.error };
          }
          rows.push(...(page.data ?? []));
          if ((page.data ?? []).length < ADMIN_PAGE_SIZE) {
            return { data: rows, error: null };
          }
        }
      },
      (rows) => rows.map(toListedConfirmation),
    ),

    // Only the seven granted columns: `member_id` and `starts_at` are filled in by
    // the database (naming either is refused). No upsert, and nothing comes back:
    // the page reads the list again, so it shows what the database holds.
    confirm: (occurrence) => run(
      async (client) => {
        const answer = await client.from('attendance_confirmations').insert({
          class_date: occurrence.classDate,
          start_time: occurrence.startTime,
          end_time: occurrence.endTime,
          genre_id: occurrence.genreId,
          room_key: occurrence.roomKey,
          genre_name: occurrence.genreName,
          room_label: occurrence.roomLabel,
        });
        return answer.error?.code === ALREADY_CONFIRMED ? { data: null, error: null } : answer;
      },
      () => null,
    ),

    // A delete the policy hides (the class already started) or that finds no row
    // (already cancelled, in another tab) is a success with no rows to PostgREST,
    // not an error. The call asks for the ids it removed, and none is STARTED; the
    // page reads the list again, which tells the two cases apart.
    cancel: async (occurrence) => {
      const result = await run(
        (client) => client
          .from('attendance_confirmations')
          .delete()
          .eq('class_date', occurrence.classDate)
          .eq('start_time', occurrence.startTime)
          .eq('genre_id', occurrence.genreId)
          .eq('room_key', occurrence.roomKey)
          .select('id'),
        (rows) => (rows ?? []).length,
      );
      if (result.ok && result.data === 0) {
        return fail(RESULT_CODES.STARTED);
      }
      return result.ok ? { ok: true, data: null } : result;
    },
  };
}

export default createAttendanceAdapter;
