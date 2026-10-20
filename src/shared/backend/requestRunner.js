/**
 * The one way an adapter runs a backend call (Design: Interfaces, D10).
 *
 * `createRequestRunner(getClient)` takes the lazy client getter and returns
 * `run(call, read)`. The getter is only called when a call runs, so creating a
 * runner (and the adapter around it) never loads supabase-js. `run` awaits the
 * client, hands it to `call`, which returns the `{ data, error }` answer of a
 * supabase-js request, and turns that into a result: `ok(read(data))` on
 * success, `fail(code)` on an error. Whatever throws on the way, a client that
 * cannot be loaded (a failed dynamic import is a network failure), a call that
 * throws or a `read` that cannot make sense of the data, ends as a failure
 * result too, so `run` never rejects.
 *
 * A failure carries the result code of `toResultCode` and nothing of the error
 * itself: PostgREST and auth-js errors can name the member, the email or the
 * dates of the request, and none of that may reach a screen or a log.
 */
import { fail, ok, toResultCode } from './resultCodes';

export function createRequestRunner(getClient) {
  // `call` returns `{ error, data }`-shaped values; `read` maps `data` on success.
  return async function run(call, read) {
    try {
      const client = await getClient();
      const { data, error } = await call(client);
      return error ? fail(toResultCode(error)) : ok(read(data));
    } catch (error) {
      return fail(toResultCode(error));
    }
  };
}

export default createRequestRunner;
