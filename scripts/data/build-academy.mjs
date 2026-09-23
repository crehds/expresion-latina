import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * A yyyy-mm-dd string, or null when those numbers name no real day.
 *
 * Shape is not existence: 31/02 and month 13 are as well-formed as any other
 * digits, and the schema's birthDate pattern counts digits, so nothing
 * downstream rejects them. src/data/index.js then hands the string to Date,
 * which rolls 31 February forward into March rather than refusing, and the
 * profile shows a confidently wrong age instead of leaving it out.
 *
 * Built in UTC to match the reader above and to keep the answer independent
 * of where the import runs.
 */
function asDate(year, month, day) {
  const [y, m, d] = [Number(year), Number(month), Number(day)];
  const date = new Date(Date.UTC(y, m - 1, d));

  const exists = date.getUTCFullYear() === y
    && date.getUTCMonth() === m - 1
    && date.getUTCDate() === d;

  return exists ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
}

/**
 * A birth date the sheet may give as a real Excel date or as text.
 *
 * Stored as a date rather than as an age because an age is wrong within the
 * year and nothing downstream can tell. A bare year is accepted, since it is
 * often all the academy knows.
 */
function readBirthDate(cell) {
  /*
   * The UTC day, deliberately. ExcelJS hands a date cell over as UTC midnight
   * of the day the sheet displays, whatever timezone the importer runs in —
   * the same reason readTime below reads getUTCHours rather than getHours.
   *
   * Reading the local components instead looks more natural and is wrong: it
   * would answer 13 March in Lima and 14 March in Madrid for one cell.
   */
  if (cell instanceof Date) {
    // An Invalid Date reaches toISOString as a RangeError, which would abort
    // the import rather than skip one unusable cell the way every branch
    // below does.
    if (Number.isNaN(cell.getTime())) return null;

    return cell.toISOString().slice(0, 10);
  }

  const text = readText(cell);
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return asDate(iso[1], iso[2], iso[3]);

  // Written the way people write dates here: 14/03/1998.
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (local) return asDate(local[3], local[2], local[1]);

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

/** The extensions the bundle actually resolves, from src/assets/videos. */
const VIDEO_FILE = /\.(mp4|webm)$/i;

/**
 * Whether a Video cell is one of the two shapes the site can play.
 *
 * Neither is inferred from the other. "://" used to be the only test, so a
 * share sheet's protocol-less address — youtu.be/abc, www.youtube.com/watch —
 * was written as a filename that is not in the bundle: resolveVideoAsset
 * answers undefined, the card renders with nothing to play, and the import
 * reports success. Guessing the other way is no better, so a value that is
 * neither becomes a cell to fix, which is the one outcome the academy can act
 * on.
 */
const isVideoLink = (value) => value.includes('://');
const isVideoFile = (value) => VIDEO_FILE.test(value);

/**
 * A video the Profesores sheet declares for one teacher. A value containing
 * "://" is a link; one ending in .mp4 or .webm is a file in src/assets/videos.
 */
function buildTeacherVideo(teacherId, teacherName, value) {
  const isLink = isVideoLink(value);

  return {
    id: teacherVideoId(teacherId),
    title: teacherName,
    genreId: null,
    teacherId,
    assetKey: isLink ? null : value,
    externalUrl: isLink ? value : null,
  };
}

/** Where the Imagen column's filename has to already live to be usable. */
const TEACHER_PHOTOS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/assets/images/teachers',
);

/**
 * What a pasted photograph's extension is allowed to become.
 *
 * The intersection of two lists that have to agree: what ExcelJS can carry in
 * a workbook at all (jpeg, png, gif) and what src/data/assets.js globs out of
 * the teachers folder (jpg, jpeg, png, webp, avif). gif sits in the first and
 * not the second, so accepting one wrote a file the site then could not
 * resolve — a teacher falling back to their initials with nothing to say why,
 * which is the same silence the Imagen check above exists to end. The test
 * for this reads that glob rather than restating it.
 *
 * jpg and jpeg collapse to the one canonical value, so re-pasting a teacher's
 * photo in either shape replaces the same file instead of accumulating a
 * second one.
 */
