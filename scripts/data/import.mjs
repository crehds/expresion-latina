import {
  existsSync, readFileSync, renameSync, writeFileSync,
} from 'node:fs';
import { basename, extname, resolve } from 'node:path';

import buildAcademy from './build-academy.mjs';
import guardAcademy from './guard.mjs';
import parseWorkbook from './parse-workbook.mjs';
import validateAcademy from './validate.mjs';

const TARGET = resolve(new URL('../../src/data/academy.json', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1'));

const TEACHER_PHOTOS_DIR = resolve(new URL('../../src/assets/images/teachers', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1'));

function usage() {
  console.log(`
Actualiza el contenido del sitio desde una planilla.

  npm run data:import -- <archivo.xlsx>
  npm run data:import -- <archivo.xlsx> --dry-run

Opciones
  --dry-run   Revisa el archivo y muestra el resumen, sin escribir nada.
  --fresh     Reconstruye desde cero: una hoja que el archivo no trae se
              publica vacía en vez de conservar lo que ya está publicado.
              Borra datos a propósito. Úsalo solo si eso es exactamente
              lo que buscas.
`.trim());
}

/** Prints the problems as a table a person can work down, cell by cell. */
function reportProblems(problems) {
  const width = (key, min) => Math.max(min, ...problems.map((p) => String(p[key] ?? '').length));
  const sheetWidth = width('sheet', 5);
  const columnWidth = width('column', 7);

  console.error(`\nEl archivo tiene ${problems.length} problema(s). No se cambió nada.\n`);
  console.error(`  ${'HOJA'.padEnd(sheetWidth)}  ${'FILA'.padEnd(5)}  ${'COLUMNA'.padEnd(columnWidth)}  DETALLE`);
  console.error(`  ${'-'.repeat(sheetWidth)}  ${'-'.repeat(5)}  ${'-'.repeat(columnWidth)}  -------`);

  problems.forEach((problem) => {
    const row = problem.row === null || problem.row === undefined ? '' : String(problem.row);
    console.error(
      `  ${String(problem.sheet).padEnd(sheetWidth)}  ${row.padEnd(5)}  `
      + `${String(problem.column).padEnd(columnWidth)}  ${problem.message}`,
    );
  });

  console.error('\nCorregí esas celdas y volvé a correr el comando.');
}

function summarise(academy) {
  const classes = academy.sessions.filter(
    (session) => academy.genres.find((genre) => genre.id === session.genreId)?.kind !== 'rehearsal',
  ).length;

  console.log(`
  ${academy.sessions.length} entradas en el horario (${classes} clases)
  ${academy.genres.length} géneros
  ${academy.teachers.length} profesores
  ${academy.timeSlots.length} franjas horarias
  ${new Set(academy.sessions.map((s) => s.dayId)).size} días con actividad
`.trimEnd());
}

function readPrevious(target) {
  if (!existsSync(target)) return null;
  try {
    return JSON.parse(readFileSync(target, 'utf8'));
  } catch {
    // A corrupt target is not a reason to refuse; it is about to be replaced.
    return null;
  }
}

async function readSource(file, previous, fresh) {
  if (extname(file).toLowerCase() === '.json') {
    // The same validation path, so a future admin panel can emit this shape
    // and be held to exactly the same contract as a spreadsheet. Such a file
    // carries no embedded photographs of its own.
    return { academy: JSON.parse(readFileSync(file, 'utf8')), errors: [], photos: [] };
  }

  const sheets = await parseWorkbook(file);
  return buildAcademy(sheets, {
    sourceFileName: basename(file),
    previous,
    fresh,
  });
}

/**
 * Written to a temporary name and renamed, the same care the JSON target
 * already gets: an interrupted run must not leave half a photo where the site
 * expects a complete one.
 */
function writePhoto(photosDir, { filename, buffer }) {
  const target = resolve(photosDir, filename);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, buffer);
  renameSync(temporary, target);
}

/**
 * @param {string[]} argv
 * @param {{target?: string, photosDir?: string}} [paths] overridable so tests
 *   can point a whole run at a throwaway directory instead of the real site
 *   content; the CLI invocation below always uses the real ones.
 */
export default async function main(argv, { target = TARGET, photosDir = TEACHER_PHOTOS_DIR } = {}) {
  const dryRun = argv.includes('--dry-run');
  const fresh = argv.includes('--fresh');
  const [file] = argv.filter((arg) => !arg.startsWith('--'));

  if (!file) {
    usage();
    return 1;
  }

  const source = resolve(file);
  if (!existsSync(source)) {
    console.error(`No encontré el archivo: ${source}`);
    return 1;
  }

  const previous = readPrevious(target);

  if (fresh) {
    console.warn('\n--fresh: una hoja ausente se publicará vacía en vez de conservar lo publicado.');
  }

  const { academy, errors, photos } = await readSource(source, previous, fresh);

  /*
   * Structure and cross-references are checked even when the rows were fine, so
   * nothing reaches the site that the app itself would reject.
   *
   * The guard runs after them and asks a different question: not whether the
   * file is well-formed, but whether it would leave the site with nothing to
   * show. --fresh stands it down, because the guard exists to catch the
   * accident, never to forbid the decision.
   */
  const problems = [
    ...errors,
    ...(academy ? validateAcademy(academy) : []),
    ...(academy && !fresh ? guardAcademy(academy, previous) : []),
  ];

  if (problems.length) {
    reportProblems(problems);
    return 1;
  }

  console.log(`\nLeí ${basename(source)} sin problemas.`);
  summarise(academy);

  if (dryRun) {
    console.log('\n--dry-run: no se escribió nada.');
    return 0;
  }

  // Written before the JSON that names them, so a diff never points at a
  // photograph that is not on disk yet.
  photos.forEach((photo) => writePhoto(photosDir, photo));

  // Written beside the target and renamed, so an interrupted run cannot leave
  // half a file where the site expects valid JSON.
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(academy, null, 2)}\n`, 'utf8');
  renameSync(temporary, target);

  console.log(`\nActualicé src/data/academy.json.
${photos.length} foto(s) escrita(s) en src/assets/images/teachers.
Revisá el cambio antes de publicarlo:  git diff src/data/academy.json`);
  return 0;
}

// Only when run directly, so a test can import main and drive it at a
// throwaway target instead of the real site content.
const invokedDirectly = process.argv[1]
  && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((cause) => {
      console.error(`\nNo pude leer el archivo: ${cause.message}`);
      console.error('Si es un .xlsx, revisá que no esté abierto en Excel ni protegido con contraseña.');
      process.exit(1);
    });
}
