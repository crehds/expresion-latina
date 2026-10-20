/**
 * The only door between the membership feature and the member directory, the
 * paid periods and the keep-alive heartbeat in Supabase (Design: Interfaces,
 * D10). Everything here is for the administrator: the database refuses it to
 * anyone else, and the screens that call it sit behind the admin guard.
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
