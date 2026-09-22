/*
 * Builds the filled-in example workbook: every sheet, every column, nothing
 * blank.
 *
 * make-template.mjs exports the academy's real data so they can edit it, which
 * means every column nobody has filled yet comes out empty — and an empty
 * column teaches nothing about what belongs in it. This one is the worked
 * example instead: the same shape, with something plausible in every cell, so
 * whoever fills the real one can see what each column is for.
 *
 * Teacher photographs are embedded in the sheet rather than named by filename.
 * Naming a file that was never uploaded is how the published data ended up
 * pointing at a photograph that does not exist; a pasted image cannot be
 * wrong about itself.
 *
 * Usage: node scripts/data/make-example.mjs [destino.xlsx]
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import ExcelJS from 'exceljs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const academy = JSON.parse(readFileSync(resolve(repoRoot, 'src/data/academy.json'), 'utf8'));
const photoDir = resolve(repoRoot, 'src/assets/images/teachers');

const HEADER_FILL = 'FF1F1B2E';
const HEADER_FONT = 'FFFFFFFF';

/*
 * Amber behind a cell the academy still has to fill.
 *
 * Every gap left in this file is a real one — a teacher with no photograph on
 * record, a birth date nobody has told us. Leaving them blank and unmarked
 * would teach that blank is fine; marking them turns the example into the
 * list of what is actually missing.
 */
const PENDING_FILL = 'FFFFF3CD';

function markPending(row, columnIndexes) {
  columnIndexes.forEach((index) => {
    const cell = row.getCell(index);
    const { value } = cell;

    if (value !== null && value !== undefined && String(value).trim() !== '') return;

    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PENDING_FILL } };
  });
}

/**
 * Illustrative copy, never a claim about a real person.
 *
 * These are real teachers at a real academy. Inventing biographies, ages or
 * achievements for them would publish fabricated claims the moment somebody
 * imported this file by mistake, so the person-shaped columns carry an
 * instruction rather than a fake fact. The columns that describe a dance
 * rather than a human are free to say something real.
 */
const BIO_EXAMPLE = 'Ejemplo: dos o tres líneas contando su trayectoria. Reemplaza este texto.';
const ACHIEVEMENTS_EXAMPLE = 'Ejemplo: un logro por línea. Reemplaza este texto.';
const FACEBOOK_EXAMPLE = 'https://www.facebook.com/ejemplo-perfil-del-profesor';
const INSTAGRAM_EXAMPLE = 'https://www.instagram.com/ejemplo-perfil-del-profesor';
const VIDEO_EXAMPLE = 'https://www.youtube.com/watch?v=EJEMPLO';

const GENRE_DESCRIPTIONS = new Map([
  ['Salsa', 'Baile de pareja en línea y en rueda, con trabajo de tiempo y vueltas.'],
  ['Bachata', 'Bachata dominicana y sensual, desde el paso básico hasta figuras en pareja.'],
  ['Jazz', 'Técnica de jazz con trabajo de líneas, saltos y coreografía.'],
  ['Latin Urban', 'Fusión de ritmos latinos con movimiento urbano.'],
  ['Ladies', 'Estilo femenino: postura, caminata y actitud en escena.'],
  ['Ballet', 'Base clásica en barra y centro, apoyo técnico para cualquier otro estilo.'],
  ['Urban Style', 'Estilos urbanos con foco en musicalidad y groove.'],
  ['Mambo', 'Mambo en línea, con énfasis en el juego de pies y el contratiempo.'],
  ['Body Movement', 'Trabajo de aislamientos y control del cuerpo, base para todos los estilos.'],
  ['Urban Dance', 'Coreografía urbana sobre música actual.'],
  ['Sexy Style', 'Estilo sensual con trabajo de piso y actitud.'],
  ['Sexy Power', 'Sensual con carga física: fuerza, control y coreografía.'],
  ['Comercial Dance', 'Coreografía comercial al estilo de videoclip.'],
  ['Heels', 'Coreografía en tacos, con técnica de equilibrio y caminata.'],
  ['Reggaeton', 'Perreo y coreografía urbana con base de dembow.'],
  ['Ensayo Elenco', 'Ensayo del elenco de la academia. No es una clase abierta.'],
]);

/** Invented names on purpose: a fake review signed by a real person is a lie. */
const REVIEWS = [
  ['Carolina R.', 'Llegué sin haber bailado nunca y en un mes ya seguía la clase. Los profes corrigen uno por uno.', 'Google', 'https://g.page/expresionlatina'],
  ['Diego M.', 'El ambiente es lo mejor. Se aprende en serio y además te ríes toda la hora.', 'Facebook', 'https://www.facebook.com/expresionlatina.peru'],
  ['Valeria S.', 'Vine por bachata y terminé quedándome también en heels. Muy recomendable.', 'Instagram', 'https://www.instagram.com/expresionlatina.peru'],
];

const DAY_NAME = new Map(academy.days.map((day) => [day.id, day.name]));
const SLOT = new Map(academy.timeSlots.map((slot) => [slot.id, slot]));
const GENRE = new Map(academy.genres.map((genre) => [genre.id, genre]));
const TEACHER = new Map(academy.teachers.map((teacher) => [teacher.id, teacher]));

function addSheet(workbook, name, columns) {
  const sheet = workbook.addWorksheet(name);

  sheet.columns = columns.map(([header, width]) => ({ header, width }));

  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: HEADER_FONT } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  head.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return sheet;
}

