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
  getVideosByGenreId,
  studio,
  teachers,
  whatsappLink,
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
  describe('the whatsapp link', () => {
    it('strips the formatting wa.me will not accept', () => {
      // Whatever the workbook holds, the link carries digits and nothing else.
      if (studio.whatsapp) {
        expect(whatsappLink).toBe(`https://wa.me/${studio.whatsapp.replace(/\D/g, '')}`);
        expect(whatsappLink).not.toMatch(/[\s+()-]/);
      } else {
        expect(whatsappLink).toBeNull();
      }
    });

    it('is null, never a link to nowhere, when the studio has no number', async () => {
      vi.resetModules();
      vi.doMock('./academy.json', () => ({
        default: {
          ...academy,
          studio: { ...academy.studio, whatsapp: null },
        },
      }));

      const { whatsappLink: link } = await import('./index');

      expect(link).toBeNull();
      vi.doUnmock('./academy.json');
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
