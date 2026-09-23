import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import ExcelJS from 'exceljs';

import parseWorkbook, { normalise, readText, readTime } from '../parse-workbook.mjs';

const workDir = mkdtempSync(join(tmpdir(), 'eyl-parse-'));
after(() => rmSync(workDir, { recursive: true, force: true }));

describe('normalise', () => {
  it('folds accents, case and stray whitespace together', () => {
    ['Miércoles', 'miercoles', '  MIERCOLES  ', 'Miércoles'].forEach((input) => {
      assert.equal(normalise(input), 'miercoles');
    });
  });

  it('collapses inner whitespace', () => {
    assert.equal(normalise('Latin   Urban'), 'latin urban');
  });

  it('treats null and undefined as empty', () => {
    assert.equal(normalise(null), '');
    assert.equal(normalise(undefined), '');
  });
});

describe('readTime', () => {
  it('reads a real Excel time cell, which arrives as a UTC Date', () => {
    // 19:00 as ExcelJS hands it back: the epoch date carrying the time in UTC.
    assert.equal(readTime(new Date(Date.UTC(1899, 11, 30, 19, 0))), '19:00');
  });

  it('reads a raw serial number as a fraction of a day', () => {
    assert.equal(readTime(19 / 24), '19:00');
    assert.equal(readTime(20.5 / 24), '20:30');
  });

  it('reads text a person typed', () => {
    assert.equal(readTime('19:00'), '19:00');
    assert.equal(readTime(' 9:05 '), '09:05');
    assert.equal(readTime('9.30'), '09:30');
  });

  it('reads a twelve-hour time with a meridiem', () => {
    assert.equal(readTime('7:00 pm'), '19:00');
    assert.equal(readTime('7:00 p.m.'), '19:00');
    assert.equal(readTime('12:15 am'), '00:15');
    assert.equal(readTime('12:15 pm'), '12:15');
  });

  it('gives the same answer for every shape of the same time', () => {
    const shapes = [new Date(Date.UTC(1899, 11, 30, 20, 30)), 20.5 / 24, '20:30', '8:30 pm'];
    const answers = new Set(shapes.map(readTime));

    assert.deepEqual([...answers], ['20:30']);
  });

  it('returns null for an empty or unreadable cell', () => {
    [null, undefined, '', '   ', 'por la tarde', '99:99'].forEach((input) => {
      assert.equal(readTime(input), null, `expected null for ${JSON.stringify(input)}`);
    });
  });
});

describe('readText', () => {
  it('trims, and turns an empty cell into null', () => {
    assert.equal(readText('  Salsa '), 'Salsa');
    assert.equal(readText(''), null);
    assert.equal(readText('   '), null);
    assert.equal(readText(null), null);
  });

  it('unwraps the object a hyperlink or formula cell arrives as', () => {
    assert.equal(readText({ text: 'Salsa', hyperlink: 'https://x' }), 'Salsa');
    assert.equal(readText({ result: 'Bachata' }), 'Bachata');
  });
});

