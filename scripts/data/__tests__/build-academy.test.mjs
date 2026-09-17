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
