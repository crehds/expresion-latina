import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ATTENDANCE_CONFIRMATION_DAYS,
  DORMANT_ACCOUNT_YEARS,
  PENDING_CONSENT_DELETED_WITHIN_HOURS,
  PENDING_CONSENT_PURGE_AFTER_HOURS,
  PURGE_RUNS_EVERY_HOURS,
  UNCONFIRMED_EMAIL_DAYS,
} from './retentionTerms';

const MIGRATION = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260924160000_account_lifecycle.sql',
);

const SQL = readFileSync(MIGRATION, 'utf8');

// The code of one function, from its `create function` line to the `$$;` that
// closes it, without the comments (a comment may still quote an old figure).
// Nothing outside the functions can match: the weekly cleanup job below them
// has an `interval '7 days'` of its own.
function codeOf(name) {
  const start = SQL.indexOf(`create function ${name}(`);
  expect(start, `${name} is not in the migration`).toBeGreaterThan(-1);
  const end = SQL.indexOf('\n$$;', start);
  expect(end, `the end of ${name} was not found`).toBeGreaterThan(start);
  return SQL.slice(start, end).replace(/--.*$/gm, '');
}

// `now() - interval '<amount> <unit>'`, whatever the spacing around the
// parentheses and the minus sign.
const nowMinus = (amount, unit) => new RegExp(
  String.raw`now\s*\(\s*\)\s*-\s*interval\s*'${amount} ${unit}'`,
);

describe('the retention terms the privacy notice states', () => {
  // One test per figure, so a drifted one is reported by name.
  it('delete an account without a recorded consent after the hours the purge waits', () => {
    expect(codeOf('private.purge_pending_consent_accounts')).toMatch(
      nowMinus(PENDING_CONSENT_PURGE_AFTER_HOURS, 'hours'),
    );
  });

  it('delete an unconfirmed email account after the days the purge waits', () => {
    expect(codeOf('private.purge_unconfirmed_email_accounts')).toMatch(
      nowMinus(UNCONFIRMED_EMAIL_DAYS, 'days'),
    );
  });

  it('delete a dormant account after the years the purge waits', () => {
    expect(codeOf('private.purge_dormant_accounts')).toMatch(
      nowMinus(DORMANT_ACCOUNT_YEARS, 'years'),
    );
  });

  it('delete an attendance confirmation after the days past its class date the purge waits', () => {
    expect(codeOf('private.purge_expired_confirmations')).toMatch(new RegExp(
      String.raw`class_date\s*<\s*private\.lima_today\s*\(\s*\)\s*-\s*${ATTENDANCE_CONFIRMATION_DAYS}\b`,
    ));
  });

  it('say a pending account is gone within a day: the purge age plus the pause between runs', () => {
    const scheduled = SQL.match(
      /cron\.schedule\(\s*'purge-pending-consent-accounts',\s*'([^']+)'/,
    );

    expect(scheduled, 'the pending consent purge is not scheduled').not.toBeNull();
    // One run an hour: a fixed minute, every hour of every day.
    expect(scheduled[1]).toMatch(/^\d{1,2} \* \* \* \*$/);
    expect(PURGE_RUNS_EVERY_HOURS).toBe(1);
    expect(PENDING_CONSENT_DELETED_WITHIN_HOURS)
      .toBe(PENDING_CONSENT_PURGE_AFTER_HOURS + PURGE_RUNS_EVERY_HOURS);
    expect(PENDING_CONSENT_DELETED_WITHIN_HOURS).toBe(24);
  });

  it('describe the accounts the purges pick: no recorded consent, an unconfirmed email', () => {
    expect(codeOf('private.purge_pending_consent_accounts')).toMatch(/consent_at\s+is\s+null/);
    expect(codeOf('private.purge_unconfirmed_email_accounts')).toMatch(/email_confirmed_at\s+is\s+null/);
    expect(codeOf('private.purge_unconfirmed_email_accounts')).toMatch(/'provider'\s*=\s*'email'/);
  });

  it('count a sign-in, a session renewal and a paid period as the activity of an account', () => {
    const dormant = codeOf('private.purge_dormant_accounts');

    expect(dormant).toMatch(/u\.last_sign_in_at/);
    expect(dormant).toMatch(/s\.refreshed_at/);
    expect(dormant).toMatch(/pp\.ends_on/);
  });

  it('say that deleting your own account is immediate: the RPC deletes it at once', () => {
    const own = codeOf('public.delete_my_account');

    expect(own).toMatch(/private\.delete_account\s*\(\s*v_uid\s*\)/);
    expect(own).not.toMatch(/interval|pg_sleep|cron\./);
  });

  it('are whole, positive numbers', () => {
    [
      PENDING_CONSENT_DELETED_WITHIN_HOURS,
      UNCONFIRMED_EMAIL_DAYS,
      DORMANT_ACCOUNT_YEARS,
      ATTENDANCE_CONFIRMATION_DAYS,
    ].forEach((figure) => {
      expect(Number.isInteger(figure)).toBe(true);
      expect(figure).toBeGreaterThan(0);
    });
  });
});
