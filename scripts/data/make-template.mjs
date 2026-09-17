import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ExcelJS from 'exceljs';

const SOURCE = resolve(new URL('../../src/data/academy.json', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1'));

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const LEVELS = ['Principiantes', 'Básico', 'Intermedio', 'Avanzado', 'All levels'];

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
 */
function restrict(sheet, column, values, lastRow) {
  if (!values.length) return;

  for (let row = 2; row <= lastRow; row += 1) {
    // ExcelJS is configured by assigning onto the objects it hands back;
    // there is no non-mutating way to attach a validation to a cell.
    // eslint-disable-next-line no-param-reassign
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${values.join(',').slice(0, 250)}"`],
      showErrorMessage: true,
      errorTitle: 'Valor no permitido',
      error: 'Elegí una opción de la lista.',
    };
  }
}

/**
 * What the teacher's Video cell should already say.
 *
 * The template is pre-filled from the current academy.json so the academy
 * edits what is running rather than retyping it, and a teacher's video is no
 * different: it comes back as the link or filename it was imported from.
 */
function videoOf(teacher, videosByTeacher) {
  const video = videosByTeacher.get(teacher.id);

  return video?.externalUrl ?? video?.assetKey ?? '';
}

export default async function makeTemplate(target) {
  const academy = existsSync(SOURCE) ? JSON.parse(readFileSync(SOURCE, 'utf8')) : null;

  const genres = academy?.genres ?? [];
  const teachers = academy?.teachers ?? [];
  const slotById = new Map((academy?.timeSlots ?? []).map((slot) => [slot.id, slot]));
  const dayById = new Map((academy?.days ?? []).map((day) => [day.id, day]));
  const genreById = new Map(genres.map((genre) => [genre.id, genre]));
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const videosByTeacher = new Map(
    (academy?.videos ?? [])
      .filter((video) => video.teacherId)
      .map((video) => [video.teacherId, video]),
  );

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
  restrict(horario, 'A', DAY_NAMES, lastRow);
  restrict(horario, 'D', genres.map((genre) => genre.name), lastRow);
  restrict(horario, 'E', teachers.map((teacher) => teacher.name), lastRow);
  restrict(horario, 'F', LEVELS, lastRow);

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
  restrict(generos, 'B', ['Clase', 'Ensayo'], genres.length + 20);

  addSheet(
    workbook,
    'Profesores',
    ['Nombre', 'NombreCorto', 'Generos', 'Imagen', 'Bio', 'Facebook', 'Instagram', 'Video'],
    teachers.map((teacher) => [
      teacher.name,
      teacher.shortName ?? '',
      (teacher.genreIds ?? []).map((id) => genreById.get(id)?.name ?? id).join(', '),
      teacher.imageKey ?? '',
      teacher.bio ?? '',
      teacher.social?.facebook ?? '',
      teacher.social?.instagram ?? '',
      // A link, or the name of a file in src/assets/videos.
      videoOf(teacher, videosByTeacher),
    ]),
    [24, 16, 28, 26, 40, 30, 30, 34],
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
