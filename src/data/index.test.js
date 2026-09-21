import academy from './academy.json';
import {
  ageFrom,
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
  /*
   * The importer fills BOTH links for a teacher's own video: buildTeachers
   * sets teacher.videoIds while buildTeacherVideo sets teacherId on the same
   * record. So every imported teacher video arrives on both of the two routes
   * this lookup unions, and the panel renders whatever it returns.
   *
   * No committed teacher carries videoIds today, so nothing exercised the
   * union until here.
   */
  describe('getVideosByTeacherId with both links set', () => {
    async function lookupDoubleLinked() {
      vi.resetModules();
      vi.doMock('./academy.json', () => ({
        default: {
          ...academy,
          teachers: [{
            id: 'mishel', name: 'Mishel', genreIds: [], videoIds: ['video-mishel'],
          }],
          videos: [{
            id: 'video-mishel',
            title: 'Mishel',
            genreId: null,
            teacherId: 'mishel',
            assetKey: null,
            externalUrl: 'https://example.test/mishel.mp4',
          }],
        },
      }));

      const mod = await import('./index');
      vi.doUnmock('./academy.json');

      return mod.getVideosByTeacherId('mishel');
    }

    it('returns the video once, not once per link', async () => {
      expect(await lookupDoubleLinked()).toHaveLength(1);
    });

    it('returns the video the links point at', async () => {
      const [video] = await lookupDoubleLinked();

      expect(video.id).toBe('video-mishel');
    });
  });

  /*
   * Four decision points and nothing asserted any of them. The value is only
   * observable as teachers[].age, printed in the panel as "<n> años", and it
   * is computed once at module load from the real clock — so a wrong branch
   * produces a plausible number that nothing contradicts.
   *
   * The reference date is passed in, which is what makes every case below
   * deterministic rather than a function of the day the suite runs.
   */
  describe('ageFrom', () => {
    const on = (iso) => new Date(`${iso}T12:00:00`);

    it('says nothing when the academy has no date', () => {
      expect(ageFrom(null, on('2026-01-15'))).toBeNull();
      expect(ageFrom('', on('2026-01-15'))).toBeNull();
    });

    it('counts a birthday already past this year', () => {
      expect(ageFrom('1998-03-14', on('2026-06-01'))).toBe(28);
    });

    it('does not count a birthday still to come', () => {
      expect(ageFrom('1998-03-14', on('2026-01-15'))).toBe(27);
    });

    it('counts the birthday itself', () => {
      expect(ageFrom('1998-03-14', on('2026-03-14'))).toBe(28);
    });

    it('does not count the day before', () => {
      expect(ageFrom('1998-03-14', on('2026-03-13'))).toBe(27);
    });

    it('treats a bare year as the first of January', () => {
      expect(ageFrom('1998', on('2026-01-01'))).toBe(28);
      expect(ageFrom('1998', on('2025-12-31'))).toBe(27);
    });

    it('says nothing for a date it cannot read', () => {
      expect(ageFrom('marzo', on('2026-01-15'))).toBeNull();
    });

    it('says nothing rather than a negative age for a date in the future', () => {
      expect(ageFrom('2030-01-01', on('2026-01-15'))).toBeNull();
    });

    it('says nothing for an age no dancer has', () => {
      expect(ageFrom('1850-01-01', on('2026-01-15'))).toBeNull();
    });
  });

  /*
   * The academy's own reel: the footage that belongs to the school rather
   * than to one style or one teacher. A genre page with no footage of its
   * own shows these, so the page is never an empty box.
   *
   * Every case injects its videos. The first version asserted greater-than-
   * zero against the committed academy.json, which the importer regenerates
   * wholesale: retiring the reel, or the ladies footage the companion case
   * needed, would have turned them red with no code change. The suite was
   * already mocking the data module a few cases below for exactly this.
   */
  describe('getAcademyVideos', () => {
    const REEL = {
      id: 'presentacion', title: 'Presentación', genreId: null, teacherId: null, assetKey: null, externalUrl: 'https://example.test/reel.mp4',
    };
    const OF_A_GENRE = {
      id: 'ladies-latinas', title: 'Ladies latinas', genreId: 'ladies', teacherId: null, assetKey: null, externalUrl: 'https://example.test/ladies.mp4',
    };
    const OF_A_TEACHER = {
      id: 'video-mishel', title: 'Mishel', genreId: null, teacherId: 'mishel', assetKey: null, externalUrl: 'https://example.test/mishel.mp4',
    };

    async function reelFrom(videoList) {
      vi.resetModules();
      vi.doMock('./academy.json', () => ({
        default: { ...academy, videos: videoList },
      }));

      const mod = await import('./index');
      vi.doUnmock('./academy.json');

      return mod.getAcademyVideos();
    }

    it('returns the video tied to neither a genre nor a teacher', async () => {
      const reel = await reelFrom([REEL, OF_A_GENRE, OF_A_TEACHER]);

      expect(reel.map((video) => video.id)).toEqual(['presentacion']);
    });

    it('leaves out a video that belongs to a genre', async () => {
      const reel = await reelFrom([OF_A_GENRE]);

      expect(reel).toEqual([]);
    });

    it('leaves out a video that belongs to a teacher', async () => {
      const reel = await reelFrom([OF_A_TEACHER]);

      expect(reel).toEqual([]);
    });

    /*
     * The shipped file must actually carry a reel, because the genre pages
     * fall back to it. That is a fact about the content rather than about the
     * predicate, so it is asserted once, on its own, where a failure says
     * "the academy retired its reel" instead of "the lookup is broken".
     */
    it('finds a reel in the published data, which the genre pages rely on', () => {
      expect(getAcademyVideos().length).toBeGreaterThan(0);
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
