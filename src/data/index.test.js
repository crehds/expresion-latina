import academy from './academy.json';
import {
  days,
  classGenres,
  genres,
  getDayByWeekday,
  getGenreById,
  getGenreBySlug,
  getTeacherById,
  getTeachersByGenreId,
  getAcademyVideos,
  getVideosByGenreId,
  studio,
  teachers,
} from './index';

describe('academy data layer', () => {
  // This codebase carried three hardcoded day arrays, two of them ordered
  // Sunday-first and one Monday-first, and compared them by array index.
  // These are the regression tests for that; do not delete them.
  describe('getDayByWeekday', () => {
    it.each([
      [0, 'Domingo'],
      [1, 'Lunes'],
      [3, 'Miércoles'],
      [6, 'Sábado'],
    ])('maps Date#getDay() %i to %s', (weekday, name) => {
      expect(getDayByWeekday(weekday).name).toBe(name);
    });

    it('keeps display order independent of the weekday numbers', () => {
      expect(days.map((day) => day.name)).toEqual([
        'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
      ]);
      expect(days[0].weekday).toBe(1);
      expect(days[6].weekday).toBe(0);
    });

    it('returns undefined for a weekday that does not exist', () => {
      expect(getDayByWeekday(9)).toBeUndefined();
    });
  });

  describe('genres', () => {
    it('finds a genre by slug rather than by display name', () => {
      expect(getGenreBySlug('latin-urban').name).toBe('Latin Urban');
    });

    it('gives every genre a url-safe slug', () => {
      genres.forEach((genre) => {
        expect(genre.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(encodeURIComponent(genre.slug)).toBe(genre.slug);
      });
    });

    it('leaves rehearsals out of the genres students can enrol in', () => {
      expect(genres.some((genre) => genre.id === 'ensayo-elenco')).toBe(true);
      expect(classGenres.some((genre) => genre.id === 'ensayo-elenco')).toBe(false);
    });

    it('returns undefined for an unknown id or slug', () => {
      expect(getGenreById('tango')).toBeUndefined();
      expect(getGenreBySlug('tango')).toBeUndefined();
    });
  });

  describe('teachers', () => {
    it('resolves a bundled image for every teacher that has one on file', () => {
      teachers.filter((teacher) => teacher.imageKey).forEach((teacher) => {
        expect(typeof teacher.image).toBe('string');
        expect(teacher.image.length).toBeGreaterThan(0);
      });
    });

    // Teaching here does not depend on the academy having a photo.
    it('gives a teacher with no photo initials to be drawn with', () => {
      const withoutPhoto = teachers.filter((teacher) => !teacher.imageKey);

      expect(withoutPhoto.length).toBeGreaterThan(0);
      withoutPhoto.forEach((teacher) => {
        expect(teacher.image).toBeUndefined();
        expect(teacher.initials).toMatch(/^[A-ZÁÉÍÓÚÑ]{1,2}$/);
      });
    });

    it('finds the teachers of a genre', () => {
      expect(getTeachersByGenreId('salsa').map((t) => t.name)).toEqual(['Mishel Fernández', 'Omar López']);
    });

    it('returns an empty list for a genre nobody teaches', () => {
      expect(getTeachersByGenreId('urban-style')).toEqual([]);
    });

    it('returns undefined for an unknown teacher', () => {
      expect(getTeacherById('nadie')).toBeUndefined();
    });
  });

  describe('videos', () => {
    it('returns an empty list for a genre with no videos attached', () => {
      expect(getVideosByGenreId('salsa')).toEqual([]);
    });
  });

  /*
   * The guard that used to be repeated at every call site. Three components
   * link to WhatsApp, the schema allows a studio without one, and each copy of
   * the check was a chance to forget it and take a route down mid-render.
   */
  describe('getAcademyVideos', () => {
    /*
     * The academy's own reel: the footage that belongs to the school rather
     * than to one style or one teacher. A genre page with no footage of its
     * own shows these, so the page is never an empty box.
     */
    /*
     * The count comes first. Both assertions below iterate the result, which
     * is vacuously true of an empty array — a predicate that accidentally
     * excluded every video would have kept them green while every genre page
     * fell back to nothing.
     */
    it('actually returns the reel the genre pages fall back to', () => {
      expect(getAcademyVideos().length).toBeGreaterThan(0);
    });

    it('returns the videos tied to neither a genre nor a teacher', () => {
      const reel = getAcademyVideos();

      expect(reel.length).toBeGreaterThan(0);
      reel.forEach((video) => {
        expect(video.genreId ?? null).toBeNull();
        expect(video.teacherId ?? null).toBeNull();
      });
    });

    it('leaves out a video that belongs to a genre', () => {
      const ladies = getVideosByGenreId('ladies');

      expect(ladies.length).toBeGreaterThan(0);
      ladies.forEach((video) => {
        expect(getAcademyVideos()).not.toContainEqual(video);
      });
    });
  });

  describe('the whatsapp link', () => {
    /*
     * The number is fed in rather than read out. An earlier version of the
     * first test rebuilt its expected value with the same expression the
     * module uses and wrapped the whole thing in a branch on the committed
     * data, so it could not fail for any input and said nothing when the
     * studio had no number.
     */
    async function linkFor(whatsapp) {
      vi.resetModules();
      vi.doMock('./academy.json', () => ({
        default: { ...academy, studio: { ...academy.studio, whatsapp } },
      }));

      const { whatsappLink: link } = await import('./index');
      vi.doUnmock('./academy.json');

      return link;
    }

    it('strips the formatting wa.me will not accept', async () => {
      expect(await linkFor('+51 960 507 583')).toBe('https://wa.me/51960507583');
    });

    it('strips punctuation a workbook is just as likely to carry', async () => {
      expect(await linkFor('(01) 960-507-583')).toBe('https://wa.me/01960507583');
    });

    it('leaves a number that needs no cleaning alone', async () => {
      expect(await linkFor('51960507583')).toBe('https://wa.me/51960507583');
    });

    it('is null, never a link to nowhere, when the studio has no number', async () => {
      expect(await linkFor(null)).toBeNull();
    });
  });

  describe('immutability', () => {
    it('refuses writes to a collection', () => {
      expect(() => { teachers.push({}); }).toThrow();
    });

    it('refuses writes to a nested entity', () => {
      expect(() => { genres[0].name = 'Tango'; }).toThrow();
    });

    it('refuses writes to the studio details', () => {
      expect(() => { studio.name = 'Otra'; }).toThrow();
    });
  });
});