describe('parseWorkbook', () => {
  async function writeWorkbook(build) {
    const file = join(workDir, `${Math.random().toString(36).slice(2)}.xlsx`);
    const workbook = new ExcelJS.Workbook();
    build(workbook);
    await workbook.xlsx.writeFile(file);
    return file;
  }

  it('reads a real time cell back as the time that was written', async () => {
    const file = await writeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Horario');
      sheet.addRow(['Dia', 'Inicio', 'Fin', 'Genero']);
      const row = sheet.addRow(['Lunes', new Date(Date.UTC(1899, 11, 30, 19, 0)), '20:30', 'Salsa']);
      row.getCell(2).numFmt = 'hh:mm';
    });

    const { horario } = await parseWorkbook(file);

    assert.equal(horario.length, 1);
    assert.equal(readTime(horario[0].inicio), '19:00');
    assert.equal(readTime(horario[0].fin), '20:30');
  });

  it('matches headers by name, so a reordered column still lands correctly', async () => {
    const file = await writeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Horario');
      sheet.addRow(['Genero', 'Dia', 'Nivel', 'Inicio']);
      sheet.addRow(['Bachata', 'Martes', 'Básico', '20:00']);
    });

    const [row] = (await parseWorkbook(file)).horario;

    assert.equal(readText(row.dia), 'Martes');
    assert.equal(readText(row.genero), 'Bachata');
    assert.equal(readTime(row.inicio), '20:00');
  });

  it('folds accented headers', async () => {
    const file = await writeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Horario');
      sheet.addRow(['Día', 'Género', 'Salón']);
      sheet.addRow(['Lunes', 'Salsa', 'Sala 2']);
    });

    const [row] = (await parseWorkbook(file)).horario;

    assert.equal(readText(row.dia), 'Lunes');
    assert.equal(readText(row.genero), 'Salsa');
    assert.equal(readText(row.salon), 'Sala 2');
  });

  it('skips blank rows rather than reporting them', async () => {
    const file = await writeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Horario');
      sheet.addRow(['Dia', 'Genero']);
      sheet.addRow(['Lunes', 'Salsa']);
      sheet.addRow([]);
      sheet.addRow(['', '   ']);
      sheet.addRow(['Martes', 'Bachata']);
    });

    const { horario } = await parseWorkbook(file);

    assert.equal(horario.length, 2);
    assert.deepEqual(horario.map((r) => readText(r.dia)), ['Lunes', 'Martes']);
  });

  it('keeps the spreadsheet row number, so an error can point at the cell', async () => {
    const file = await writeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Horario');
      sheet.addRow(['Dia']);
      sheet.addRow(['Lunes']);
      sheet.addRow(['Martes']);
    });

    const { horario } = await parseWorkbook(file);

    assert.deepEqual(horario.map((r) => r.rowNumber), [2, 3]);
  });

  it('finds a sheet whatever its capitalisation', async () => {
    const file = await writeWorkbook((workbook) => {
      workbook.addWorksheet('HORARIO').addRow(['Dia']);
      const generos = workbook.addWorksheet('géneros');
      generos.addRow(['Nombre']);
      generos.addRow(['Salsa']);
    });

    const { generos } = await parseWorkbook(file);

    assert.equal(generos.length, 1);
  });

  // The distinction an import needs in order to honour a deletion: a sheet
  // that is not in the workbook said nothing, a sheet with no rows said none.
  it('returns null for a sheet that is not there', async () => {
    const file = await writeWorkbook((workbook) => {
      workbook.addWorksheet('Horario').addRow(['Dia']);
    });

    const sheets = await parseWorkbook(file);

    assert.equal(sheets.profesores, null);
    assert.equal(sheets.estudio, null);
  });

  it('returns an empty list for a sheet that is there and empty', async () => {
    const file = await writeWorkbook((workbook) => {
      workbook.addWorksheet('Horario').addRow(['Dia']);
      workbook.addWorksheet('Resenas').addRow(['Autor', 'Resena']);
    });

    const sheets = await parseWorkbook(file);

    assert.deepEqual(sheets.resenas, []);
  });

  /*
   * A real, minimal PNG rather than arbitrary bytes: ExcelJS stores whatever
   * buffer it is given without decoding it, but a fixture built from actual
   * image bytes is the honest stand-in for what a person actually pastes.
   */
  const PHOTO = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  describe('photographs pasted into the Profesores sheet', () => {
    it('reads a pasted photo back with the 1-based row it is anchored to', async () => {
      const file = await writeWorkbook((workbook) => {
        const sheet = workbook.addWorksheet('Profesores');
        sheet.addRow(['Nombre', 'Imagen']);
        sheet.addRow(['Kenneth Ocaña', '']);
        sheet.addRow(['Mishel Fernández', '']);

        const imageId = workbook.addImage({ buffer: PHOTO, extension: 'png' });
        // Native row 2 is spreadsheet row 3 (Mishel's), and the column is a
        // deliberately different number: a reader that swapped row for column
        // would land on row 7, not row 3, so the mistake cannot hide.
        sheet.addImage(imageId, {
          tl: { nativeCol: 6, nativeRow: 2 },
          ext: { width: 40, height: 40 },
        });
      });

      const { profesoresImagenes } = await parseWorkbook(file);

      assert.equal(profesoresImagenes.length, 1);
      assert.equal(profesoresImagenes[0].row, 3);
      assert.equal(profesoresImagenes[0].extension, 'png');
      assert.deepEqual(profesoresImagenes[0].buffer, PHOTO);
    });

    it('returns an empty list when the sheet carries no images', async () => {
      const file = await writeWorkbook((workbook) => {
        const sheet = workbook.addWorksheet('Profesores');
        sheet.addRow(['Nombre']);
        sheet.addRow(['Kenneth Ocaña']);
      });

      const { profesoresImagenes } = await parseWorkbook(file);

      assert.deepEqual(profesoresImagenes, []);
    });

    it('returns an empty list when there is no Profesores sheet at all', async () => {
      const file = await writeWorkbook((workbook) => {
        workbook.addWorksheet('Horario').addRow(['Dia']);
      });

      const { profesoresImagenes } = await parseWorkbook(file);

      assert.deepEqual(profesoresImagenes, []);
    });
  });
});
