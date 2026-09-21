import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Node's ESM resolver will not find this subpath without the extension, and
// the draft-07 default export cannot compile a 2020-12 schema.
// eslint-disable-next-line import/extensions
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import buildAcademy, { toSlug } from '../build-academy.mjs';

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

const PROFESORES = sheet([
  { nombre: 'Mishel Fernández', generos: 'Salsa, Bachata', imagen: 'mishel_fernandez.jpg' },
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
  it('reads a date cell the same way on either side of Greenwich', () => {
    const original = process.env.TZ;
    const readIn = (tz) => {
      process.env.TZ = tz;
      return buildTeacher({ nacimiento: new Date(Date.UTC(1998, 2, 14)) }).birthDate;
    };

    try {
      assert.equal(readIn('America/Lima'), '1998-03-14');
      assert.equal(readIn('Europe/Madrid'), '1998-03-14');
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('reads the local written form', () => {
    assert.equal(buildTeacher({ nacimiento: '14/03/1998' }).birthDate, '1998-03-14');
  });

  it('accepts a bare year, which is often all anyone knows', () => {
    assert.equal(buildTeacher({ nacimiento: '1998' }).birthDate, '1998');
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
