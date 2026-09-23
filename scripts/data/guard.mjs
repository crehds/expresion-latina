/**
 * Collections the site cannot render without, and the sheet each is built from.
 *
 * Reviews and videos are deliberately absent. Both are legitimately empty —
 * reviews is empty in the published file right now, so guarding it would refuse
 * every import — and videos are hand-curated rather than described by any sheet.
 */
const REQUIRED_COLLECTIONS = new Map([
  ['genres', { sheet: 'Generos', noun: 'géneros' }],
  ['teachers', { sheet: 'Profesores', noun: 'profesores' }],
  ['sessions', { sheet: 'Horario', noun: 'clases' }],
]);

/**
 * Studio fields the footer prints on every page.
 *
 * `phone` is not here: it is null in the published file, so requiring it would
 * refuse an import that changed nothing.
 */
const REQUIRED_STUDIO = new Map([
  ['address', 'Direccion'],
  ['whatsapp', 'Whatsapp'],
  ['email', 'Email'],
]);

const isBlank = (value) => value === null
  || value === undefined
  || String(value).trim() === '';

/**
 * Refuses a rebuild that would leave the site with nothing to show.
 *
 * validateAcademy asks whether the file is well-formed; this asks whether it is
 * plausible. The two cannot be merged: an academy with no teachers is valid
 * JSON and a broken website, and it stays internally consistent when the
 * sessions referencing those teachers disappear alongside them. No schema can
 * catch that, which is why this check exists separately.
 *
 * Every problem is collected rather than stopping at the first, so one run tells
 * the academy everything that is wrong, and the shape matches validateAcademy's
 * so `reportProblems` renders both the same way.
 *
 * @param {object} academy the rebuilt academy, about to replace the published one
 * @param {object|null} previous the published academy, for "there used to be N"
 * @returns {{sheet: string, row: null, column: string, message: string}[]}
 */
export default function guardAcademy(academy, previous = null) {
  const problems = [];
  const add = (sheet, column, message) => problems.push({
    sheet, row: null, column, message,
  });

  REQUIRED_COLLECTIONS.forEach(({ sheet, noun }, key) => {
    if ((academy?.[key] ?? []).length > 0) return;

    const had = previous?.[key]?.length;
    // Only said when there is a published file to compare against: a first
    // import has no "before", and inventing one would be a lie.
    const before = had ? ` (antes había ${had})` : '';

    add(
      sheet,
      '(hoja)',
      `Tu archivo dejaría el sitio sin ${noun}${before}. `
      + `Puede que falte la hoja ${sheet} o que esté vacía. No se cambió nada.`,
    );
  });

  REQUIRED_STUDIO.forEach((field, key) => {
    if (!isBlank(academy?.studio?.[key])) return;

    add(
      'Estudio',
      field,
      `Falta ${field} en la hoja Estudio. `
      + 'Ese dato aparece en el pie de todas las páginas. No se cambió nada.',
    );
  });

  return problems;
}
