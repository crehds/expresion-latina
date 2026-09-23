import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Node's ESM resolver will not find this subpath without the extension, and
// the draft-07 default export cannot compile a 2020-12 schema.
// eslint-disable-next-line import/extensions
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import buildAcademy, { toSlug, normaliseWhatsapp, IMAGE_EXTENSION } from '../build-academy.mjs';

const schema = JSON.parse(readFileSync(new URL('../../../src/data/academy.schema.json', import.meta.url)));
const NOW = new Date('2026-01-15T10:00:00.000Z');

/** Rows as parseWorkbook hands them over: keyed by normalised header. */
function sheet(rows, startAt = 2) {
  return rows.map((row, index) => ({ ...row, rowNumber: startAt + index }));
}

const GENEROS = sheet([
  { nombre: 'Salsa' },
  { nombre: 'Bachata' },
  { nombre: 'Latin Urban' },
  { nombre: 'Ensayo Elenco', tipo: 'Ensayo' },
]);

// A real file under src/assets/images/teachers, so the existence check the
// Imagen column now has to pass does not turn every test in this file that
// merely reuses this fixture into an assertion about a missing photograph.
const PROFESORES = sheet([
  { nombre: 'Mishel Fernández', generos: 'Salsa, Bachata', imagen: 'bachata_izquierdo.jpg' },
  { nombre: 'Kenneth Ocaña', generos: 'Bachata' },
]);

function build(sheets, options) {
  return buildAcademy(
    {
      generos: GENEROS, profesores: PROFESORES, estudio: [], ...sheets,
    },
    { now: NOW, ...options },
  );
}

describe('toSlug', () => {
  it('matches the identifiers already in academy.json', () => {
    assert.equal(toSlug('Salsa'), 'salsa');
    assert.equal(toSlug('Latin Urban'), 'latin-urban');
    assert.equal(toSlug('Body Movement'), 'body-movement');
    assert.equal(toSlug('Kenneth Ocaña'), 'kenneth-ocana');
    assert.equal(toSlug('Mishel Fernández'), 'mishel-fernandez');
  });

  it('is stable across spacing and case', () => {
    assert.equal(toSlug('  LATIN   urban '), 'latin-urban');
  });
});

/*
 * src/data/index.js strips every non-digit from this value and builds
 * https://wa.me/<digits>. A number typed the way this academy normally
 * writes one — nine digits, no country code — stripped down to a wa.me
 * address nobody could open. Fixing it here, at import time, means the
 * footer keeps displaying exactly what the academy typed for every other
 * case, and only the one shape that would otherwise be undialable is
 * rewritten.
 */
describe('normaliseWhatsapp', () => {
  const row = { rowNumber: 2 };

  it('leaves an already-international number byte-for-byte unchanged', () => {
    const errors = [];

    assert.equal(normaliseWhatsapp('+51 (960) 507-583', row, errors), '+51 (960) 507-583');
    assert.deepEqual(errors, []);
  });

  it('prefixes a bare mobile number with +51, keeping its spacing', () => {
    const errors = [];

    assert.equal(normaliseWhatsapp('960 507 583', row, errors), '+51 960 507 583');
    assert.deepEqual(errors, []);
  });

  it('leaves a blank value unchanged and raises no error of its own', () => {
    const errors = [];

    assert.equal(normaliseWhatsapp(null, row, errors), null);
    assert.deepEqual(errors, []);
  });

  /*
   * The length is only half the rule, and dropping the other half survived a
   * mutation: a Lima landline is nine digits too. Prefixing one builds a wa.me
   * address for a number WhatsApp never answers on, which is the same
   * undialable link this function exists to prevent.
   */
  it('refuses a nine-digit number that is not a mobile rather than prefixing it', () => {
    const errors = [];

    assert.equal(normaliseWhatsapp('01 234 5678', row, errors), '01 234 5678');
    assert.equal(errors.length, 1);
    assert.equal(errors[0].column, 'Whatsapp');
  });

  /*
   * The same half of the rule on the other branch: every passing case carries
   * exactly eleven digits, so a length test relaxed to greater-or-equal would
   * wave through a mistyped extra digit and publish a number that dials
   * somebody else.
   */
  it('refuses a country-coded number carrying one digit too many', () => {
    const errors = [];

    assert.equal(normaliseWhatsapp('+51 960 507 5834', row, errors), '+51 960 507 5834');
    assert.equal(errors.length, 1);
    assert.equal(errors[0].column, 'Whatsapp');
  });

  it('flags anything else with one Estudio/Whatsapp error and leaves it unchanged', () => {
    const errors = [];
    const result = normaliseWhatsapp('(01) 960-507-583', row, errors);

    assert.equal(result, '(01) 960-507-583');
    assert.equal(errors.length, 1);
    assert.deepEqual(
      { sheet: errors[0].sheet, row: errors[0].row, column: errors[0].column },
      { sheet: 'Estudio', row: 2, column: 'Whatsapp' },
    );
  });
});

