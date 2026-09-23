import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ExcelJS from 'exceljs';

import { teacherVideoId } from './build-academy.mjs';

const SOURCE = resolve(new URL('../../src/data/academy.json', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1'));

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const LEVELS = ['Principiantes', 'Básico', 'Intermedio', 'Avanzado', 'All levels'];

// Room past the last genre or teacher that the dropdowns still read, so one
// added later can be chosen without regenerating the template.
const ROOM = 20;

const HEADER_FILL = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B2A7A' },
};

function addSheet(workbook, name, headers, rows, widths) {
  const sheet = workbook.addWorksheet(name);

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = HEADER_FILL;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  headers.forEach((_, index) => {
    sheet.getColumn(index + 1).width = widths?.[index] ?? 18;
  });

  rows.forEach((row) => sheet.addRow(row));
  return sheet;
}

/**
 * Restricts a column to a list.
 *
 * This is the single most useful thing in the file: it makes "Miercoles"
 * without the accent, or a teacher who does not exist, impossible to enter
 * rather than something the importer has to reject afterwards.
 *
 * `formula` is either a fixed list, from listOf, or the cells of another
 * sheet, from namesIn.
 */
function restrict(sheet, column, formula, lastRow) {
  for (let row = 2; row <= lastRow; row += 1) {
    // ExcelJS is configured by assigning onto the objects it hands back;
    // there is no non-mutating way to attach a validation to a cell.
    // eslint-disable-next-line no-param-reassign
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: 'Valor no permitido',
      error: 'Elige una opción de la lista.',
    };
  }
}

/** A list that never changes: the days, the levels. */
const listOf = (values) => `"${values.join(',')}"`;

/**
 * The names on another sheet, read live rather than copied.
 *
 * A copy taken when the template was made could not offer a teacher the
 * academy added afterwards, and Excel refuses what the list does not hold. A
 * quoted list is also capped at 255 characters, which the copy used to meet
 * by cutting the last name in half.
 */
const namesIn = (sheetName, lastRow) => `${sheetName}!$A$2:$A$${lastRow}`;

/**
 * What the teacher's Video cell should already say.
 *
 * Only the record the importer owns, looked up by the id it derives — never
 * merely a video that names this teacher. A video added to academy.json by
 * hand also names its teacher, and pre-filling the cell from it made the next
 * import build a second, owned record carrying the same clip while the
 * hand-added one survived, because it is not an id the import may delete. The
 * profile then showed the same video twice, and one round trip through the
 * template was all it took.
 */
function videoOf(teacher, ownedVideoById) {
  const video = ownedVideoById.get(teacherVideoId(teacher.id));

  return video?.externalUrl ?? video?.assetKey ?? '';
}

/**
 * @param {string} target where to write the workbook
 * @param {{source?: string}} options `source` is injected by the round-trip
 *   test so it can generate a template from a fixture rather than from the
 *   committed academy.json.
 */