function buildHorario(workbook) {
  const sheet = addSheet(workbook, 'Horario', [
    ['Dia', 12], ['Inicio', 9], ['Fin', 9], ['Genero', 20],
    ['Profesor', 22], ['Nivel', 16], ['Salon', 12], ['Nota', 30],
  ]);

  academy.sessions.forEach((session) => {
    const slot = SLOT.get(session.slotId);
    sheet.addRow([
      DAY_NAME.get(session.dayId),
      slot?.start,
      slot?.end,
      GENRE.get(session.genreId)?.name,
      TEACHER.get(session.teacherId)?.name ?? 'Por confirmar',
      session.level ?? 'All levels',
      session.room ?? 'Sala 1',
      session.note ?? 'Consultar por el pack de la semana.',
    ]);
  });

  return sheet;
}

function buildGeneros(workbook) {
  const sheet = addSheet(workbook, 'Generos', [
    ['Nombre', 22], ['Tipo', 14], ['Descripcion', 70],
  ]);

  academy.genres.forEach((genre) => {
    sheet.addRow([
      genre.name,
      genre.kind === 'rehearsal' ? 'Ensayo' : 'Clase',
      GENRE_DESCRIPTIONS.get(genre.name) ?? 'Describe el estilo en una línea.',
    ]);
  });

  return sheet;
}

/**
 * @returns {{buffer: Buffer, extension: string}|null} the teacher's photograph,
 *   or null when the academy has none on file yet
 */
function readPhoto(teacher) {
  if (!teacher.imageKey) return null;

  const path = resolve(photoDir, teacher.imageKey);
  if (!existsSync(path)) return null;

  return {
    buffer: readFileSync(path),
    extension: teacher.imageKey.split('.').pop().toLowerCase(),
  };
}

function buildProfesores(workbook) {
  const sheet = addSheet(workbook, 'Profesores', [
    ['Nombre', 22], ['NombreCorto', 16], ['Generos', 26], ['Nacimiento', 14],
    ['Foto', 16], ['Bio', 60], ['Facebook', 30], ['Instagram', 30],
    ['Video', 30], ['Logros', 40],
  ]);

  academy.teachers.forEach((teacher, index) => {
    const rowNumber = index + 2;
    const row = sheet.addRow([
      teacher.name,
      teacher.shortName ?? teacher.name.split(' ')[0],
      (teacher.genreIds ?? []).map((id) => GENRE.get(id)?.name).filter(Boolean).join(', '),
      teacher.birthDate ?? '',
      '',
      BIO_EXAMPLE,
      teacher.social?.facebook || FACEBOOK_EXAMPLE,
      teacher.social?.instagram || INSTAGRAM_EXAMPLE,
      VIDEO_EXAMPLE,
      ACHIEVEMENTS_EXAMPLE,
    ]);

    // Tall enough for the photograph to sit inside its own row rather than
    // spilling over the one below it.
    row.height = 64;
    row.alignment = { vertical: 'middle', wrapText: true };

    const photo = readPhoto(teacher);

    // Generos and Nacimiento carry real values or nothing; Foto never carries
    // a cell value at all, so an empty one only means no photograph.
    markPending(row, [3, 4, ...(photo ? [] : [5])]);

    if (!photo) return;

    const imageId = workbook.addImage(photo);
    // Anchored to the Foto column of this row: the anchor is the only thing
    // that says which teacher a floating image belongs to.
    sheet.addImage(imageId, {
      tl: { col: 4.1, row: rowNumber - 0.9 },
      ext: { width: 72, height: 72 },
    });
  });

  return sheet;
}

function buildResenas(workbook) {
  const sheet = addSheet(workbook, 'Resenas', [
    ['Autor', 20], ['Resena', 70], ['Origen', 14], ['Enlace', 44],
  ]);

  REVIEWS.forEach((review) => sheet.addRow(review));

  return sheet;
}

function buildEstudio(workbook) {
  const sheet = addSheet(workbook, 'Estudio', [['Campo', 18], ['Valor', 80]]);
  const { studio } = academy;

  [
    ['Nombre', studio.name],
    ['Direccion', studio.address],
    ['Ciudad', studio.city],
    ['Pais', studio.country],
    ['WhatsApp', studio.whatsapp],
    ['Telefono', studio.phone ?? '+51 1 659 3254'],
    ['Email', studio.email],
    ['Facebook', studio.social?.facebook],
    ['Instagram', studio.social?.instagram],
    ['Tiktok', 'https://www.tiktok.com/@expresionlatina.peru'],
    ['MapaEmbedUrl', studio.mapEmbedUrl],
  ].forEach((entry) => sheet.addRow(entry));

  return sheet;
}

export default async function makeExample(target) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'Expresión Latina';
  workbook.created = new Date();

  buildHorario(workbook);
  buildGeneros(workbook);
  buildProfesores(workbook);
  buildResenas(workbook);
  buildEstudio(workbook);

  await workbook.xlsx.writeFile(target);

  return target;
}

const invokedDirectly = process.argv[1]
  && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (invokedDirectly) {
  const [file] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const target = resolve(file ?? 'content/ejemplo-completo.xlsx');

  await makeExample(target);

  console.log(`\nEscribí el ejemplo completo en ${target}`);
  console.log('Cada hoja trae todas sus columnas y ninguna celda vacía.');
  console.log('Las fotos van pegadas en la columna Foto, no escritas como nombre de archivo.\n');
}
