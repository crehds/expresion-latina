import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import ExcelJS from 'exceljs';

import buildAcademy from '../build-academy.mjs';
import makeTemplate from '../make-template.mjs';
import parseWorkbook from '../parse-workbook.mjs';
import validateAcademy from '../validate.mjs';

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
    reviews: [{
      id: 'evelyn-ramos',
      author: 'Evelyn Ramos',
      text: 'Los profesores explican con paciencia.',
      source: 'Instagram',
      sourceUrl: 'https://instagram.com/p/abc',
    }],
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

/**
 * Builds a template from `previous`, then hands the workbook to `edit` before
 * importing it back, so a test can describe the shape of an older file.
 */
async function importEdited(previous, edit, options = {}) {
  const source = join(workDir, `old-${Date.now()}-${Math.random()}.json`);
  writeFileSync(source, JSON.stringify(previous));

  const target = join(workDir, `old-${Date.now()}-${Math.random()}.xlsx`);
  await makeTemplate(target, { source });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(target);
  edit(workbook);
  await workbook.xlsx.writeFile(target);

  const sheets = await parseWorkbook(target);

  return buildAcademy(sheets, {
    previous,
    now: new Date('2026-01-15T10:00:00.000Z'),
    ...options,
  });
}

/*
 * A workbook generated before a sheet existed. Every template the academy
 * already holds predates one sheet or another, so importing an old file must
 * not be the thing that deletes what the file has never heard of.
 */
const withoutSheet = (previous, name, options) => importEdited(previous, (workbook) => {
  workbook.removeWorksheet(workbook.getWorksheet(name).id);
}, options);

/*
 * A sheet that is present and carries nothing but its header row. This is the
 * academy deleting every entry on purpose, which is not the same as silence and
 * must still be honoured.
 */
const withEmptiedSheet = (previous, name) => importEdited(previous, (workbook) => {
  const sheet = workbook.getWorksheet(name);
  // Backwards: removing a row renumbers every row below it.
  for (let row = sheet.rowCount; row > 1; row -= 1) sheet.spliceRows(row, 1);
});

describe('importing a workbook from before the Resenas sheet existed', () => {
  it('keeps the opinions rather than deleting them', async () => {
    const before = academyWith([]);
    const { academy, errors } = await withoutSheet(before, 'Resenas');

    assert.deepEqual(errors, []);
    assert.deepEqual(academy.reviews, before.reviews);
  });

  it('still imports the rest of the workbook', async () => {
    const before = academyWith([]);
    const { academy } = await withoutSheet(before, 'Resenas');

    assert.deepEqual(academy.sessions, before.sessions);
    assert.equal(academy.teachers.length, 1);
  });
});

/*
 * The same rule one level up, for the four sheets that still collapse a missing
 * sheet to an empty list. A workbook that never carried the Profesores sheet
 * used to wipe the faculty and, with it, every session's teacher link.
 */
describe('a workbook missing the Profesores sheet', () => {
  it('keeps the published faculty', async () => {
    const before = academyWith([]);
    const { academy, errors } = await withoutSheet(before, 'Profesores');

    assert.deepEqual(errors, []);
    assert.deepEqual(academy.teachers, before.teachers);
  });

  it('still links every session to its teacher', async () => {
    const before = academyWith([]);
    const { academy } = await withoutSheet(before, 'Profesores');

    assert.deepEqual(academy.sessions, before.sessions);
  });

  it('deletes no teacher video, having described none', async () => {
    const video = {
      id: 'mishel-fernandez-video',
      title: 'Mishel Fernández',
      genreId: null,
      assetKey: null,
      externalUrl: 'https://youtu.be/abc',
      teacherId: 'mishel-fernandez',
    };
    const before = academyWith([video], { ...MISHEL, videoIds: [video.id] });
    const { academy } = await withoutSheet(before, 'Profesores');

    assert.deepEqual(academy.videos, [video]);
  });
});

