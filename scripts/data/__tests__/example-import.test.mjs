import assert from 'node:assert/strict';
import {
  mkdtempSync, readdirSync, readFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  after, before, describe, it,
} from 'node:test';
import { fileURLToPath } from 'node:url';

// Node's ESM resolver will not find this subpath without the extension, and
// the draft-07 default export cannot compile a 2020-12 schema.
// eslint-disable-next-line import/extensions
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import buildAcademy from '../build-academy.mjs';
import runImport from '../import.mjs';
import parseWorkbook from '../parse-workbook.mjs';

/*
 * The importer is tested against spreadsheet rows (scripts/data/__tests__)
 * and the app is tested against the committed src/data/academy.json
 * (src/data/academy.test.js), but nothing ran the app's checks against what
 * the importer actually produces. A schema-valid, cross-reference-valid file
 * that names a photograph nobody wrote — the historical mishel_fernandez.jpg
 * defect — sailed through both suites with nothing red, because neither one
 * ever looked at the other's output.
 *
 * This imports content/ejemplo-completo.xlsx into a throwaway directory and
 * runs the equivalent of academy.test.js's assertions against that fresh
 * output. It writes nothing under src/.
 *
 * The fixture is the worked example rather than content/horarios.xlsx, which
 * is the academy's own workbook and changes whenever they upload a new one.
 * A suite pinned to it would be asserting things about content they are free
 * to edit; this one asserts things about the importer.
 *
 * ejemplo-completo.xlsx is generated from academy.json by make-example.mjs,
 * so most of what it carries is already published; what makes it a useful
 * fixture is what it adds that the committed file does not: reviews, where
 * academy.json has none, and a description on every genre, where it has none
 * either.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const FIXTURE = resolve(repoRoot, 'content/ejemplo-completo.xlsx');
const schema = JSON.parse(readFileSync(resolve(repoRoot, 'src/data/academy.schema.json'), 'utf8'));

const workDir = mkdtempSync(join(tmpdir(), 'eyl-example-import-'));
after(() => rmSync(workDir, { recursive: true, force: true }));

let academy;
let photosDir;
let reportedPhotos;
let sourceRows;

before(async () => {
  const target = join(workDir, 'academy.json');
  photosDir = mkdtempSync(join(workDir, 'photos-'));

  const code = await runImport([FIXTURE], { target, photosDir });
  assert.equal(code, 0, 'the example workbook must import cleanly for this suite to mean anything');

  academy = JSON.parse(readFileSync(target, 'utf8'));

  /*
   * The same source parsed and built a second time, only to read the `photos`
   * list buildAcademy hands back — import.mjs writes it to disk but does not
   * return it. Nothing here is written twice: buildAcademy computes filenames
   * and buffers in memory, and only import.mjs's own writePhoto() call above
   * touched `photosDir`.
   *
   * Known limitation: resolveImageKey's legacy-Imagen-filename branch checks
   * existence against the real src/assets/images/teachers folder, a path
   * hardcoded in build-academy.mjs rather than accepted as an override. It is
   * not exercised by this fixture, since every photograph here is pasted
   * directly into the sheet rather than named by filename.
   */
  const sheets = await parseWorkbook(FIXTURE);
  ({ photos: reportedPhotos } = buildAcademy(sheets, { sourceFileName: 'ejemplo-completo.xlsx' }));

  // What the workbook itself says it holds, so "none were lost" can be
  // asserted without a number written down anywhere.
  sourceRows = { generos: sheets.generos.length, resenas: sheets.resenas.length };
});

function idsOf(collection) {
  return collection.map((entry) => entry.id);
}

describe('the example workbook, imported fresh', () => {
  it('matches the schema the app itself validates against', () => {
    const ajv = addFormats(new Ajv({ allErrors: true }));
    const validate = ajv.compile(schema);

    validate(academy);

    // Surfaces the offending path and rule rather than a bare `false`.
    assert.deepEqual(validate.errors ?? [], []);
  });

  it('resolves every reference a session makes', () => {
    const dayIds = new Set(idsOf(academy.days));
    const slotIds = new Set(idsOf(academy.timeSlots));
    const genreIds = new Set(idsOf(academy.genres));
    const teacherIds = new Set(idsOf(academy.teachers));

    academy.sessions.forEach((session) => {
      assert.ok(dayIds.has(session.dayId), `session ${session.id} names the unknown day "${session.dayId}"`);
      assert.ok(slotIds.has(session.slotId), `session ${session.id} names the unknown slot "${session.slotId}"`);
      assert.ok(genreIds.has(session.genreId), `session ${session.id} names the unknown genre "${session.genreId}"`);
      if (session.teacherId) {
        assert.ok(
          teacherIds.has(session.teacherId),
          `session ${session.id} names the unknown teacher "${session.teacherId}"`,
        );
      }
    });
  });

  describe('photographs', () => {
    // The mishel_fernandez.jpg class of defect: schema-valid and
    // cross-reference-valid, but pointing at a file that was never written.
    it('has a written photo for every teacher that declares one', () => {
      const onDisk = new Set(readdirSync(photosDir));

      academy.teachers.forEach((teacher) => {
        if (!teacher.imageKey) return;
        assert.ok(
          onDisk.has(teacher.imageKey),
          `${teacher.name} names "${teacher.imageKey}", which the import did not write to ${photosDir}`,
        );
      });
    });

    it('writes every photo the importer reported to disk', () => {
      // The fixture pastes several photographs; an empty list here would mean
      // this check is passing by finding nothing to verify.
      assert.ok(reportedPhotos.length > 0, 'expected the fixture to paste at least one photograph');

      const onDisk = new Set(readdirSync(photosDir));
      reportedPhotos.forEach((photo) => {
        assert.ok(onDisk.has(photo.filename), `"${photo.filename}" was reported written but is not on disk`);
      });
    });
  });

  /*
   * Counted against the workbook rather than against a number written here.
   * A literal would go red the day the academy adds a genre, with nothing
   * wrong; "at least one" would stay green while all but one were dropped.
   * The source says how many there should be, and it is the only thing that
   * can.
   */
  describe('content this fixture adds beyond the committed file', () => {
    it('carries every review across', () => {
      assert.ok(sourceRows.resenas > 0, 'the example should carry reviews to begin with');
      assert.equal(academy.reviews.length, sourceRows.resenas);

      academy.reviews.forEach((review) => {
        assert.ok(review.text, `review "${review.id}" has no text`);
        assert.ok(review.author, `review "${review.id}" has no author`);
      });
    });

    it('carries every genre across, each with a description', () => {
      assert.ok(sourceRows.generos > 0, 'the example should carry genres to begin with');
      assert.equal(academy.genres.length, sourceRows.generos);

      academy.genres.forEach((genre) => {
        assert.ok(genre.description?.trim(), `genre "${genre.id}" has no description`);
      });
    });
  });
});
