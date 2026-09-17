import { readFileSync } from 'node:fs';

// Node's ESM resolver will not find this subpath without the extension, and
// the draft-07 default export cannot compile a 2020-12 schema.
// eslint-disable-next-line import/extensions
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schema = JSON.parse(
  readFileSync(new URL('../../src/data/academy.schema.json', import.meta.url)),
);

const validateSchema = addFormats(new Ajv({ allErrors: true })).compile(schema);

function idsOf(collection = []) {
  return new Set(collection.map((entry) => entry.id));
}

/**
 * Checks a finished academy object, whatever produced it.
 *
 * buildAcademy checks the spreadsheet and reports cells; this checks the
 * result and reports fields, so a hand-edited academy.json or one emitted by
 * some future admin panel is held to exactly the same contract as an import.
 *
 * @param {object} academy
 * @returns {{sheet: string, row: string|number|null, column: string, message: string}[]}
 */
export default function validateAcademy(academy) {
  const problems = [];
  const add = (where, message) => problems.push({
    sheet: 'academy.json', row: null, column: where, message,
  });

  if (!academy || typeof academy !== 'object') {
    add('(archivo)', 'No hay contenido que validar.');
    return problems;
  }

  validateSchema(academy);
  (validateSchema.errors ?? []).forEach((issue) => {
    add(issue.instancePath || '(raíz)', issue.message);
  });

  const days = idsOf(academy.days);
  const slots = idsOf(academy.timeSlots);
  const genres = idsOf(academy.genres);
  const teachers = idsOf(academy.teachers);
  const videos = idsOf(academy.videos);

  (academy.sessions ?? []).forEach((session) => {
    const at = `sessions/${session.id}`;
    if (!days.has(session.dayId)) add(at, `El día "${session.dayId}" no existe.`);
    if (!slots.has(session.slotId)) add(at, `La franja "${session.slotId}" no existe.`);
    if (!genres.has(session.genreId)) add(at, `El género "${session.genreId}" no existe.`);
    if (session.teacherId && !teachers.has(session.teacherId)) {
      add(at, `El profesor "${session.teacherId}" no existe.`);
    }
  });

  (academy.teachers ?? []).forEach((teacher) => {
    (teacher.genreIds ?? []).forEach((genreId) => {
      if (!genres.has(genreId)) add(`teachers/${teacher.id}`, `El género "${genreId}" no existe.`);
    });
  });

  (academy.genres ?? []).forEach((genre) => {
    (genre.videoIds ?? []).forEach((videoId) => {
      if (!videos.has(videoId)) add(`genres/${genre.id}`, `El video "${videoId}" no existe.`);
    });
  });

  // A slot nothing uses would render as an empty row; harmless, but it means
  // the file was not produced the way an import produces one.
  const usedSlots = new Set((academy.sessions ?? []).map((session) => session.slotId));
  (academy.timeSlots ?? []).forEach((slot) => {
    if (!usedSlots.has(slot.id)) add(`timeSlots/${slot.id}`, 'Ninguna clase usa esta franja.');
  });

  return problems;
}