describe('a workbook missing the Generos sheet', () => {
  it('keeps the published genres', async () => {
    const before = academyWith([]);
    const { academy, errors } = await withoutSheet(before, 'Generos');

    assert.deepEqual(errors, []);
    assert.deepEqual(academy.genres, before.genres);
  });

  it('still links every session to its genre', async () => {
    const before = academyWith([]);
    const { academy } = await withoutSheet(before, 'Generos');

    assert.deepEqual(academy.sessions, before.sessions);
  });
});

describe('a workbook missing the Estudio sheet', () => {
  it('keeps the address, whatsapp and email', async () => {
    const before = academyWith([]);
    before.studio = {
      ...before.studio,
      address: 'Av. Palmeras 3839',
      whatsapp: '+51 960 507 583',
      email: 'expresionlatina@gmail.com',
    };
    const { academy, errors } = await withoutSheet(before, 'Estudio');

    assert.deepEqual(errors, []);
    assert.deepEqual(academy.studio, before.studio);
  });
});

describe('a workbook missing the Horario sheet', () => {
  it('keeps the published schedule', async () => {
    const before = academyWith([]);
    const { academy, errors } = await withoutSheet(before, 'Horario');

    assert.deepEqual(errors, []);
    assert.deepEqual(academy.sessions, before.sessions);
    assert.deepEqual(academy.timeSlots, before.timeSlots);
  });
});