export const IMAGE_EXTENSION = new Map([
  ['jpg', 'jpeg'],
  ['jpeg', 'jpeg'],
  ['png', 'png'],
]);

/*
 * Read off the map rather than written out beside it.
 *
 * The rejection used to name gif, which the map had stopped accepting, so
 * somebody who did what the message said pasted a gif and was refused again
 * in the same words. The only exit from that loop is guessing. A list built
 * from the map cannot say a format the map will not take.
 */
const ACCEPTED_FORMATS = (() => {
  const names = [...IMAGE_EXTENSION.keys()];

  // Trimming the map to one would otherwise leave the message reading " o png".
  if (names.length < 2) return names.join('');

  return `${names.slice(0, -1).join(', ')} o ${names.at(-1)}`;
})();

/**
 * Decides one teacher's imageKey, in the precedence the owner chose: a pasted
 * photograph first, since a pasted image cannot be wrong about itself; then
 * the legacy Imagen filename, but only when that file actually exists —
 * naming one that was never uploaded is the defect this precedence exists to
 * end; otherwise whatever was already published survives untouched.
 *
 * A photograph that wins is pushed onto `photos` for import.mjs to write
 * alongside the academy, named deterministically from the teacher's own id so
 * re-uploading one replaces it rather than accumulating files.
 */
function resolveImageKey(row, id, published, pastedImage, errors, photos) {
  if (pastedImage) {
    const extension = IMAGE_EXTENSION.get(pastedImage.extension.toLowerCase());

    if (!extension) {
      errors.push(error(
        'Profesores',
        row.rowNumber,
        'Foto',
        `La foto pegada tiene un formato que no se puede usar (.${pastedImage.extension}). `
        + `Usa ${ACCEPTED_FORMATS}.`,
      ));
    } else {
      const filename = `${id}.${extension}`;
      photos.push({ filename, buffer: pastedImage.buffer });
      return filename;
    }
  }

  const imagen = readText(row.imagen);
  if (imagen) {
    if (existsSync(resolve(TEACHER_PHOTOS_DIR, imagen))) return imagen;

    errors.push(error(
      'Profesores',
      row.rowNumber,
      'Imagen',
      `"${imagen}" no existe en src/assets/images/teachers. `
      + 'Sube el archivo con ese nombre exacto o pega la foto directamente en la celda.',
    ));
  }

  return published.get(id)?.imageKey ?? null;
}

