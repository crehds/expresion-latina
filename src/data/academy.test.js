// The default ajv export only understands draft-07; the schema declares 2020-12.
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import academy from './academy.json';
import schema from './academy.schema.json';
import { TEACHER_IMAGES, VIDEO_ASSETS } from './assets';

function idsOf(collection) {
  return collection.map((entry) => entry.id);
}

function duplicatesIn(ids) {
  return ids.filter((id, index) => ids.indexOf(id) !== index);
}

describe('academy.json', () => {
  it('matches the schema', () => {
    const ajv = addFormats(new Ajv({ allErrors: true }));
    const validate = ajv.compile(schema);

    validate(academy);

    // Surfaces the offending path and rule rather than a bare `false`.
    expect(validate.errors ?? []).toEqual([]);
  });

  describe('identifiers', () => {
    it.each([
      ['days', 'days'],
      ['timeSlots', 'timeSlots'],
      ['genres', 'genres'],
      ['teachers', 'teachers'],
      ['videos', 'videos'],
      ['sessions', 'sessions'],
    ])('has no duplicate ids in %s', (_label, key) => {
      expect(duplicatesIn(idsOf(academy[key]))).toEqual([]);
    });

    it('gives every day a distinct weekday', () => {
      const weekdays = academy.days.map((day) => day.weekday);
      expect(new Set(weekdays).size).toBe(weekdays.length);
    });
  });

  describe('references', () => {
    const genreIds = new Set(idsOf(academy.genres));
    const teacherIds = new Set(idsOf(academy.teachers));
    const dayIds = new Set(idsOf(academy.days));
    const slotIds = new Set(idsOf(academy.timeSlots));
    const videoIds = new Set(idsOf(academy.videos));

    it('resolves every reference a session makes', () => {
      academy.sessions.forEach((session) => {
        expect(dayIds).toContain(session.dayId);
        expect(slotIds).toContain(session.slotId);
        expect(genreIds).toContain(session.genreId);
        if (session.teacherId) expect(teacherIds).toContain(session.teacherId);
      });
    });

    it('resolves every genre a teacher claims', () => {
      academy.teachers.forEach((teacher) => {
        (teacher.genreIds ?? []).forEach((id) => expect(genreIds).toContain(id));
      });
    });

    it('resolves every video a genre lists, and every genre a video claims', () => {
      academy.genres.forEach((genre) => {
        (genre.videoIds ?? []).forEach((id) => expect(videoIds).toContain(id));
      });
      academy.videos.forEach((video) => {
        if (video.genreId) expect(genreIds).toContain(video.genreId);
      });
    });

    it('never puts two classes in the same room at the same time', () => {
      const taken = academy.sessions.map((s) => `${s.dayId}|${s.slotId}|${s.room ?? 'default'}`);
      expect(duplicatesIn(taken)).toEqual([]);
    });
  });

  // These two catch the failure that would otherwise ship as a broken <img>
  // or a silently missing video in production.
  describe('assets', () => {
    it('has a bundled image for every teacher that declares one', () => {
      academy.teachers.forEach((teacher) => {
        if (teacher.imageKey) expect(Object.keys(TEACHER_IMAGES)).toContain(teacher.imageKey);
      });
    });

    it('has a bundled file for every video that declares one', () => {
      academy.videos.forEach((video) => {
        if (video.assetKey) expect(Object.keys(VIDEO_ASSETS)).toContain(video.assetKey);
      });
    });
  });
});