describe('a sheet that is present and deliberately emptied', () => {
  it('clears the studio details the academy took back', async () => {
    const before = academyWith([]);
    before.studio = { ...before.studio, address: 'Av. Palmeras 3839' };
    const { academy, errors } = await withEmptiedSheet(before, 'Estudio');

    assert.deepEqual(errors, []);
    assert.equal(academy.studio.address, undefined);
  });

  it('is not confused for a sheet that was never there', async () => {
    const before = academyWith([]);
    const { academy } = await withEmptiedSheet(before, 'Resenas');

    assert.deepEqual(academy.reviews, []);
  });
});

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

  it('brings the opinions back unchanged', async () => {
    const before = academyWith([]);
    const { academy } = await roundTrip(before);

    assert.deepEqual(academy.reviews, before.reviews);
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

/**
 * Drops named columns from the Profesores sheet, the way a workbook written
 * before those columns existed arrives.
 */
async function withoutColumns(previous, headings, options = {}) {
  const source = join(workDir, `cols-${Date.now()}-${Math.random()}.json`);
  writeFileSync(source, JSON.stringify(previous));

  const target = join(workDir, `cols-${Date.now()}-${Math.random()}.xlsx`);
  await makeTemplate(target, { source });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(target);
  const sheet = workbook.getWorksheet('Profesores');

  headings.forEach((heading) => {
    const header = sheet.getRow(1);
    const index = header.values.findIndex((value) => value === heading);
    if (index > 0) sheet.spliceColumns(index, 1);
  });

  await workbook.xlsx.writeFile(target);

  const sheets = await parseWorkbook(target);

  return buildAcademy(sheets, {
    previous,
    now: new Date('2026-01-15T10:00:00.000Z'),
    ...options,
  });
}

/** Empties a cell while leaving its column in place. */
async function withCellCleared(previous, heading) {
  const source = join(workDir, `clear-${Date.now()}-${Math.random()}.json`);
  writeFileSync(source, JSON.stringify(previous));

  const target = join(workDir, `clear-${Date.now()}-${Math.random()}.xlsx`);
  await makeTemplate(target, { source });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(target);
  const sheet = workbook.getWorksheet('Profesores');
  const column = sheet.getRow(1).values.findIndex((value) => value === heading);
  if (column > 0) sheet.getRow(2).getCell(column).value = null;
  await workbook.xlsx.writeFile(target);

  const sheets = await parseWorkbook(target);

  return buildAcademy(sheets, { previous, now: new Date('2026-01-15T10:00:00.000Z') });
}

/*
 * The carry-over contract, proved through a real workbook rather than through
 * a row object built by hand.
 *
 * The unit cases construct the row themselves, so Object.hasOwn is true no
 * matter what the parser does — they cannot tell whether an emptied cell still
 * reaches the importer as a key. If it did not, clearing a published value
 * would silently no-op on every import and the academy could never take one
 * back.
 */
describe('a Profesores sheet missing the columns it was written before', () => {
  it('keeps the birth date the sheet says nothing about', async () => {
    const before = academyWith([]);
    const { academy } = await withoutColumns(before, ['Nacimiento']);

    assert.equal(academy.teachers[0].birthDate, before.teachers[0].birthDate);
  });

  it('keeps the titles the sheet says nothing about', async () => {
    const before = academyWith([]);
    const { academy } = await withoutColumns(before, ['Logros']);

    assert.deepEqual(academy.teachers[0].achievements, before.teachers[0].achievements);
  });
});

describe('a Profesores sheet whose cell was deliberately emptied', () => {
  it('clears the birth date, so a published date can be taken back', async () => {
    const before = academyWith([]);

    assert.ok(before.teachers[0].birthDate, 'the fixture must start with one');

    const { academy } = await withCellCleared(before, 'Nacimiento');

    assert.equal(academy.teachers[0].birthDate, null);
  });

  it('clears the titles the same way', async () => {
    const before = academyWith([]);

    assert.ok(before.teachers[0].achievements.length, 'the fixture must start with some');

    const { academy } = await withCellCleared(before, 'Logros');

    assert.deepEqual(academy.teachers[0].achievements, []);
  });
});

/*
 * The Video column, once the field the carry-over rule had not reached.
 *
 * mergeVideos used to derive the ids an import may delete from every teacher in
 * the sheet regardless of whether the sheet carried a Video column at all, so a
 * workbook written before that column looked exactly like one whose Video cell
 * was emptied on purpose, and the published clip went either way. hasVideoColumn
 * now tells them apart, and the cases below pin both halves: an absent column
 * deletes nothing, an emptied cell still takes the clip back.
 *
 * The fixture must actually hold an owned clip. An earlier version of these
 * cases used academyWith([]), which ships none, so both halves compared one
 * empty list against another and proved nothing.
 */
const OWNED_VIDEO = {
  id: 'video-mishel-fernandez',
  title: 'Mishel Fernández',
  genreId: null,
  teacherId: 'mishel-fernandez',
  assetKey: 'mishel.mp4',
  externalUrl: null,
};

const withOwnedVideo = () => academyWith(
  [OWNED_VIDEO],
  { ...MISHEL, videoIds: [OWNED_VIDEO.id] },
);

describe('a Profesores sheet missing the Video column', () => {
  it('keeps the teacher video it says nothing about', async () => {
    const before = withOwnedVideo();

    assert.ok(before.videos.length, 'the fixture must start with a clip');

    const { academy } = await withoutColumns(before, ['Video']);

    assert.deepEqual(academy.videos.map((video) => video.id), [OWNED_VIDEO.id]);
  });

  it('keeps the link from the teacher to that video', async () => {
    const before = withOwnedVideo();
    const { academy } = await withoutColumns(before, ['Video']);

    assert.deepEqual(academy.teachers[0].videoIds, [OWNED_VIDEO.id]);
  });
});

describe('a Profesores sheet whose Video cell was deliberately emptied', () => {
  it('deletes the clip, so a published video can be taken back', async () => {
    const before = withOwnedVideo();

    assert.ok(before.videos.length, 'the fixture must start with a clip');

    const { academy } = await withCellCleared(before, 'Video');

    assert.deepEqual(academy.videos, []);
  });
});

/*
 * --fresh is the deliberate destructive rebuild, and the only switch that
 * re-enables what the carry-over rule exists to prevent. It is scoped to whole
 * sheets: what it empties and what it leaves alone are two separate contracts,
 * and both belong here, or a later edit to that one expression could make the
 * flag a no-op — or a total wipe — with a green suite.
 */
describe('--fresh on a sheet the workbook does not carry', () => {
  it('publishes no opinions instead of keeping the published ones', async () => {
    const before = academyWith([]);

    assert.ok(before.reviews.length, 'the fixture must start with some');

    const { academy, errors } = await withoutSheet(before, 'Resenas', { fresh: true });

    assert.deepEqual(errors, []);
    assert.deepEqual(academy.reviews, []);
  });

  it('drops the studio details instead of keeping them', async () => {
    const before = academyWith([]);
    before.studio = { ...before.studio, address: 'Av. Palmeras 3839' };

    const { academy } = await withoutSheet(before, 'Estudio', { fresh: true });

    assert.equal(academy.studio.address, undefined);
  });

  // The same workbook, the same sheet, the opposite outcome. Without this pair
  // a test could pass because nothing carried in the first place.
  it('is the only thing that changes: the default still carries', async () => {
    const before = academyWith([]);

    const fresh = await withoutSheet(before, 'Resenas', { fresh: true });
    const kept = await withoutSheet(before, 'Resenas');

    assert.deepEqual(fresh.academy.reviews, []);
    assert.deepEqual(kept.academy.reviews, before.reviews);
  });
});

describe('--fresh leaves the contracts it does not own alone', () => {
  it('still carries a column the sheet was written before', async () => {
    const before = academyWith([]);

    assert.ok(before.teachers[0].birthDate, 'the fixture must start with one');

    const { academy } = await withoutColumns(before, ['Nacimiento'], { fresh: true });

    assert.equal(academy.teachers[0].birthDate, before.teachers[0].birthDate);
  });

  it('still keeps the titles of a sheet with no Logros column', async () => {
    const before = academyWith([]);
    const { academy } = await withoutColumns(before, ['Logros'], { fresh: true });

    assert.deepEqual(academy.teachers[0].achievements, before.teachers[0].achievements);
  });

  it('still keeps a teacher video the sheet describes no column for', async () => {
    const before = withOwnedVideo();
    const { academy } = await withoutColumns(before, ['Video'], { fresh: true });

    assert.deepEqual(academy.videos, before.videos);
  });

  it('still keeps a video no sheet describes at all', async () => {
    const trailer = {
      id: 'presentacion-larga',
      title: 'Presentación larga',
      genreId: null,
      assetKey: 'video_largo.mp4',
      externalUrl: null,
    };
    const before = academyWith([trailer]);

    const { academy } = await withoutSheet(before, 'Resenas', { fresh: true });

    assert.deepEqual(academy.videos, [trailer]);
  });
});

/*
 * Carrying a sheet forward can outdate what another sheet rebuilt.
 *
 * A teacher's and a genre's id come from their name, so renaming a row mints a
 * new id. With the Horario sheet absent the published sessions are carried
 * verbatim, and they go on naming the id that just stopped existing.
 *
 * buildAcademy cannot see it — it reports cells, and no cell is wrong — so it
 * returns this academy with no errors at all. validateAcademy is what refuses
 * it, by checking the finished object rather than the rows. That split is the
 * whole reason import.mjs runs both, and nothing pinned it: the protection
 * holds one layer above the code that creates the hazard, which is exactly the
 * kind of arrangement a later refactor drops without noticing.
 */
describe('a carried schedule against a sheet that was edited', () => {
  const renameTeacher = (previous, to) => importEdited(previous, (workbook) => {
    workbook.removeWorksheet(workbook.getWorksheet('Horario').id);

    const sheet = workbook.getWorksheet('Profesores');
    const column = sheet.getRow(1).values.findIndex((value) => value === 'Nombre');
    sheet.getRow(2).getCell(column).value = to;
  });

  it('carries sessions that name the teacher who was just renamed', async () => {
    const before = academyWith([]);
    const { academy, errors } = await renameTeacher(before, 'Mishel Fernández López');

    // No cell is wrong, so the row-level pass has nothing to report.
    assert.deepEqual(errors, []);
    assert.equal(academy.sessions[0].teacherId, 'mishel-fernandez');
    assert.ok(!academy.teachers.some((teacher) => teacher.id === 'mishel-fernandez'));
  });

  it('is refused by the check that reads the finished object', async () => {
    const before = academyWith([]);
    const { academy } = await renameTeacher(before, 'Mishel Fernández López');
    const problems = validateAcademy(academy);

    assert.ok(problems.length, 'a dangling teacher reference must be reported');
    assert.match(problems.map((problem) => problem.message).join('\n'), /mishel-fernandez/);
  });

  it('leaves nothing dangling when the rename is not carried into a session', async () => {
    const before = academyWith([]);
    const { academy } = await importEdited(before, (workbook) => {
      workbook.removeWorksheet(workbook.getWorksheet('Horario').id);
    });

    assert.deepEqual(validateAcademy(academy), []);
  });
});

/** A template generated from `academy`, read back from disk. */
async function templateOf(academy) {
  const source = join(workDir, `drop-${Date.now()}-${Math.random()}.json`);
  writeFileSync(source, JSON.stringify(academy));

  const target = join(workDir, `drop-${Date.now()}-${Math.random()}.xlsx`);
  await makeTemplate(target, { source });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(target);
  return workbook;
}

/*
 * What a cell's dropdown offers, read the way Excel reads it: a quoted list is
 * its own values, and a range is whatever those cells hold right now.
 */
function offered(workbook, sheetName, address) {
  const { formulae = [] } = workbook.getWorksheet(sheetName).getCell(address).dataValidation ?? {};
  const [formula = ''] = formulae;

  if (formula.startsWith('"')) return formula.slice(1, -1).split(',');

  const range = formula.match(/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?\2\$?(\d+)$/);
  assert.ok(range, `a dropdown Excel cannot read: ${formula}`);

  const [, source, column, first, last] = range;
  const sheet = workbook.getWorksheet(source);
  const values = [];
  for (let row = Number(first); row <= Number(last); row += 1) {
    const { value } = sheet.getCell(`${column}${row}`);
    if (value) values.push(String(value));
  }
  return values;
}

/*
 * Where a person types the next name: the first row with nothing in column A.
 * Not rowCount + 1 — a row whose only content is a dropdown still counts, and
 * the Generos sheet has one on every row of its Tipo column.
 */
function firstEmptyRow(sheet) {
  let row = 2;
  while (sheet.getCell(`A${row}`).value) row += 1;
  return row;
}

/*
 * The dropdowns were once a copy of the names taken when the template was
 * made. A teacher the academy added afterwards could not be chosen for a
 * class at all — Excel refuses what the list does not hold — and past 250
 * characters the copy was cut, halfway through a name if need be.
 */
describe('the dropdowns of the Horario sheet', () => {
  it('offer a teacher added to the Profesores sheet after the template was made', async () => {
    const workbook = await templateOf(academyWith([]));
    const profesores = workbook.getWorksheet('Profesores');
    profesores.getCell(`A${firstEmptyRow(profesores)}`).value = 'Ana Torres';

    assert.ok(offered(workbook, 'Horario', 'E2').includes('Ana Torres'));
  });

  it('offer a genre added to the Generos sheet after the template was made', async () => {
    const workbook = await templateOf(academyWith([]));
    const generos = workbook.getWorksheet('Generos');
    generos.getCell(`A${firstEmptyRow(generos)}`).value = 'Kizomba';

    assert.ok(offered(workbook, 'Horario', 'D2').includes('Kizomba'));
  });

  it('offer every teacher whole, however many there are', async () => {
    const teachers = Array.from({ length: 20 }, (_, index) => ({
      ...MISHEL,
      id: `profesora-${index}`,
      name: `Profesora ${index} con un apellido largo`,
    }));
    const workbook = await templateOf({ ...academyWith([]), teachers });

    assert.deepEqual(offered(workbook, 'Horario', 'E2'), teachers.map((teacher) => teacher.name));
  });
});