/*
 * The importer decides what a pasted photograph may be; src/data/assets.js
 * decides what the site can actually resolve. They are separate lists in
 * separate languages — the glob has to be a literal for Vite to read it at
 * build time, so neither can import the other — and they drifted: the
 * importer took a gif, wrote it, and the site then found nothing under that
 * name. A teacher fell back to their initials with nothing anywhere saying
 * why, which is the same silence the Imagen check exists to end.
 *
 * So this reads the glob out of the real file rather than restating it. A
 * format added to one side and not the other fails here instead of on the
 * published site.
 */
describe('the formats a pasted photograph may take', () => {
  const assets = readFileSync(new URL('../../../src/data/assets.js', import.meta.url), 'utf8');
  const [, pattern] = assets.match(/images\/teachers\/\*\.\{([^}]+)\}/);
  const resolvable = pattern.split(',').map((extension) => extension.trim());

  it('are all ones the site can resolve', () => {
    const unresolvable = [...IMAGE_EXTENSION.values()]
      .filter((extension) => !resolvable.includes(extension));

    assert.deepEqual(unresolvable, [], `src/data/assets.js globs {${pattern}}`);
  });

  it('accept the two shapes a photograph normally arrives in', () => {
    assert.equal(IMAGE_EXTENSION.get('jpg'), 'jpeg');
    assert.equal(IMAGE_EXTENSION.get('png'), 'png');
  });
});

