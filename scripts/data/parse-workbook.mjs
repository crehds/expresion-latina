import ExcelJS from 'exceljs';

/**
 * Lowercases, strips accents and collapses whitespace.
 *
 * Header matching and every lookup go through this, so "Miércoles",
 * "miercoles" and "MIERCOLES " are one value. People type all three.
 */
export function normalise(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Reads a cell as a 24-hour "HH:MM".
 *
 * A spreadsheet can hand back the same visible time in three shapes, and this
 * is where importers usually break:
 *   - a real time cell, which ExcelJS gives as a Date in UTC
 *   - a raw serial number, where 0.79166… is a fraction of a day
 *   - text someone typed, like "19:00", "7:00 pm" or "9.30"
 *
 * @returns {string|null} null when the cell holds nothing usable
 */
export function readTime(value) {
  if (value === null || value === undefined || value === '') return null;

  const pad = (n) => String(n).padStart(2, '0');
  const fromParts = (h, m) => (h >= 0 && h < 24 && m >= 0 && m < 60 ? `${pad(h)}:${pad(m)}` : null);

  if (value instanceof Date) {
    // ExcelJS stores a bare time against the epoch date in UTC; reading local
    // parts here would shift it by the machine's offset.
    return fromParts(value.getUTCHours(), value.getUTCMinutes());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const minutesInDay = Math.round((value % 1) * 24 * 60);
    return fromParts(Math.floor(minutesInDay / 60) % 24, minutesInDay % 60);
  }

  const text = normalise(value);
  if (!text) return null;

  const match = text.match(/^(\d{1,2})[:.h]?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.replace(/\./g, '');

  if (meridiem?.startsWith('p') && hours < 12) hours += 12;
  if (meridiem?.startsWith('a') && hours === 12) hours = 0;

  return fromParts(hours, minutes);
}

/** Cell text, trimmed, with empty cells becoming null rather than "". */
export function readText(value) {
  if (value === null || value === undefined) return null;
  // A hyperlink, formula or rich-text cell arrives as an object.
  let raw = value;
  if (typeof value === 'object') {
    const { text: linkText, result, hyperlink } = value;
    raw = linkText ?? result ?? hyperlink ?? '';
  }

  const text = String(raw).trim();
  return text === '' ? null : text;
}

/**
 * @returns {object[]|null} null when the workbook has no such sheet, which is
 *   not the same as a sheet the academy deliberately emptied. An import can
 *   only honour a deletion it can tell apart from silence.
 */
function readSheet(worksheet) {
  if (!worksheet) return null;

  const headerRow = worksheet.getRow(1);
  const headers = new Map();
  headerRow.eachCell((cell, column) => {
    const name = normalise(cell.value);
    // Matched by name, so inserting or reordering a column cannot silently
    // shift every value one place across.
    if (name) headers.set(column, name);
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const entry = { rowNumber };
    let hasContent = false;

    headers.forEach((name, column) => {
      const { value } = row.getCell(column);
      entry[name] = value;
      if (readText(value) !== null) hasContent = true;
    });

    // Trailing blank rows are unavoidable in a spreadsheet and are not errors.
    if (hasContent) rows.push(entry);
  });

  return rows;
}

/**
 * The photographs pasted into the Profesores sheet, keyed by the 1-based
 * sheet row they float over.
 *
 * An Excel image is anchored to a cell rather than stored inside one:
 * dragging it, or sorting the rows beneath it, can leave it floating over a
 * different teacher than the one it was pasted for. The row is the anchor
 * buildAcademy can trust; the column is the fragile axis, so it is
 * deliberately never read here.
 *
 * @returns {{row: number, buffer: Buffer, extension: string}[]}
 */
export function readImages(worksheet, media) {
  if (!worksheet) return [];

  return worksheet.getImages().flatMap(({ imageId, range }) => {
    const medium = media.find((item) => item.index === Number(imageId));

    /*
     * An anchor whose image is not in the workbook's media happens with some
     * editors and with a file that did not survive a copy. Reading straight
     * through it threw a TypeError that the command reported as "no pude leer
     * el archivo, revisá que no esté abierto en Excel" — which sends whoever
     * uploaded it to close a spreadsheet that was never open. Dropping the
     * anchor lets the rest of the workbook import; the teacher on that row
     * simply keeps the photograph they already had.
     */
    if (!medium) return [];

    return [{
      row: range.tl.nativeRow + 1,
      buffer: medium.buffer,
      extension: medium.extension,
    }];
  });
}

/**
 * Reads the five sheets into raw rows keyed by normalised header, plus any
 * photographs pasted into the Profesores sheet.
 *
 * A missing sheet comes back as null and a present but empty one as [], so a
 * caller can tell "this workbook says nothing about reviews" from "the academy
 * removed every review". Deciding whether either is fatal belongs to
 * validation, not to reading. A photograph carries no such distinction: no
 * image pasted is simply an empty list.
 *
 * @param {string} filePath
 * @returns {Promise<{
 *   horario: object[]|null, generos: object[]|null, profesores: object[]|null,
 *   estudio: object[]|null, resenas: object[]|null,
 *   profesoresImagenes: {row: number, buffer: Buffer, extension: string}[],
 * }>}
 */
export default async function parseWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const byName = (wanted) => workbook.worksheets
    .find((sheet) => normalise(sheet.name) === wanted);

  const profesoresSheet = byName('profesores');

  return {
    horario: readSheet(byName('horario')),
    generos: readSheet(byName('generos')),
    profesores: readSheet(profesoresSheet),
    estudio: readSheet(byName('estudio')),
    resenas: readSheet(byName('resenas')),
    profesoresImagenes: readImages(profesoresSheet, workbook.model.media),
  };
}
