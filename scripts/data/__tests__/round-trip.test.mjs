import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import buildAcademy from '../build-academy.mjs';
import makeTemplate from '../make-template.mjs';
import parseWorkbook from '../parse-workbook.mjs';

const workDir = mkdtempSync(join(tmpdir(), 'eyl-round-'));

after(() => rmSync(workDir, { recursive: true, force: true }));

/**
 * The full loop the academy actually performs: generate a template from the
 * committed file, import it back unedited, and compare.
 *
 * Unit tests on either half cannot see a disagreement between them — the
 * template deciding one thing about a cell and the importer another — and that
 * disagreement is exactly what silently corrupts the data the academy keeps.
 */
async function roundTrip(previous) {
  const source = join(workDir, 'academy.json');
  writeFileSync(source, JSON.stringify(previous));

  const target = join(workDir, `plantilla-${Date.now()}-${Math.random()}.xlsx`);
  await makeTemplate(target, { source });

  const sheets = await parseWorkbook(target);

  return buildAcademy(sheets, { previous, now: new Date('2026-01-15T10:00:00.000Z') });
}

const MISHEL = {
  id: 'mishel-fernandez',
  name: 'Mishel Fernández',
  shortName: 'Mishel',
  imageKey: null,
  genreIds: ['salsa'],
  bio: '',
  social: {},
  birthDate: '1997-04-02',
  achievements: [{ title: 'Campeona Nacional', year: 2023 }],
  videoIds: [],
};

function academyWith(videos, teacher = MISHEL) {
  return {
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    generatedFrom: null,
    studio: { name: 'Expresión Latina', social: {} },
    days: [{
      id: 'lunes', name: 'Lunes', shortName: 'Lun', weekday: 1,
    }],
    timeSlots: [{
      id: 't1900-2000', start: '19:00', end: '20:00', label: '19:00 - 20:00',
    }],
    genres: [{
      id: 'salsa', name: 'Salsa', slug: 'salsa', kind: 'class', description: '', accentColor: null, videoIds: [],
    }],
    teachers: [teacher],
    videos,
    // Ids the importer derives from the content, not invented ones: the point
    // of the scheme is that the same class always lands on the same id.
    sessions: [{
      id: 'lun-1900',
      dayId: 'lunes',
      slotId: 't1900-2000',
      genreId: 'salsa',
      teacherId: 'mishel-fernandez',
      level: 'Básico',
      room: 'Sala 1',
      note: null,
    }],
  };
}

describe('template then import, with nothing edited', () => {
  it('keeps a hand-added teacher video as one record, not two', async () => {
    const handAdded = {
      id: 'mishel-showcase',
      title: 'Showcase 2025',
      genreId: null,
      teacherId: 'mishel-fernandez',
      assetKey: 'showcase.mp4',
      externalUrl: null,
    };

    const { academy, errors } = await roundTrip(academyWith([handAdded]));

    assert.deepEqual(errors, []);
    assert.deepEqual(academy.videos.map((video) => video.id), ['mishel-showcase']);
  });

  it('keeps an imported teacher video as the same single record', async () => {
    const owned = {
      id: 'video-mishel-fernandez',
      title: 'Mishel Fernández',
      genreId: null,
      teacherId: 'mishel-fernandez',
      assetKey: 'mishel.mp4',
      externalUrl: null,
    };

    const { academy } = await roundTrip(academyWith([owned], { ...MISHEL, videoIds: [owned.id] }));

    assert.deepEqual(academy.videos, [owned]);
    assert.deepEqual(academy.teachers[0].videoIds, [owned.id]);
  });

  it('brings the birth date and the titles back unchanged', async () => {
    const { academy } = await roundTrip(academyWith([]));
    const [teacher] = academy.teachers;

    assert.equal(teacher.birthDate, '1997-04-02');
    assert.deepEqual(teacher.achievements, [{ title: 'Campeona Nacional', year: 2023 }]);
  });

  it('brings the schedule back unchanged', async () => {
    const before = academyWith([]);
    const { academy } = await roundTrip(before);

    assert.deepEqual(academy.sessions, before.sessions);
    assert.deepEqual(academy.timeSlots, before.timeSlots);
  });

  // Two trips rather than one, because a scheme that merely survives the first
  // pass can still drift on every pass after it.
  it('is idempotent, so running it twice changes nothing', async () => {
    const once = (await roundTrip(academyWith([]))).academy;
    const twice = (await roundTrip(once)).academy;

    assert.deepEqual(twice, once);
  });
});
