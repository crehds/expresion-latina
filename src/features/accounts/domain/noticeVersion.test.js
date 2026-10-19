import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CURRENT_NOTICE_VERSION,
  clearPendingConsentVersion,
  readPendingConsentVersion,
  storePendingConsentVersion,
} from './noticeVersion';

const MIGRATION = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260924130000_profiles_and_consent.sql',
);

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('CURRENT_NOTICE_VERSION', () => {
  it('is a version the database accepts: the one the migration seeds', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const seeded = sql.match(/insert into public\.privacy_notice_versions \(version\) values \('([^']+)'\)/);

    expect(seeded).not.toBeNull();
    expect(CURRENT_NOTICE_VERSION).toBe(seeded[1]);
  });
});

describe('the pending consent storage', () => {
  it('reads nothing before anything is stored', () => {
    expect(readPendingConsentVersion()).toBeNull();
  });

  it('stores the accepted version and reads it back', () => {
    storePendingConsentVersion(CURRENT_NOTICE_VERSION);

    expect(readPendingConsentVersion()).toBe(CURRENT_NOTICE_VERSION);
  });

  it('clears the stored version', () => {
    storePendingConsentVersion(CURRENT_NOTICE_VERSION);

    clearPendingConsentVersion();

    expect(readPendingConsentVersion()).toBeNull();
  });

  it('keeps the version in one fixed sessionStorage key', () => {
    storePendingConsentVersion('2026-01-01');

    expect(window.sessionStorage.length).toBe(1);
    expect(window.localStorage.length).toBe(0);
  });

  describe('when the storage is blocked', () => {
    const block = (method) => vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error('storage is blocked');
    });

    it('reads as nothing stored', () => {
      block('getItem');

      expect(readPendingConsentVersion()).toBeNull();
    });

    it('does not throw when storing', () => {
      block('setItem');

      expect(() => storePendingConsentVersion('2026-01-01')).not.toThrow();
    });

    it('does not throw when clearing', () => {
      block('removeItem');

      expect(() => clearPendingConsentVersion()).not.toThrow();
    });
  });
});