function buildTeachers(rows, genresById, errors, previousTeachers = [], images = []) {
  const teachers = [];
  const videos = [];
  const photos = [];
  const byName = new Map();

  const published = new Map(previousTeachers.map((teacher) => [teacher.id, teacher]));
  const imagesByRow = new Map(images.map((image) => [image.row, image]));
  // Every row whose name was actually readable, whether or not it went on to
  // become a teacher — a duplicate name still had one. Anything left over
  // once every row has been visited pasted a photo nothing can claim.
  const namedRows = new Set();

  /*
   * Whether the sheet carries a Video column at all, asked once of the sheet
   * rather than per row: a row whose cell is empty still has the key, so any
   * row answering yes means the column exists.
   */
  const hasVideoColumn = rows.some((row) => Object.hasOwn(row, 'video'));

  /*
   * An absent column is not an empty cell.
   *
   * parseWorkbook sets a key only for a header the sheet actually has, so a
   * Profesores sheet written before these columns existed yields rows with no
   * such key — and rebuilding from it wiped the published value off every
   * teacher. A column that is present and empty is the academy taking the
   * value back on purpose, and still clears it.
   *
   * The same distinction the Resenas sheet makes one level up, for the same
   * reason: an old workbook must not delete what it has never heard of.
   */
  const carried = (row, column, id, field, read) => (
    Object.hasOwn(row, column) ? read(row[column]) : published.get(id)?.[field]
  );

  rows.forEach((row) => {
    const name = readText(row.nombre);
    if (!name) {
      errors.push(error('Profesores', row.rowNumber, 'Nombre', 'Falta el nombre del profesor.'));
      return;
    }
    namedRows.add(row.rowNumber);

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
      imageKey: resolveImageKey(row, id, published, imagesByRow.get(row.rowNumber), errors, photos),
      genreIds,
      bio: readText(row.bio) ?? '',
      social,
      birthDate: carried(row, 'nacimiento', id, 'birthDate', readBirthDate) ?? null,
      achievements: carried(row, 'logros', id, 'achievements', readAchievements) ?? [],
      videoIds: [],
    };

    if (!hasVideoColumn) {
      // The sheet says nothing about videos, so it may not unsay one either.
      teacher.videoIds = published.get(id)?.videoIds ?? [];
    } else {
      const videoValue = readText(row.video);

      /*
       * The sheet owns exactly one id per teacher — the same ownership rule
       * mergeVideos applies to the records themselves. A link to any other
       * video was made by hand, and a cell that says nothing about it may not
       * unlink it. Assigning the cell's id alone dropped those every import
       * while mergeVideos kept the record alive, and a surviving record with
       * no teacherId that nothing points at falls into getAcademyVideos, which
       * reads it as the school's own reel.
       */
      const ownId = teacherVideoId(id);
      const handMade = (published.get(id)?.videoIds ?? [])
        .filter((videoId) => videoId !== ownId);

      if (!videoValue) {
        // An emptied cell is the academy taking its own clip back, and only
        // that one.
        teacher.videoIds = handMade;
      } else if (!isVideoLink(videoValue) && !isVideoFile(videoValue)) {
        errors.push(error(
          'Profesores',
          row.rowNumber,
          'Video',
          `"${videoValue}" no es un enlace ni un archivo de video. `
          + 'Usa una dirección que empiece con https:// o el nombre de un archivo .mp4.',
        ));
        teacher.videoIds = handMade;
      } else {
        const video = buildTeacherVideo(id, name, videoValue);
        videos.push(video);
        teacher.videoIds = [...handMade, video.id];
      }
    }

    teachers.push(teacher);
    byName.set(id, { ...teacher, rowNumber: row.rowNumber });
  });

  // A photo anchored to a row no teacher claimed: the row had no readable
  // name, so the loop above returned before it could ever be looked up.
  images.forEach((image) => {
    if (namedRows.has(image.row)) return;

    errors.push(error(
      'Profesores',
      image.row,
      'Foto',
      'Hay una foto pegada en una fila sin nombre de profesor. '
      + 'Escribe el nombre en la columna Nombre o quita la foto.',
    ));
  });

  return {
    teachers, teacherVideos: videos, teachersById: byName, hasVideoColumn, photos,
  };
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

/**
 * A WhatsApp cell as the number src/data/index.js's wa.me link actually needs.
 *
 * That module strips every non-digit from whatever is here and builds
 * https://wa.me/<digits>, so a number typed the way this academy normally
 * writes one — nine digits, no country code — produced a link nobody could
 * open. Only that one shape is rewritten; every other value, including one
 * already carrying the country code, is returned exactly as typed, since the
 * footer prints it verbatim.
 */
export function normaliseWhatsapp(value, row, errors) {
  if (!value) return value;

  const digits = value.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('51')) return value;
  if (digits.length === 9 && digits.startsWith('9')) return `+51 ${value}`;

  errors.push(error(
    'Estudio',
    row.rowNumber,
    'Whatsapp',
    'Escribe el número con código de país, por ejemplo +51 960 507 583.',
  ));
  return value;
}