export default async function makeTemplate(target, { source = SOURCE } = {}) {
  const academy = existsSync(source) ? JSON.parse(readFileSync(source, 'utf8')) : null;

  const genres = academy?.genres ?? [];
  const teachers = academy?.teachers ?? [];
  const slotById = new Map((academy?.timeSlots ?? []).map((slot) => [slot.id, slot]));
  const dayById = new Map((academy?.days ?? []).map((day) => [day.id, day]));
  const genreById = new Map(genres.map((genre) => [genre.id, genre]));
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  // Keyed by id, because the id is what ownership is defined by.
  const ownedVideoById = new Map((academy?.videos ?? []).map((video) => [video.id, video]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Expresión Latina';

  // Pre-filled rather than blank: the academy edits the month that is running
  // instead of retyping it, which is both faster and far less error-prone.
  const horarioRows = (academy?.sessions ?? []).map((session) => [
    dayById.get(session.dayId)?.name ?? '',
    slotById.get(session.slotId)?.start ?? '',
    slotById.get(session.slotId)?.end ?? '',
    genreById.get(session.genreId)?.name ?? '',
    session.teacherId ? teacherById.get(session.teacherId)?.name ?? '' : '',
    session.level ?? '',
    session.room ?? '',
    session.note ?? '',
  ]);

  const horario = addSheet(
    workbook,
    'Horario',
    ['Dia', 'Inicio', 'Fin', 'Genero', 'Profesor', 'Nivel', 'Salon', 'Nota'],
    horarioRows,
    [14, 10, 10, 20, 24, 18, 12, 20],
  );

  // Room to add classes without losing the dropdowns.
  const lastRow = horarioRows.length + 40;
  restrict(horario, 'A', listOf(DAY_NAMES), lastRow);
  restrict(horario, 'D', namesIn('Generos', genres.length + ROOM), lastRow);
  restrict(horario, 'E', namesIn('Profesores', teachers.length + ROOM), lastRow);
  restrict(horario, 'F', listOf(LEVELS), lastRow);

  const generos = addSheet(
    workbook,
    'Generos',
    ['Nombre', 'Tipo', 'Descripcion'],
    genres.map((genre) => [
      genre.name,
      genre.kind === 'rehearsal' ? 'Ensayo' : 'Clase',
      genre.description ?? '',
    ]),
    [22, 12, 50],
  );
  restrict(generos, 'B', listOf(['Clase', 'Ensayo']), genres.length + ROOM);

  addSheet(
    workbook,
    'Profesores',
    ['Nombre', 'NombreCorto', 'Generos', 'Nacimiento', 'Imagen', 'Bio', 'Facebook', 'Instagram', 'Video', 'Logros'],
    teachers.map((teacher) => [
      teacher.name,
      teacher.shortName ?? '',
      (teacher.genreIds ?? []).map((id) => genreById.get(id)?.name ?? id).join(', '),
      // A date, not an age: an age is wrong within the year and nobody notices.
      teacher.birthDate ?? '',
      teacher.imageKey ?? '',
      teacher.bio ?? '',
      teacher.social?.facebook ?? '',
      teacher.social?.instagram ?? '',
      // A link, or the name of a file in src/assets/videos.
      videoOf(teacher, ownedVideoById),
      // One per line, the year in brackets: Campeón Nacional (2023)
      (teacher.achievements ?? [])
        .map(({ title, year }) => (year ? `${title} (${year})` : title))
        .join('\n'),
    ]),
    [24, 16, 28, 14, 26, 40, 30, 30, 34, 40],
  );

  addSheet(
    workbook,
    'Resenas',
    ['Autor', 'Resena', 'Origen', 'Enlace'],
    (academy?.reviews ?? []).map((review) => [
      review.author,
      review.text,
      // Where it was left: Instagram, Google, en clase.
      review.source ?? '',
      review.sourceUrl ?? '',
    ]),
    [24, 70, 16, 40],
  );

  const studio = academy?.studio ?? {};

  addSheet(
    workbook,
    'Estudio',
    ['Campo', 'Valor'],
    [
      ['Nombre', studio.name ?? ''],
      ['Direccion', studio.address ?? ''],
      ['Ciudad', studio.city ?? ''],
      ['Pais', studio.country ?? ''],
      ['WhatsApp', studio.whatsapp ?? ''],
      ['Telefono', studio.phone ?? ''],
      ['Email', studio.email ?? ''],
      ['Facebook', studio.social?.facebook ?? ''],
      ['Instagram', studio.social?.instagram ?? ''],
      ['MapaEmbedUrl', studio.mapEmbedUrl ?? ''],
    ],
    [18, 70],
  );

  await workbook.xlsx.writeFile(target);
  return { target, rows: horarioRows.length };
}

// Only when run directly, so the round-trip test can import it.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const [file] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const target = resolve(file ?? 'content/horarios.xlsx');

  makeTemplate(target)
    .then(({ rows }) => {
      console.log(`\nEscribí la plantilla en ${target}`);
      console.log(`Trae ${rows} fila(s) del horario actual, listas para editar.`);
      console.log('\nCuando termines:\n  npm run data:import -- "<archivo>"');
    })
    .catch((cause) => {
      console.error(`No pude escribir la plantilla: ${cause.message}`);
      process.exit(1);
    });
}
