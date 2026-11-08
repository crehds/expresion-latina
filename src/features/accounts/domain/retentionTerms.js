/**
 * How long the backend keeps personal data (Design: D6; Spec: Account Deletion,
 * Consent Before Account Creation, Attendance Retention).
 *
 * The privacy notice states these figures to the member, so they are written
 * once, here, and the notice renders them from this module. They restate what
 * the scheduled purges in `supabase/migrations/` do; a test reads the newest
 * definition of each purge across the migrations and fails if a figure here
 * stops matching it, so the notice cannot promise something the database does
 * not do.
 *
 * To change a figure:
 * 1. Change it here.
 * 2. Add a migration that redefines the purge (`create or replace function`)
 *    with the new value. Never edit a migration that has already been applied.
 * 3. Bump CURRENT_NOTICE_VERSION in noticeVersion.js, because the notice's
 *    promise changes.
 * 4. Deploy, and push the migration to the hosted project (`db push`).
 */

/**
 * `private.purge_pending_consent_accounts` deletes an account with no recorded
 * consent once it is older than this many hours.
 */
export const PENDING_CONSENT_PURGE_AFTER_HOURS = 23;

/** That purge is scheduled once an hour (pg_cron `17 * * * *`). */
export const PURGE_RUNS_EVERY_HOURS = 1;

/**
 * The most an account without a recorded consent can live: the age at which the
 * purge picks it up, plus the wait for the next run. This is the figure to say.
 */
export const PENDING_CONSENT_DELETED_WITHIN_HOURS = PENDING_CONSENT_PURGE_AFTER_HOURS
  + PURGE_RUNS_EVERY_HOURS;

/**
 * `private.purge_unconfirmed_email_accounts`: an email sign-up that never
 * confirmed its address is deleted after this many days. The owner confirmed
 * this figure on 2026-11-08.
 */
export const UNCONFIRMED_EMAIL_DAYS = 7;

/**
 * `private.purge_dormant_accounts`: an account with no sign-in, no session
 * renewal and no paid period for this many years is deleted.
 */
export const DORMANT_ACCOUNT_YEARS = 2;

/**
 * `private.purge_expired_confirmations`: an attendance confirmation is deleted
 * once its class date is more than this many days in the past.
 */
export const ATTENDANCE_CONFIRMATION_DAYS = 30;
