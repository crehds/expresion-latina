/**
 * The only door between the membership feature and the member directory, the
 * paid periods and the keep-alive heartbeat in Supabase (Design: Interfaces,
 * D10). Everything here is meant for the administrator, and the screens that
 * call it sit behind the admin guard. The database stays the authority: it
 * refuses the directory search and the writes to anyone else, and shows a member
 * who is not one only their own periods and nothing of the heartbeat.
 *
 * `createMembershipAdapter(getClient)` takes the lazy client getter and calls it
 * only when a method runs, so creating the adapter never loads supabase-js. Every
 * method resolves to a result (`ok` / `fail`) and never throws: a rejected
 * `getClient()` (a failed dynamic import is a network failure) and any error the
 * client returns are mapped to a result code by the shared request runner. A
 * failure carries the code and nothing of the error, whose details can name the
 * member, the email and the dates of the request.
 *
 * The database speaks snake_case; a period leaves this module as the camelCase
 * `{ id, memberId, startsOn, endsOn }` the membership domain works on. Dates
 * stay ISO 'YYYY-MM-DD' strings.
 */
import { createRequestRunner } from '../../../shared/backend/requestRunner';

/**
 * How many members one search asks for: the page size `admin_search_members`
 * uses by default, which the database accepts from 1 to 200. A screen that gets
 * this many members back knows the list may be longer than what it shows.
 */
export const MEMBER_SEARCH_LIMIT = 50;

// Only what `toPeriod` reads: `recorded_by` and `created_at` never leave the database.
const PERIOD_COLUMNS = 'id, member_id, starts_on, ends_on';

const toMember = (row) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  paidUntil: row.paid_until,
  isActive: row.is_active,
});

const toPeriod = (row) => ({
  id: row.id,
  memberId: row.member_id,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
});

// An UPDATE or a DELETE that matches no row (it was deleted meanwhile, or the
// policy hides it) is a success with no rows to PostgREST, not an error. Those
// two calls ask for the ids they touched, and an empty answer is told the way
// Postgres tells it, no_data_found, which `toResultCode` maps to NOT_FOUND. The
// lookup of one member needs the same, since its function answers no rows for a
// member who is not there.
const NO_ROW_MATCHED = { code: 'P0002', message: 'no row matched' };

function requireRows(answer) {
  const matched = Array.isArray(answer.data) && answer.data.length > 0;
  return answer.error || matched ? answer : { data: null, error: NO_ROW_MATCHED };
}

export function createMembershipAdapter(getClient) {
  // Runs `call(client)` and turns whatever it returns or throws into a result.
  // `call` returns `{ error, data }`-shaped values; `read` maps `data` on success.
  const run = createRequestRunner(getClient);

  return {
    // The member directory (the `admin_search_members` function: consented and
    // email-confirmed members only). The query goes as typed; the function trims
    // it, matches name and email, and takes `%` and `_` as plain characters. An
    // empty query lists everyone, up to the page size.
    searchMembers: (query) => run(
      (client) => client.rpc('admin_search_members', {
        q: typeof query === 'string' ? query : '',
        lim: MEMBER_SEARCH_LIMIT,
      }),
      (rows) => (rows ?? []).map(toMember),
    ),

    // ONE member of the directory (the `admin_get_member` function: the same
    // administrator check, the same two gates and the same row as the search).
    // The function answers no row, and no error, for a member who fails a gate
    // and for an id that belongs to nobody. Both come out as NOT_FOUND, so a
    // screen cannot tell them apart. The id goes as given when it is a string;
    // anything else asks for nobody (NULL), because leaving the argument out of
    // the request is refused by PostgREST with an error that says nothing about
    // the id. The periods of the member come from `listPeriods`.
    getMember: (id) => run(
      async (client) => requireRows(await client.rpc('admin_get_member', {
        p_id: typeof id === 'string' ? id : null,
      })),
      (rows) => toMember(rows[0]),
    ),

    // The periods of ONE member, newest first. The filter is not optional: the
    // policy of `paid_periods` lets an administrator read the rows of every
    // member, so without it this would return all of them.
    listPeriods: (memberId) => run(
      (client) => client
        .from('paid_periods')
        .select(PERIOD_COLUMNS)
        .eq('member_id', memberId)
        .order('starts_on', { ascending: false }),
      (rows) => (rows ?? []).map(toPeriod),
    ),

    // Only the three columns the table grants an INSERT on; `recorded_by` is
    // filled in by the database. Nothing comes back: the screen reads the list
    // again, so it shows what the database holds.
    createPeriod: ({ memberId, startsOn, endsOn }) => run(
      (client) => client
        .from('paid_periods')
        .insert({ member_id: memberId, starts_on: startsOn, ends_on: endsOn }),
      () => null,
    ),

    // Only the two columns the table grants an UPDATE on.
    updatePeriod: (id, { startsOn, endsOn }) => run(
      async (client) => requireRows(await client
        .from('paid_periods')
        .update({ starts_on: startsOn, ends_on: endsOn })
        .eq('id', id)
        .select('id')),
      () => null,
    ),

    deletePeriod: (id) => run(
      async (client) => requireRows(await client
        .from('paid_periods')
        .delete()
        .eq('id', id)
        .select('id')),
      () => null,
    ),

    // When the keep-alive last pinged the project: the `last_ping_at` instant as
    // the database writes it (an ISO string with an offset), or null when the
    // table has no row. A table nobody has pinged yet is empty, and so does it
    // look to a member who is not an administrator.
    getLastPing: () => run(
      (client) => client
        .from('ops_heartbeat')
        .select('last_ping_at')
        .eq('id', 1)
        .maybeSingle(),
      (row) => (row ? row.last_ping_at : null),
    ),
  };
}

export default createMembershipAdapter;