describe('buildAcademy', () => {
  describe('a workbook with no problems', () => {
    const { academy, errors } = build({
      horario: sheet([
        {
          dia: 'Lunes', inicio: '19:00', fin: '20:30', genero: 'Salsa', profesor: 'Mishel Fernández', nivel: 'Principiantes', nota: 'Pack Noches',
        },
        {
          dia: 'martes', inicio: '20:00', fin: '21:00', genero: 'Bachata', profesor: 'Kenneth Ocaña',
        },
      ]),
    }, { sourceFileName: 'horarios.xlsx' });

    it('reports no errors', () => {
      assert.deepEqual(errors, []);
    });

    it('validates against the schema the app enforces', () => {
      const validate = addFormats(new Ajv({ allErrors: true })).compile(schema);
      validate(academy);
      assert.deepEqual(validate.errors ?? [], []);
    });

    it('records where it came from and when, from the injected clock', () => {
      assert.equal(academy.generatedFrom, 'horarios.xlsx');
      assert.equal(academy.generatedAt, NOW.toISOString());
    });

    it('always writes the full week, whatever the spreadsheet mentions', () => {
      assert.equal(academy.days.length, 7);
      assert.equal(academy.days.find((d) => d.name === 'Domingo').weekday, 0);
    });

    // Two classes may start at the same hour and run different lengths, so
    // the order must not depend on which row came first in the spreadsheet.
    it('orders slots that share a start time by when they end', () => {
      const rows = [
        {
          dia: 'Lunes', inicio: '19:00', fin: '20:30', genero: 'Salsa',
        },
        {
          dia: 'Martes', inicio: '19:00', fin: '20:00', genero: 'Bachata',
        },
      ];
      const ids = (order) => build({ horario: sheet(order) })
        .academy.timeSlots.map((slot) => slot.id);

      assert.deepEqual(ids(rows), ['t1900-2000', 't1900-2030']);
      assert.deepEqual(ids([...rows].reverse()), ['t1900-2000', 't1900-2030']);
    });

    it('derives time slots from the classes, sorted by start', () => {
      assert.deepEqual(academy.timeSlots.map((slot) => slot.id), ['t1900-2030', 't2000-2100']);
      assert.equal(academy.timeSlots[0].label, '19:00 - 20:30');
    });

    it('resolves days, genres and teachers to identifiers', () => {
      const [monday] = academy.sessions;

      assert.equal(monday.dayId, 'lunes');
      assert.equal(monday.genreId, 'salsa');
      assert.equal(monday.teacherId, 'mishel-fernandez');
      assert.equal(monday.note, 'Pack Noches');
    });

    it('defaults the room so two classes can never collide by accident', () => {
      assert.equal(academy.sessions[0].room, 'Sala 1');
    });

    it('marks a rehearsal as one, so it stays off the classes page', () => {
      const kinds = Object.fromEntries(academy.genres.map((g) => [g.id, g.kind]));

      assert.equal(kinds.salsa, 'class');
      assert.equal(kinds['ensayo-elenco'], 'rehearsal');
    });

    it('accepts a teacher with no photograph', () => {
      const kenneth = academy.teachers.find((t) => t.id === 'kenneth-ocana');

      assert.equal(kenneth.imageKey, null);
      assert.equal(kenneth.shortName, 'Kenneth');
    });
  });

  describe('reading a day', () => {
    const row = (dia) => build({
      horario: sheet([{
        dia, inicio: '19:00', fin: '20:00', genero: 'Salsa',
      }]),
    });

    it('accepts any spelling a person is likely to type', () => {
      ['Miércoles', 'miercoles', 'MIERCOLES  '].forEach((dia) => {
        const { academy, errors } = row(dia);
        assert.deepEqual(errors, [], `rejected ${dia}`);
        assert.equal(academy.sessions[0].dayId, 'miercoles');
      });
    });

    it('rejects something that is not a day, naming the cell', () => {
      const { academy, errors } = row('Lunez');

      assert.equal(academy, null);
      assert.equal(errors.length, 1);
      assert.deepEqual(
        { sheet: errors[0].sheet, row: errors[0].row, column: errors[0].column },
        { sheet: 'Horario', row: 2, column: 'Dia' },
      );
      assert.match(errors[0].message, /Lunez/);
    });
  });

  describe('rejecting a workbook', () => {
    it('returns no academy at all, so a partial file can never be written', () => {
      const { academy } = build({
        horario: sheet([
          {
            dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa',
          },
          {
            dia: 'Lunes', inicio: '20:00', fin: '21:00', genero: 'Tango',
          },
        ]),
      });

      assert.equal(academy, null);
    });

    it('collects every problem rather than stopping at the first', () => {
      const { errors } = build({
        horario: sheet([
          {
            dia: 'Lunez', inicio: '19:00', fin: '20:00', genero: 'Salsa',
          },
          {
            dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Tango',
          },
          {
            dia: 'Martes', inicio: '19:00', fin: '20:00', genero: 'Salsa', profesor: 'Nadie',
          },
        ]),
      });

      assert.equal(errors.length, 3);
      assert.deepEqual(errors.map((e) => e.column), ['Dia', 'Genero', 'Profesor']);
      assert.deepEqual(errors.map((e) => e.row), [2, 3, 4]);
    });

    it('rejects a class that ends before it starts', () => {
      const { errors } = build({
        horario: sheet([{
          dia: 'Lunes', inicio: '20:00', fin: '19:00', genero: 'Salsa',
        }]),
      });

      assert.equal(errors[0].column, 'Fin');
      assert.match(errors[0].message, /19:00/);
    });

    it('rejects an unreadable time', () => {
      const { errors } = build({
        horario: sheet([{
          dia: 'Lunes', inicio: 'por la tarde', fin: '20:00', genero: 'Salsa',
        }]),
      });

      assert.equal(errors[0].column, 'Inicio');
    });

    it('rejects two classes in one room at one time, naming both rows', () => {
      const { errors } = build({
        horario: sheet([
          {
            dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa',
          },
          {
            dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Bachata',
          },
        ]),
      });

      assert.equal(errors.length, 1);
      assert.equal(errors[0].row, 3);
      assert.match(errors[0].message, /fila 2/);
    });

    it('rejects a duplicated genre, naming the row it repeats', () => {
      const { errors } = build({
        generos: sheet([{ nombre: 'Salsa' }, { nombre: 'salsa' }]),
        // Cleared: the default teachers teach genres this sheet no longer
        // declares, which would report their own errors on top.
        profesores: [],
        horario: [],
      });

      assert.equal(errors.length, 1);
      assert.match(errors[0].message, /fila 2/);
    });
  });

  describe('two classes at the same hour in different rooms', () => {
    const { academy, errors } = build({
      horario: sheet([
        {
          dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa', salon: 'Sala 1',
        },
        {
          dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Bachata', salon: 'Sala 2',
        },
      ]),
    });

    it('is allowed', () => {
      assert.deepEqual(errors, []);
      assert.equal(academy.sessions.length, 2);
    });

    it('gives them distinct identifiers', () => {
      const ids = academy.sessions.map((s) => s.id);
      assert.equal(new Set(ids).size, 2);
    });

    it('puts them in the same slot', () => {
      assert.equal(academy.timeSlots.length, 1);
      assert.equal(academy.sessions[0].slotId, academy.sessions[1].slotId);
    });
  });

  describe('the studio sheet', () => {
    it('maps its fields, including the social ones', () => {
      const { academy } = build({
        horario: [],
        estudio: sheet([
          { campo: 'Nombre', valor: 'Expresión Latina' },
          { campo: 'Direccion', valor: 'Av. Palmeras 3839' },
          { campo: 'WhatsApp', valor: '+51 960 507 583' },
          { campo: 'Instagram', valor: 'https://instagram.com/expresionlatina.peru' },
        ]),
      });

      assert.equal(academy.studio.address, 'Av. Palmeras 3839');
      assert.equal(academy.studio.whatsapp, '+51 960 507 583');
      assert.equal(academy.studio.social.instagram, 'https://instagram.com/expresionlatina.peru');
    });

    it('rejects a field nobody recognises rather than dropping it silently', () => {
      const { errors } = build({
        horario: [],
        estudio: sheet([{ campo: 'Horario de atencion', valor: '9 a 6' }]),
      });

      assert.equal(errors.length, 1);
      assert.equal(errors[0].sheet, 'Estudio');
    });

    it('normalises a bare mobile number typed into the WhatsApp cell', () => {
      const { academy, errors } = build({
        horario: [],
        estudio: sheet([{ campo: 'WhatsApp', valor: '960 507 583' }]),
      });

      assert.deepEqual(errors, []);
      assert.equal(academy.studio.whatsapp, '+51 960 507 583');
    });

    it('rejects a WhatsApp cell it cannot classify, naming the column', () => {
      const { academy, errors } = build({
        horario: [],
        estudio: sheet([{ campo: 'WhatsApp', valor: '(01) 960-507-583' }]),
      });

      assert.equal(academy, null);
      assert.equal(errors.length, 1);
      assert.deepEqual(
        { sheet: errors[0].sheet, column: errors[0].column },
        { sheet: 'Estudio', column: 'Whatsapp' },
      );
    });
  });

  // The spreadsheet has no say over videos, so an import must not be the thing
  // that deletes them.
  describe('content the spreadsheet does not describe', () => {
    const previous = {
      videos: [{
        id: 'ladies-latinas', title: 'Ladies latinas', genreId: 'ladies', assetKey: 'ladies_latinas.mp4',
      }],
      genres: [{ id: 'salsa', videoIds: ['ladies-latinas'] }],
    };

    it('carries the video library across', () => {
      const { academy } = build({ horario: [] }, { previous });

      assert.deepEqual(academy.videos, previous.videos);
    });

    it('keeps the videos attached to a genre', () => {
      const { academy } = build({ horario: [] }, { previous });

      assert.deepEqual(academy.genres.find((g) => g.id === 'salsa').videoIds, ['ladies-latinas']);
    });

    it('starts empty on a first import, rather than failing', () => {
      const { academy } = build({ horario: [] });

      assert.deepEqual(academy.videos, []);
    });
  });
});

