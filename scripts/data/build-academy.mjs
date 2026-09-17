import { normalise, readText, readTime } from './parse-workbook.mjs';

/** The week is universal, so it is not something the spreadsheet declares. */
const DAYS = [
  {
    id: 'lunes', name: 'Lunes', shortName: 'Lun', weekday: 1,
  },
  {
    id: 'martes', name: 'Martes', shortName: 'Mar', weekday: 2,
  },
  {
    id: 'miercoles', name: 'Miércoles', shortName: 'Mié', weekday: 3,
  },
  {
    id: 'jueves', name: 'Jueves', shortName: 'Jue', weekday: 4,
  },
  {
    id: 'viernes', name: 'Viernes', shortName: 'Vie', weekday: 5,
  },
  {
    id: 'sabado', name: 'Sábado', shortName: 'Sáb', weekday: 6,
  },
  {
    id: 'domingo', name: 'Domingo', shortName: 'Dom', weekday: 0,
  },
];

const DAY_BY_NAME = new Map(DAYS.map((day) => [normalise(day.name), day]));

/** Spreadsheet field name in the Estudio sheet -> studio property. */
const STUDIO_FIELDS = new Map(Object.entries({
  nombre: 'name',
  ciudad: 'city',
  pais: 'country',
  direccion: 'address',
  telefono: 'phone',
  whatsapp: 'whatsapp',
  email: 'email',
  mapaembedurl: 'mapEmbedUrl',
}));

const STUDIO_SOCIAL = new Map(Object.entries({
  facebook: 'facebook',
  instagram: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
}));

/**
 * A stable, url-safe identifier derived from a display name.
 *
 * Deterministic so that re-importing an unchanged spreadsheet produces an
 * unchanged file, and so that deleting one row does not renumber everything
 * below it the way an auto-increment would.
 */
