/**
 * Loads the member's session into the app right after a sign-in or a verified
 * email link, and never throws.
 *
 * By then supabase-js already holds the session, so a session that fails to
 * load is not a failed sign-in or a failed link: the member goes on and sees no
 * error, because showing one would send them to type the password again or to
 * use a single-use link twice. Nothing else starts the session on the page the
 * member lands on, so a rejected start is tried once more (the provider lets a
 * failed load be retried). A second failure is left for the next page load,
 * which reads the stored session.
 */
export default async function startSession(session) {
  try {
    await session.start();
  } catch {
    try {
      await session.start();
    } catch {
      // Left for the next page load.
    }
  }
}