describe('a teacher with a video', () => {
  const HORARIO = sheet([
    {
      dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa', profesor: 'Mishel Fernández',
    },
  ]);

  function buildWithVideo(video, previous) {
    return build(
      {
        horario: HORARIO,
        profesores: sheet([
          { nombre: 'Mishel Fernández', generos: 'Salsa', video },
        ]),
      },
      { previous },
    );
  }

  it('reads a link as an external url', () => {
    const { academy } = buildWithVideo('https://youtu.be/abc123');
    const [video] = academy.videos;

    assert.equal(video.externalUrl, 'https://youtu.be/abc123');
    assert.equal(video.assetKey, null);
    assert.equal(video.teacherId, 'mishel-fernandez');
  });

  it('reads anything else as a bundled filename', () => {
    const { academy } = buildWithVideo('mishel_salsa.mp4');
    const [video] = academy.videos;

    assert.equal(video.assetKey, 'mishel_salsa.mp4');
    assert.equal(video.externalUrl, null);
  });

  it('points the teacher at it', () => {
    const { academy } = buildWithVideo('mishel_salsa.mp4');

    assert.deepEqual(academy.teachers[0].videoIds, ['video-mishel-fernandez']);
  });

  // Importing the same workbook twice must not grow the file.
  it('replaces its own previous record rather than adding a second', () => {
    const first = buildWithVideo('old.mp4').academy;
    const second = buildWithVideo('new.mp4', first).academy;

    assert.equal(second.videos.length, 1);
    assert.equal(second.videos[0].assetKey, 'new.mp4');
  });

  // The spreadsheet has no column for these, so only carrying them across
  // keeps them alive.
  it('keeps videos no sheet describes', () => {
    const previous = {
      videos: [{
        id: 'como-llegar', title: 'Cómo llegar', genreId: null, assetKey: 'como_llegar.mp4', externalUrl: null,
      }],
    };
    const { academy } = buildWithVideo('mishel_salsa.mp4', previous);

    assert.deepEqual(academy.videos.map((video) => video.id), ['como-llegar', 'video-mishel-fernandez']);
  });

  // Clearing the cell has to delete the record, not just unlink it: the
  // surviving record still names the teacher, and that is one of the two
  // routes the site resolves a teacher's videos by.
  it('deletes the video when the cell is cleared', () => {
    const first = buildWithVideo('old.mp4').academy;
    const second = buildWithVideo(undefined, first).academy;

    assert.deepEqual(second.videos, []);
    assert.deepEqual(second.teachers[0].videoIds, []);
  });

  // Ownership is by id, not by "names a teacher". A second video attached to
  // someone by hand is not something any row can rebuild, so deleting it for
  // want of a row would destroy hand-curated content on every import.
  it('keeps a second video attached to that teacher by hand', () => {
    const previous = {
      videos: [{
        id: 'mishel-showcase',
        title: 'Showcase 2025',
        genreId: null,
        teacherId: 'mishel-fernandez',
        assetKey: 'showcase.mp4',
        externalUrl: null,
      }],
    };
    const { academy } = buildWithVideo(undefined, previous);

    assert.deepEqual(academy.videos.map((video) => video.id), ['mishel-showcase']);
  });

  it('leaves a teacher with no video alone', () => {
    const { academy } = buildWithVideo(undefined);

    assert.deepEqual(academy.videos, []);
    assert.deepEqual(academy.teachers[0].videoIds, []);
  });
});

/*
 * Naming a file nobody uploaded is how the published data ended up pointing at
 * a photograph that does not exist. A pasted photograph cannot be wrong about
 * itself, so it now wins over the filename column, which still has to name a
 * file that is actually on disk.
 */
