import assert from 'node:assert/strict';
import {
  existsSync, mkdtempSync, readdirSync, readFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import ExcelJS from 'exceljs';

import runImport from '../import.mjs';

const workDir = mkdtempSync(join(tmpdir(), 'eyl-import-'));
after(() => rmSync(workDir, { recursive: true, force: true }));

// A real, minimal PNG: the pipeline writes these bytes to disk unchanged, so a
// genuine image is the honest fixture for what a person actually pastes.
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function writeWorkbook(build) {
  const file = join(workDir, `${Math.random().toString(36).slice(2)}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  await workbook.xlsx.writeFile(file);
  return file;
}

/**
 * The smallest workbook guardAcademy and validateAcademy both accept, with a
 * photograph pasted for its one teacher — everything importing for real
 * actually has to run through: parsing, building, guarding, validating, then
 * writing.
 */
function workbookWithPastedPhoto() {
  return writeWorkbook((workbook) => {
    const horario = workbook.addWorksheet('Horario');
    horario.addRow(['Dia', 'Inicio', 'Fin', 'Genero', 'Profesor']);
    horario.addRow(['Lunes', '19:00', '20:00', 'Salsa', 'Kenneth Ocaña']);

    const generos = workbook.addWorksheet('Generos');
    generos.addRow(['Nombre']);
    generos.addRow(['Salsa']);

    const profesores = workbook.addWorksheet('Profesores');
    profesores.addRow(['Nombre', 'Generos']);
    profesores.addRow(['Kenneth Ocaña', 'Salsa']);

    const imageId = workbook.addImage({ buffer: PHOTO, extension: 'png' });
    // Native row 1 is spreadsheet row 2: Kenneth's row.
    profesores.addImage(imageId, {
      tl: { nativeCol: 2, nativeRow: 1 },
      ext: { width: 40, height: 40 },
    });

    const estudio = workbook.addWorksheet('Estudio');
    estudio.addRow(['Campo', 'Valor']);
    estudio.addRow(['Direccion', 'Av. Palmeras 3839']);
    estudio.addRow(['WhatsApp', '+51 960 507 583']);
    estudio.addRow(['Email', 'expresionlatina@gmail.com']);
  });
}

/** A throwaway academy.json path and an empty photos folder, both unique per test. */
function freshDestination() {
  const target = join(workDir, `academy-${Math.random().toString(36).slice(2)}.json`);
  const photosDir = mkdtempSync(join(workDir, 'photos-'));
  return { target, photosDir };
}

describe('importing a workbook with a photograph pasted into it', () => {
  it('writes the photo into the assets folder, named from the teacher, and records that name', async () => {
    const file = await workbookWithPastedPhoto();
    const { target, photosDir } = freshDestination();

    const code = await runImport([file], { target, photosDir });

    assert.equal(code, 0);
    const academy = JSON.parse(readFileSync(target, 'utf8'));
    assert.equal(academy.teachers[0].imageKey, 'kenneth-ocana.png');
    assert.deepEqual(readFileSync(join(photosDir, 'kenneth-ocana.png')), PHOTO);
  });

  // The one guarantee a dry run makes: nothing on disk changes, not the JSON
  // and not a single photograph.
  it('writes nothing at all with --dry-run', async () => {
    const file = await workbookWithPastedPhoto();
    const { target, photosDir } = freshDestination();

    const code = await runImport([file, '--dry-run'], { target, photosDir });

    assert.equal(code, 0);
    assert.equal(existsSync(target), false);
    assert.deepEqual(readdirSync(photosDir), []);
  });
});
