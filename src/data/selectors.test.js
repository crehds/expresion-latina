import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import fixture from './__fixtures__/academy.fixture.json';
import schema from './academy.schema.json';
import { createSelectors, hasPublishedSchedule } from './selectors';

function byId(collection) {
  const map = new Map(collection.map((entry) => [entry.id, entry]));
  return (id) => map.get(id);
}

function selectorsForFixture(data = fixture) {
  return createSelectors({
    days: data.days,
    timeSlots: [...data.timeSlots].sort((a, b) => a.start.localeCompare(b.start)),
    sessions: data.sessions,
    getDayById: byId(data.days),
    getTimeSlotById: byId(data.timeSlots),
    getGenreById: byId(data.genres),
    getTeacherById: byId(data.teachers),
  });
}

describe('schedule selectors', () => {
  it('uses a fixture that is itself valid academy content', () => {
    const validate = addFormats(new Ajv({ allErrors: true })).compile(schema);
    validate(fixture);
    expect(validate.errors ?? []).toEqual([]);
  });

  describe('getSessionsForWeekday', () => {
    it('returns the classes of a day, earliest first', () => {
      const { getSessionsForWeekday } = selectorsForFixture();

      const monday = getSessionsForWeekday(1);

      expect(monday).toHaveLength(3);
      expect(monday.map((s) => s.slot.start)).toEqual(['19:00', '19:00', '20:00']);
    });

    it('resolves each reference into a full entity', () => {
      const [first] = selectorsForFixture().getSessionsForWeekday(6);

      expect(first.genre.name).toBe('Salsa');
      expect(first.day.name).toBe('Sábado');
      expect(first.slot.label).toBe('10:00 - 11:00');
    });

    it('returns null for the teacher when a class has none', () => {
      const [saturday] = selectorsForFixture().getSessionsForWeekday(6);

      expect(saturday.teacher).toBeNull();
    });

    // A closed day is ordinary data. It must not be undefined and must not throw.
    it.each([
      ['Martes', 2],
      ['Domingo', 0],
    ])('returns an empty list for %s, a day with no classes', (_name, weekday) => {
      expect(selectorsForFixture().getSessionsForWeekday(weekday)).toEqual([]);
    });

    it('returns an empty list for a weekday the academy does not list at all', () => {
      expect(selectorsForFixture().getSessionsForWeekday(4)).toEqual([]);
    });
  });

  describe('getActiveTimeSlots', () => {
    it('omits a slot no class uses, so the grid has no empty rows', () => {
      const labels = selectorsForFixture().getActiveTimeSlots().map((slot) => slot.label);

      expect(labels).toEqual(['10:00 - 11:00', '19:00 - 20:00', '20:00 - 21:00']);
      expect(labels).not.toContain('21:00 - 22:00');
    });
  });

  describe('buildWeekMatrix', () => {
    it('is one row per active slot and one column per day', () => {
      const matrix = selectorsForFixture().buildWeekMatrix();

      expect(matrix).toHaveLength(3);
      matrix.forEach((row) => expect(row).toHaveLength(fixture.days.length));
    });

    it('gives an empty array, not undefined, for an hour with no class', () => {
      const matrix = selectorsForFixture().buildWeekMatrix();

      // 10:00 row, Monday column: Saturday uses this slot, Monday does not.
      expect(matrix[0][0]).toEqual([]);
    });

    it('holds both classes when two run in the same hour in different rooms', () => {
      const matrix = selectorsForFixture().buildWeekMatrix();

      // 19:00 row, Monday column.
      const cell = matrix[1][0];

      expect(cell).toHaveLength(2);
      expect(cell.map((s) => s.room).sort()).toEqual(['Sala 1', 'Sala 2']);
    });
  });

  describe('a dataset with no schedule published yet', () => {
    const empty = { ...fixture, sessions: [] };

    it('reports that nothing is published', () => {
      expect(selectorsForFixture(empty).hasPublishedSchedule()).toBe(false);
    });

    it('builds an empty matrix instead of throwing', () => {
      expect(selectorsForFixture(empty).buildWeekMatrix()).toEqual([]);
      expect(selectorsForFixture(empty).getActiveTimeSlots()).toEqual([]);
      expect(selectorsForFixture(empty).getSessionsForWeekday(1)).toEqual([]);
    });

    it('is the current state of the real dataset', () => {
      expect(hasPublishedSchedule()).toBe(false);
    });
  });

  describe('a session pointing at something that does not exist', () => {
    it('is dropped rather than rendered half-blank', () => {
      const broken = {
        ...fixture,
        sessions: [...fixture.sessions, {
          id: 'ghost', dayId: 'lunes', slotId: 't1900', genreId: 'tango', room: 'Sala 1',
        }],
      };

      expect(selectorsForFixture(broken).getSessionsForWeekday(1)).toHaveLength(3);
    });
  });
});