describe('a photograph pasted into the Profesores sheet', () => {
  // Opaque to buildAcademy, which never decodes it — only ExcelJS and the
  // browser ever look inside.
  const PHOTO = Buffer.from('a pretend photograph, opaque to buildAcademy');

  const KENNETH = sheet([{ nombre: 'Kenneth Ocaña', generos: 'Bachata' }]);

  it("becomes the teacher's imageKey, named from their own id, and is queued to be written", () => {
    const { academy, errors, photos } = build({
      profesores: KENNETH,
      profesoresImagenes: [{ row: 2, buffer: PHOTO, extension: 'jpg' }],
    });

    assert.deepEqual(errors, []);
    assert.equal(academy.teachers[0].imageKey, 'kenneth-ocana.jpeg');
    assert.deepEqual(photos, [{ filename: 'kenneth-ocana.jpeg', buffer: PHOTO }]);
  });

  it('beats an Imagen filename on the same row', () => {
    const { academy, errors } = build({
      profesores: sheet([{
        nombre: 'Kenneth Ocaña', generos: 'Bachata', imagen: 'bachata_izquierdo.jpg',
      }]),
      profesoresImagenes: [{ row: 2, buffer: PHOTO, extension: 'png' }],
    });

    assert.deepEqual(errors, []);
    assert.equal(academy.teachers[0].imageKey, 'kenneth-ocana.png');
  });

  // jpg and jpeg must collapse to the same file, or re-pasting a photo saved
  // in the other shape would accumulate a second one instead of replacing it.
  it('collapses jpg and jpeg to the one canonical extension', () => {
    const imageKeyWith = (extension) => build({
      profesores: KENNETH,
      profesoresImagenes: [{ row: 2, buffer: PHOTO, extension }],
    }).academy.teachers[0].imageKey;

    assert.equal(imageKeyWith('jpg'), 'kenneth-ocana.jpeg');
    assert.equal(imageKeyWith('JPEG'), 'kenneth-ocana.jpeg');
    assert.equal(imageKeyWith('png'), 'kenneth-ocana.png');
  });

  /*
   * A workbook can carry a gif and the site cannot resolve one, so accepting
   * it wrote a file nothing would ever find — the teacher falling back to
   * their initials with nothing to say why. Refused at the door instead,
   * where it can be said out loud.
   */
  it('refuses a gif, which a workbook carries but the site cannot resolve', () => {
    const { academy, errors } = build({
      profesores: KENNETH,
      profesoresImagenes: [{ row: 2, buffer: PHOTO, extension: 'gif' }],
    });

    assert.equal(academy, null);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].sheet, 'Profesores');
    assert.equal(errors[0].row, 2);
  });

  // The defect this whole change exists to end: a filename with nothing
  // behind it must never reach the published file again.
  it('refuses an Imagen filename that does not exist, naming the sheet, row and column', () => {
    const { academy, errors } = build({
      profesores: sheet([{
        nombre: 'Kenneth Ocaña', generos: 'Bachata', imagen: 'mishel_fernandez.jpg',
      }]),
    });

    assert.equal(academy, null);
    assert.equal(errors.length, 1);
    assert.deepEqual(
      { sheet: errors[0].sheet, row: errors[0].row, column: errors[0].column },
      { sheet: 'Profesores', row: 2, column: 'Imagen' },
    );
    assert.match(errors[0].message, /mishel_fernandez\.jpg/);
  });

  it('keeps the photograph a teacher already had when the row pastes none and names none', () => {
    const previous = { teachers: [{ id: 'kenneth-ocana', imageKey: 'kenneth_old.jpg' }] };

    const { academy, errors } = build({ profesores: KENNETH }, { previous });

    assert.deepEqual(errors, []);
    assert.equal(academy.teachers[0].imageKey, 'kenneth_old.jpg');
  });

  // Dragging an image, or sorting the rows beneath it, can leave it floating
  // over nothing typed at all — the row never reaches the teachers array, so
  // the loop that would otherwise claim the photo never visits it.
  it('refuses a photo anchored to a row with no teacher name', () => {
    const { academy, errors } = build({
      profesores: KENNETH,
      // Row 5 has no entry at all: nothing was ever typed there, only pasted.
      profesoresImagenes: [{ row: 5, buffer: PHOTO, extension: 'jpg' }],
    });

    assert.equal(academy, null);
    assert.equal(errors.length, 1);
    assert.deepEqual(
      { sheet: errors[0].sheet, row: errors[0].row, column: errors[0].column },
      { sheet: 'Profesores', row: 5, column: 'Foto' },
    );
  });

  it('refuses a pasted photo in a format that cannot be used', () => {
    const { academy, errors } = build({
      profesores: KENNETH,
      profesoresImagenes: [{ row: 2, buffer: PHOTO, extension: 'bmp' }],
    });

    assert.equal(academy, null);
    assert.equal(errors.length, 1);
    assert.deepEqual(
      { sheet: errors[0].sheet, row: errors[0].row, column: errors[0].column },
      { sheet: 'Profesores', row: 2, column: 'Foto' },
    );
    assert.match(errors[0].message, /bmp/);
  });
});