export function toSlug(value) {
  return normalise(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function error(sheet, row, column, message) {
  return {
    sheet, row, column, message,
  };
}

function buildGenres(rows, errors, previousVideoIds) {
  const genres = [];
  const byName = new Map();

  rows.forEach((row) => {
    const name = readText(row.nombre);
    if (!name) {
      errors.push(error('Generos', row.rowNumber, 'Nombre', 'Falta el nombre del género.'));
      return;
    }

    const id = toSlug(name);
    if (!id) {
      errors.push(error('Generos', row.rowNumber, 'Nombre', `"${name}" no produce un identificador válido.`));
      return;
    }

    const existing = byName.get(id);
    if (existing) {
      errors.push(error('Generos', row.rowNumber, 'Nombre', `"${name}" repite el género de la fila ${existing.rowNumber}.`));
      return;
    }

    // A rehearsal occupies the schedule but is not a class students enrol in.
    const kind = normalise(readText(row.tipo)).startsWith('ensayo') ? 'rehearsal' : 'class';

    const genre = {
      id,
      name,
      slug: id,
      kind,
      description: readText(row.descripcion) ?? '',
      accentColor: null,
      // Videos are not managed from the spreadsheet, so whatever was already
      // attached to this genre survives the import.
      videoIds: previousVideoIds.get(id) ?? [],
    };

    genres.push(genre);
    byName.set(id, { ...genre, rowNumber: row.rowNumber });
  });

  return { genres, genresById: byName };
}

/**
 * A birth date the sheet may give as a real Excel date or as text.
 *
 * Stored as a date rather than as an age because an age is wrong within the
 * year and nothing downstream can tell. A bare year is accepted, since it is
 * often all the academy knows.
 */
function readBirthDate(cell) {
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);

  const text = readText(cell);
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // Written the way people write dates here: 14/03/1998.
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;

  if (/^\d{4}$/.test(text)) return text;

  return null;
}

/**
 * Titles and championships, one per line or separated by semicolons, each
 * optionally carrying its year in brackets: "Campeón Nacional Salsa (2023)".
 */
function readAchievements(cell) {
  const text = readText(cell);
  if (!text) return [];

  return text
    .split(/[\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const withYear = entry.match(/^(.*?)\s*\((\d{4})\)$/);

      return withYear
        ? { title: withYear[1].trim(), year: Number(withYear[2]) }
        : { title: entry, year: null };
    });
}

/**
 * The one video id this importer owns for a teacher.
 *
 * It is derived from the teacher rather than from the cell's value, so
 * importing the same workbook twice produces the same record and changing the
 * link replaces it instead of accumulating a second one. mergeVideos reads the
 * same function to decide what an import is entitled to delete, and so does
 * the template generator when it pre-fills the cell, so the three cannot
 * drift apart.
 */
export function teacherVideoId(teacherId) {
  return `video-${teacherId}`;
}

/**
 * A video the Profesores sheet declares for one teacher. A value containing
 * "://" is treated as a link; anything else is a filename in src/assets/videos.
 */
function buildTeacherVideo(teacherId, teacherName, value) {
  const isLink = value.includes('://');

  return {
    id: teacherVideoId(teacherId),
    title: teacherName,
    genreId: null,
    teacherId,
    assetKey: isLink ? null : value,
    externalUrl: isLink ? value : null,
  };
}

function buildTeachers(rows, genresById, errors) {
  const teachers = [];
  const videos = [];
  const byName = new Map();

  rows.forEach((row) => {
    const name = readText(row.nombre);
    if (!name) {
      errors.push(error('Profesores', row.rowNumber, 'Nombre', 'Falta el nombre del profesor.'));
      return;
    }

    const id = toSlug(name);
    if (byName.has(id)) {
      errors.push(error('Profesores', row.rowNumber, 'Nombre', `"${name}" repite el profesor de la fila ${byName.get(id).rowNumber}.`));
      return;
    }

    const genreIds = (readText(row.generos) ?? '')
      .split(',')
      .map((entry) => toSlug(entry))
      .filter(Boolean)
      .filter((genreId) => {
        if (genresById.has(genreId)) return true;
        errors.push(error('Profesores', row.rowNumber, 'Generos', `"${genreId}" no está en la hoja Generos.`));
        return false;
      });

    const social = {};
    STUDIO_SOCIAL.forEach((property, field) => {
      const value = readText(row[field]);
      if (value) social[property] = value;
    });

    const teacher = {
      id,
      name,
      shortName: readText(row.nombrecorto) ?? name.split(' ')[0],
      // The academy does not always have a photograph, and teaching here
      // cannot depend on whether we do.
      imageKey: readText(row.imagen),
      genreIds,
      bio: readText(row.bio) ?? '',
      social,
      birthDate: readBirthDate(row.nacimiento),
      achievements: readAchievements(row.logros),
      videoIds: [],
    };

    const videoValue = readText(row.video);
    if (videoValue) {
      const video = buildTeacherVideo(id, name, videoValue);
      videos.push(video);
      teacher.videoIds = [video.id];
    }

    teachers.push(teacher);
    byName.set(id, { ...teacher, rowNumber: row.rowNumber });
  });

  return { teachers, teacherVideos: videos, teachersById: byName };
}

/**
 * What students have said, one row each.
 *
 * The academy expects these to come from Instagram comments, so a row can name
 * where it was left and link back to it. A row with no text is a trailing
 * blank row in the sheet, not an error.
 */
function buildReviews(rows, errors) {
  const reviews = [];
  const seen = new Set();

  rows.forEach((row) => {
    const text = readText(row.resena) ?? readText(row.texto);
    const author = readText(row.autor) ?? readText(row.nombre);

    if (!text && !author) return;

    if (!text) {
      errors.push(error('Resenas', row.rowNumber, 'Resena', 'Falta el texto de la reseña.'));
      return;
    }
    if (!author) {
      errors.push(error('Resenas', row.rowNumber, 'Autor', 'Falta quién la escribió.'));
      return;
    }

    // Two people called Ana get ana and ana-2 rather than one overwriting the
    // other, and the same sheet imported twice gives the same ids.
    const base = toSlug(author) || 'resena';
    let id = base;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);

    reviews.push({
      id,
      author,
      text,
      source: readText(row.origen),
      sourceUrl: readText(row.enlace),
    });
  });

  return reviews;
}

function buildStudio(rows, errors) {
  const studio = { name: 'Expresión Latina', social: {} };

  rows.forEach((row) => {
    const field = normalise(readText(row.campo));
    const value = readText(row.valor);
    if (!field) return;

    if (STUDIO_FIELDS.has(field)) {
      studio[STUDIO_FIELDS.get(field)] = value;
      return;
    }
    if (STUDIO_SOCIAL.has(field)) {
      if (value) studio.social[STUDIO_SOCIAL.get(field)] = value;
      return;
    }

    errors.push(error('Estudio', row.rowNumber, 'Campo', `"${readText(row.campo)}" no es un campo conocido.`));
  });

  return studio;
}