function buildStudio(rows, errors) {
  const studio = { name: 'Expresión Latina', social: {} };

  rows.forEach((row) => {
    const field = normalise(readText(row.campo));
    const value = readText(row.valor);
    if (!field) return;

    if (STUDIO_FIELDS.has(field)) {
      const property = STUDIO_FIELDS.get(field);
      studio[property] = property === 'whatsapp' ? normaliseWhatsapp(value, row, errors) : value;
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
function mergeVideos(previousVideos, rebuilt, teachers, sheetDescribesVideos = true) {
  const rebuiltIds = new Set(rebuilt.map((video) => video.id));

  /*
   * The ids this import is entitled to write: exactly one per teacher in the
   * sheet. Ownership is by id, not by "names a teacher" — a second video
   * attached to someone by hand also carries a teacherId, and deleting it
   * because no row rebuilt it would destroy hand-curated content on the next
   * data:import with no way back.
   */
  const ownedIds = sheetDescribesVideos
    ? new Set(teachers.map((teacher) => teacherVideoId(teacher.id)))
    // A workbook with no Video column is not a workbook that emptied every
    // Video cell, so it is entitled to delete nothing.
    : new Set();

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
  fresh = false,
} = {}) {
  const errors = [];

  const previousVideoIds = new Map(
    (previous?.genres ?? [])
      .filter((genre) => genre.videoIds?.length)
      .map((genre) => [genre.id, genre.videoIds]),
  );

  /*
   * A sheet the workbook does not carry says nothing, and silence is not a
   * deletion: what is published survives. Every template generated before a
   * sheet existed is such a workbook, and importing one used to wipe whatever
   * it had never heard of. A sheet that is present and empty is the academy
   * deleting its contents, and that is honoured. parseWorkbook keeps the two
   * apart by returning null against [], and this is the only place that
   * distinction is spent.
   *
   * `fresh` is the deliberate destructive rebuild, reached only by someone
   * typing --fresh: an omitted sheet then publishes empty. It is scoped to
   * whole sheets and leaves the column-level carry-over and the videos no
   * sheet describes alone, which are separate contracts.
   */
  const carry = fresh ? null : previous;

  /*
   * Rebuilt from the carried records rather than left empty. The schedule
   * resolves a session's genre and teacher through these maps, so carrying the
   * faculty forward without its index would keep every teacher on the site and
   * still break every session's link to one.
   */
  const indexById = (records) => new Map(records.map((record) => [record.id, record]));

  const carriedGenres = carry?.genres ?? [];
  const { genres, genresById } = sheets.generos
    ? buildGenres(sheets.generos, errors, previousVideoIds)
    : { genres: carriedGenres, genresById: indexById(carriedGenres) };

  const carriedTeachers = carry?.teachers ?? [];
  const {
    teachers, teacherVideos, teachersById, hasVideoColumn, photos,
  } = sheets.profesores
    ? buildTeachers(
      sheets.profesores,
      genresById,
      errors,
      previous?.teachers ?? [],
      sheets.profesoresImagenes ?? [],
    )
    : {
      teachers: carriedTeachers,
      teacherVideos: [],
      teachersById: indexById(carriedTeachers),
      // The sheet describes no video, so mergeVideos may delete none.
      hasVideoColumn: false,
      // No Profesores sheet means no photograph pasted into one either.
      photos: [],
    };

  const studio = sheets.estudio
    ? buildStudio(sheets.estudio, errors)
    : (carry?.studio ?? buildStudio([], errors));

  const reviews = sheets.resenas
    ? buildReviews(sheets.resenas, errors)
    : (carry?.reviews ?? []);

  const { timeSlots, sessions } = sheets.horario
    ? buildSchedule(sheets.horario, genresById, teachersById, errors)
    : { timeSlots: carry?.timeSlots ?? [], sessions: carry?.sessions ?? [] };

  // Nothing gets published when there are problems, so nothing gets written
  // either: nobody's photograph belongs on disk pointing at a rejected import.
  if (errors.length) return { academy: null, errors, photos: [] };

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
      videos: mergeVideos(previous?.videos ?? [], teacherVideos, teachers, hasVideoColumn),
      reviews,
      sessions,
    },
    errors,
    // Never inside `academy`: that object is serialised to JSON, and a photo's
    // bytes are not data the site publishes as JSON.
    photos,
  };
}