describe('a teacher with a birth date and titles', () => {
  function buildTeacher(extra) {
    return build({
      horario: sheet([
        {
          dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa', profesor: 'Mishel Fernández',
        },
      ]),
      profesores: sheet([
        { nombre: 'Mishel Fernández', generos: 'Salsa', ...extra },
      ]),
    }).academy.teachers[0];
  }

  // A real Excel date cell and the text a person types must agree, the same
  // way the class times already have to.
  it('reads an Excel date cell', () => {
    const teacher = buildTeacher({ nacimiento: new Date(Date.UTC(1998, 2, 14)) });

    assert.equal(teacher.birthDate, '1998-03-14');
  });

  /*
   * The same cell must read the same day wherever the importer runs.
   *
   * ExcelJS gives a date cell as UTC midnight of the day the sheet displays,
   * which is why the reader takes the UTC components — the same reason
   * readTime takes getUTCHours. Reading the local components instead looks
   * more natural and answers 13 March in Lima and 14 March in Madrid for one
   * cell. The assertion above cannot tell those apart, because it only ever
   * runs in whatever zone the machine is set to; this one runs both sides of
   * Greenwich.
   */
  it('reads a date cell the same way on either side of Greenwich', (t) => {
    const original = process.env.TZ;
    const readIn = (tz) => {
      process.env.TZ = tz;
      return buildTeacher({ nacimiento: new Date(Date.UTC(1998, 2, 14)) }).birthDate;
    };

    try {
      /*
       * Whether this runtime honours a mid-process TZ change is a property of
       * the environment, not of the importer, so it is a reason to skip rather
       * than to fail: a Node built without full ICU, or one that caches the
       * zone, would otherwise report a product regression that is not there.
       *
       * Without the check the case is worse than useless, because the reader
       * answers with toISOString, which is timezone-invariant — both
       * assertions below would pass on a runtime that ignored the switch, and
       * this would quietly become a duplicate of the case above it.
       */
      const probe = (tz) => {
        process.env.TZ = tz;
        return new Date(Date.UTC(1998, 2, 14)).getDate();
      };

      if (probe('America/Lima') === probe('Europe/Madrid')) {
        t.skip('this runtime ignores a mid-process TZ change');
        return;
      }

      assert.equal(readIn('America/Lima'), '1998-03-14');
      assert.equal(readIn('Europe/Madrid'), '1998-03-14');
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  /*
   * An Invalid Date is a real cell value: a sheet can carry one, and
   * toISOString throws a RangeError on it rather than returning anything.
   * Every textual branch answers null for a date it cannot use, so this one
   * must too — otherwise one bad cell aborts the whole import with an
   * exception instead of the row-scoped error every other bad cell produces.
   */
  it('leaves out an unusable date cell instead of throwing', () => {
    assert.doesNotThrow(() => buildTeacher({ nacimiento: new Date(NaN) }));
    assert.equal(buildTeacher({ nacimiento: new Date(NaN) }).birthDate, null);
  });

  it('reads the local written form', () => {
    assert.equal(buildTeacher({ nacimiento: '14/03/1998' }).birthDate, '1998-03-14');
  });

  it('accepts a bare year, which is often all anyone knows', () => {
    assert.equal(buildTeacher({ nacimiento: '1998' }).birthDate, '1998');
  });

  /*
   * A date can be the right shape and still not exist. Both forms below
   * satisfy the schema's birthDate pattern, which counts digits, so nothing
   * downstream stops them: src/data/index.js hands the string to Date, which
   * rolls the overflow into the next month or year, and the profile shows a
   * confidently wrong age instead of leaving it out.
   */
  it('refuses a day that month never had', () => {
    assert.equal(buildTeacher({ nacimiento: '31/02/1998' }).birthDate, null);
  });

  it('refuses an impossible month', () => {
    assert.equal(buildTeacher({ nacimiento: '31/31/1998' }).birthDate, null);
  });

  it('refuses an impossible iso date', () => {
    assert.equal(buildTeacher({ nacimiento: '1998-13-45' }).birthDate, null);
  });

  it('still accepts the last day of a leap february', () => {
    assert.equal(buildTeacher({ nacimiento: '29/02/1996' }).birthDate, '1996-02-29');
  });

  it('refuses the 29th of a february that had none', () => {
    assert.equal(buildTeacher({ nacimiento: '29/02/1998' }).birthDate, null);
  });

  it('leaves the date out rather than guessing at something unreadable', () => {
    assert.equal(buildTeacher({ nacimiento: 'marzo del 98' }).birthDate, null);
    assert.equal(buildTeacher({}).birthDate, null);
  });

  it('splits titles on lines and reads the year out of the brackets', () => {
    const teacher = buildTeacher({ logros: 'Campeón Nacional Salsa (2023)\nFinalista Mundial (2021)' });

    assert.deepEqual(teacher.achievements, [
      { title: 'Campeón Nacional Salsa', year: 2023 },
      { title: 'Finalista Mundial', year: 2021 },
    ]);
  });

  it('keeps a title that carries no year', () => {
    assert.deepEqual(buildTeacher({ logros: 'Instructor certificado' }).achievements, [
      { title: 'Instructor certificado', year: null },
    ]);
  });

  it('gives an empty list rather than null when the cell is blank', () => {
    assert.deepEqual(buildTeacher({}).achievements, []);
  });
});

describe('the Resenas sheet', () => {
  function buildReviews(rows) {
    return build({
      horario: sheet([
        {
          dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa', profesor: 'Mishel Fernández',
        },
      ]),
      resenas: sheet(rows),
    });
  }

  it('reads an opinion and where it was left', () => {
    const { academy, errors } = buildReviews([{
      autor: 'Evelyn Ramos',
      resena: 'Los profesores explican con paciencia.',
      origen: 'Instagram',
      enlace: 'https://instagram.com/p/abc',
    }]);

    assert.deepEqual(errors, []);
    assert.deepEqual(academy.reviews, [{
      id: 'evelyn-ramos',
      author: 'Evelyn Ramos',
      text: 'Los profesores explican con paciencia.',
      source: 'Instagram',
      sourceUrl: 'https://instagram.com/p/abc',
    }]);
  });

  // Two people share a first name far more often than they share a comment.
  it('keeps two authors with the same name apart', () => {
    const { academy } = buildReviews([
      { autor: 'Ana', resena: 'Primera' },
      { autor: 'Ana', resena: 'Segunda' },
    ]);

    assert.deepEqual(academy.reviews.map((review) => review.id), ['ana', 'ana-2']);
  });

  it('skips a trailing blank row rather than reporting it', () => {
    const { academy, errors } = buildReviews([
      { autor: 'Evelyn', resena: 'Muy buena academia.' },
      {},
    ]);

    assert.deepEqual(errors, []);
    assert.equal(academy.reviews.length, 1);
  });

  it('names the row when half of one is filled in', () => {
    const { academy, errors } = buildReviews([{ autor: 'Evelyn' }]);

    assert.equal(academy, null);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].sheet, 'Resenas');
    assert.equal(errors[0].row, 2);
  });

  const HORARIO_ONLY = {
    horario: sheet([
      {
        dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa', profesor: 'Mishel Fernández',
      },
    ]),
  };

  const PUBLISHED = [{
    id: 'evelyn', author: 'Evelyn', text: 'Muy buena academia.', source: null, sourceUrl: null,
  }];

  /*
   * Every template generated before the Resenas sheet existed is a workbook
   * without one. Rebuilding from the sheet alone meant importing any of them
   * silently deleted every opinion the academy had.
   */
  it('keeps the published opinions when the workbook has no sheet', () => {
    const { academy } = build(HORARIO_ONLY, { previous: { reviews: PUBLISHED } });

    assert.deepEqual(academy.reviews, PUBLISHED);
  });

  // A sheet that is present and empty is the academy deleting them, which is
  // a different statement and is honoured.
  it('empties them when the sheet is there with no rows', () => {
    const { academy } = build(
      { ...HORARIO_ONLY, resenas: [] },
      { previous: { reviews: PUBLISHED } },
    );

    assert.deepEqual(academy.reviews, []);
  });

  it('gives an empty list when there is nothing published either', () => {
    const { academy } = build(HORARIO_ONLY);

    assert.deepEqual(academy.reviews, []);
  });
});

/*
 * The question this codebase has had to answer four times now: what does a
 * workbook that predates a field do to the value already published?
 *
 * An absent column is not an empty cell. parseWorkbook only sets a key for a
 * header the sheet actually has, so a Profesores sheet written before the
 * Nacimiento and Logros columns existed yields rows with no such keys at all
 * — and rebuilding the teacher from those rows wiped both fields off every
 * teacher in the published file.
 *
 * The same distinction the Resenas sheet already makes, one level down.
 */
describe('a workbook older than the teacher fields it does not carry', () => {
  const previous = {
    teachers: [{
      id: 'mishel-fernandez',
      name: 'Mishel Fernández',
      birthDate: '1997-05-02',
      achievements: [{ title: 'Campeona Nacional', year: 2023 }],
    }],
  };

  // No nacimiento or logros key at all, the way an older sheet arrives.
  const OLD_SHEET = sheet([{ nombre: 'Mishel Fernández', generos: 'Salsa' }]);

  function importWith(profesores) {
    return build({
      horario: sheet([{
        dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa', profesor: 'Mishel Fernández',
      }]),
      profesores,
    }, { previous }).academy.teachers[0];
  }

  it('keeps a birth date the sheet says nothing about', () => {
    assert.equal(importWith(OLD_SHEET).birthDate, '1997-05-02');
  });

  it('keeps titles the sheet says nothing about', () => {
    assert.deepEqual(importWith(OLD_SHEET).achievements, previous.teachers[0].achievements);
  });

  /*
   * The other half of the contract. A column that is present and empty is the
   * academy removing the value on purpose, and must still clear it — otherwise
   * a published date could never be taken back.
   */
  it('clears a birth date the sheet deliberately empties', () => {
    const emptied = sheet([{
      nombre: 'Mishel Fernández', generos: 'Salsa', nacimiento: null, logros: null,
    }]);

    assert.equal(importWith(emptied).birthDate, null);
  });

  it('clears titles the sheet deliberately empties', () => {
    const emptied = sheet([{
      nombre: 'Mishel Fernández', generos: 'Salsa', nacimiento: null, logros: null,
    }]);

    assert.deepEqual(importWith(emptied).achievements, []);
  });
});

/*
 * The sheet owns exactly one video id per teacher, the same ownership rule
 * mergeVideos applies to the records themselves. A link the published file held
 * to some other video was made by hand, and an import that says nothing about
 * it may not unlink it.
 *
 * The record surviving while the link is dropped is the bad half: a video with
 * no teacherId that nothing points at falls into getAcademyVideos, which reads
 * "no genre, no teacher" as the school's own reel and shows it on every genre
 * page with no footage of its own.
 */
describe('a teacher who also links a video added by hand', () => {
  const HORARIO = sheet([
    {
      dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa', profesor: 'Mishel Fernández',
    },
  ]);

  const HAND_ADDED = {
    id: 'clase-abierta',
    title: 'Clase abierta',
    genreId: null,
    assetKey: 'clase_abierta.mp4',
    externalUrl: null,
  };

  const previousWith = (videoIds) => ({
    videos: [HAND_ADDED],
    teachers: [{ id: 'mishel-fernandez', videoIds }],
  });

  const buildWith = (video, previous) => build(
    {
      horario: HORARIO,
      profesores: sheet([{ nombre: 'Mishel Fernández', generos: 'Salsa', video }]),
    },
    { previous },
  );

  it('keeps the hand-made link when the cell names a video', () => {
    const { academy } = buildWith('mishel_salsa.mp4', previousWith(['clase-abierta']));

    assert.deepEqual(
      academy.teachers[0].videoIds,
      ['clase-abierta', 'video-mishel-fernandez'],
    );
  });

  it('keeps the hand-made link when the cell is empty', () => {
    const { academy } = buildWith('', previousWith(['clase-abierta']));

    assert.deepEqual(academy.teachers[0].videoIds, ['clase-abierta']);
  });

  // Its own id is the one thing the sheet may take back, and an emptied cell
  // is the academy taking it back.
  it('still drops its own id when the cell is emptied', () => {
    const previous = previousWith(['clase-abierta', 'video-mishel-fernandez']);
    const { academy } = buildWith('', previous);

    assert.deepEqual(academy.teachers[0].videoIds, ['clase-abierta']);
  });

  it('does not list its own id twice when the cell still names one', () => {
    const previous = previousWith(['video-mishel-fernandez']);
    const { academy } = buildWith('mishel_salsa.mp4', previous);

    assert.deepEqual(academy.teachers[0].videoIds, ['video-mishel-fernandez']);
  });

  it('leaves the hand-made video reachable from the teacher', () => {
    const { academy } = buildWith('mishel_salsa.mp4', previousWith(['clase-abierta']));

    assert.ok(academy.videos.some((video) => video.id === 'clase-abierta'));
    assert.ok(academy.teachers[0].videoIds.includes('clase-abierta'));
  });
});

/*
 * A share sheet hands out addresses with no protocol, and "://" is the only
 * thing telling a link from a filename. Such a value used to be written as an
 * assetKey naming a file that is not in the bundle: resolveVideoAsset answers
 * undefined, the card renders with nothing to play, and the import reports
 * success. Neither shape is guessed at now — an unrecognisable value is a cell
 * to fix, which is the one outcome the academy can act on.
 */
describe('a Video cell that is neither a link nor a file', () => {
  const HORARIO = sheet([
    {
      dia: 'Lunes', inicio: '19:00', fin: '20:00', genero: 'Salsa', profesor: 'Mishel Fernández',
    },
  ]);

  const buildWith = (video) => build({
    horario: HORARIO,
    profesores: sheet([{ nombre: 'Mishel Fernández', generos: 'Salsa', video }]),
  });

  const messages = ({ errors }) => errors.map((problem) => problem.message).join('\n');

  it('refuses a link pasted without its protocol', () => {
    const result = buildWith('youtu.be/abc123');

    assert.equal(result.academy, null);
    assert.match(messages(result), /youtu\.be\/abc123/);
  });

  it('refuses a bare host copied from the address bar', () => {
    assert.equal(buildWith('www.youtube.com/watch?v=abc').academy, null);
  });

  it('refuses a filename with no video extension', () => {
    assert.equal(buildWith('mishel_salsa').academy, null);
  });

  it('says how to correct the cell', () => {
    assert.match(messages(buildWith('youtu.be/abc123')), /https:\/\/|\.mp4/);
  });

  it('names the sheet, the row and the column', () => {
    const [problem] = buildWith('youtu.be/abc').errors;

    assert.equal(problem.sheet, 'Profesores');
    assert.equal(problem.column, 'Video');
    assert.equal(problem.row, 2);
  });

  it('still accepts a webm file', () => {
    const { academy } = buildWith('mishel_salsa.webm');

    assert.equal(academy.videos[0].assetKey, 'mishel_salsa.webm');
  });

  it('is not case sensitive about the extension', () => {
    const { academy } = buildWith('Mishel_Salsa.MP4');

    assert.equal(academy.videos[0].assetKey, 'Mishel_Salsa.MP4');
  });
});