function buildSchedule(rows, genresById, teachersById, errors) {
  const slots = new Map();
  const sessions = [];
  const taken = new Map();

  rows.forEach((row) => {
    const at = (column, message) => errors.push(error('Horario', row.rowNumber, column, message));

    const day = DAY_BY_NAME.get(normalise(readText(row.dia)));
    if (!day) {
      at('Dia', `"${readText(row.dia) ?? ''}" no es un día de la semana.`);
      return;
    }

    const start = readTime(row.inicio);
    const end = readTime(row.fin);
    if (!start) at('Inicio', 'La hora de inicio no se entiende.');
    if (!end) at('Fin', 'La hora de fin no se entiende.');
    if (start && end && start >= end) at('Fin', `La clase termina a las ${end}, que no es después de las ${start}.`);

    const genreId = toSlug(readText(row.genero) ?? '');
    if (!genresById.has(genreId)) {
      at('Genero', `"${readText(row.genero) ?? ''}" no está en la hoja Generos.`);
    }

    const teacherName = readText(row.profesor);
    const teacherId = teacherName ? toSlug(teacherName) : null;
    if (teacherId && !teachersById.has(teacherId)) {
      at('Profesor', `"${teacherName}" no está en la hoja Profesores.`);
    }

    if (!start || !end || start >= end || !genresById.has(genreId)) return;
    if (teacherId && !teachersById.has(teacherId)) return;

    const slotId = `t${start.replace(':', '')}-${end.replace(':', '')}`;
    if (!slots.has(slotId)) {
      slots.set(slotId, {
        id: slotId, start, end, label: `${start} - ${end}`,
      });
    }

    const room = readText(row.salon) ?? 'Sala 1';
    const key = `${day.id}|${slotId}|${normalise(room)}`;
    const clash = taken.get(key);
    if (clash) {
      at('Salon', `${day.name} ${start} en ${room} ya está ocupado por la fila ${clash}.`);
      return;
    }
    taken.set(key, row.rowNumber);

    const base = `${day.id.slice(0, 3)}-${start.replace(':', '')}`;
    const id = [...taken.keys()].filter((k) => k.startsWith(`${day.id}|${slotId}|`)).length > 1
      ? `${base}-${toSlug(room)}`
      : base;

    sessions.push({
      id,
      dayId: day.id,
      slotId,
      genreId,
      teacherId,
      level: readText(row.nivel),
      room,
      note: readText(row.nota),
    });
  });

  // Sorted on start and then end: this academy runs sixty and ninety minute
  // classes from the same hour, so comparing start alone leaves those two in
  // whatever order the spreadsheet rows happened to be in.
  const timeSlots = [...slots.values()].sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
  );

  return { timeSlots, sessions };
}

/**
 * Turns the raw sheets into the canonical academy shape.
 *
 * Collects every problem rather than stopping at the first, so one import run
 * tells the academy everything that needs fixing.
 *
 * @param {object} sheets output of parseWorkbook
 * @param {{sourceFileName?: string, now?: Date, previous?: object}} options
 *   `now` is injected so generatedAt is deterministic under test. `previous`
 *   is the academy.json being replaced: the spreadsheet does not describe
 *   videos, so an import must carry them across rather than delete them.
 * @returns {{academy: object|null, errors: object[]}}
 */
/**
 * The videos to keep: everything the previous file held, with the ones this
 * import rebuilt taking the place of their older selves.
 *
 * Videos that no sheet describes — the studio trailer, a genre reel added by
 * hand — survive untouched, which is the whole reason `previous` is passed in.
 */
function mergeVideos(previousVideos, rebuilt, teachers) {
  const rebuiltIds = new Set(rebuilt.map((video) => video.id));

  /*
   * The ids this import is entitled to write: exactly one per teacher in the
   * sheet. Ownership is by id, not by "names a teacher" — a second video
   * attached to someone by hand also carries a teacherId, and deleting it
   * because no row rebuilt it would destroy hand-curated content on the next
   * data:import with no way back.
   */
  const ownedIds = new Set(teachers.map((teacher) => teacherVideoId(teacher.id)));

  // An owned id the sheet no longer fills was cleared, so it goes. Everything
  // else survives, which is what "records no sheet describes" means.
  const kept = previousVideos.filter(
    (video) => !ownedIds.has(video.id) && !rebuiltIds.has(video.id),
  );

  return [...kept, ...rebuilt];
}

export default function buildAcademy(sheets, {
  sourceFileName = null,
  now = new Date(),
  previous = null,
} = {}) {
  const errors = [];

  const previousVideoIds = new Map(
    (previous?.genres ?? [])
      .filter((genre) => genre.videoIds?.length)
      .map((genre) => [genre.id, genre.videoIds]),
  );

  const { genres, genresById } = buildGenres(sheets.generos ?? [], errors, previousVideoIds);
  const { teachers, teacherVideos, teachersById } = buildTeachers(
    sheets.profesores ?? [],
    genresById,
    errors,
  );
  const studio = buildStudio(sheets.estudio ?? [], errors);
  const reviews = buildReviews(sheets.resenas ?? [], errors);
  const { timeSlots, sessions } = buildSchedule(
    sheets.horario ?? [],
    genresById,
    teachersById,
    errors,
  );

  if (errors.length) return { academy: null, errors };

  return {
    academy: {
      schemaVersion: 1,
      generatedAt: now.toISOString(),
      generatedFrom: sourceFileName,
      studio,
      days: DAYS,
      timeSlots,
      genres,
      teachers,
      videos: mergeVideos(previous?.videos ?? [], teacherVideos, teachers),
      reviews,
      sessions,
    },
    errors,
  };
}
