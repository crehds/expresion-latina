import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import fixture from './__fixtures__/academy.fixture.json';
import schema from './academy.schema.json';
import {
  buildWeekMatrix,
  createSelectors,
  getActiveDays,
  getActiveTimeSlots,
  getSessionsForWeekday,
  hasPublishedSchedule,
} from './selectors';

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
    getTeachersByGenreId: (genreId) => data.teachers.filter(
      (teacher) => (teacher.genreIds ?? []).includes(genreId),
    ),
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
      const monday = selectorsForFixture().getSessionsForWeekday(1);

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

  describe('getNextOpenDay', () => {
    // The landing page asks this on whatever day the visitor arrives, so the
    // closed days are the interesting input, not Monday.
    it('answers with today when today has classes', () => {
      const open = selectorsForFixture().getNextOpenDay(1);

      expect(open.day.name).toBe('Lunes');
      expect(open.isToday).toBe(true);
      expect(open.sessions).toHaveLength(3);
    });

    it('rolls forward past a closed day and says it is not today', () => {
      const open = selectorsForFixture().getNextOpenDay(2);

      expect(open.day.name).toBe('Sábado');
      expect(open.isToday).toBe(false);
    });

    // Sunday is weekday 0, so the search has to wrap rather than run off the
    // end of the week. This is the case the modulo exists for.
    it('wraps around the end of the week', () => {
      const open = selectorsForFixture().getNextOpenDay(0);

      expect(open.day.name).toBe('Lunes');
    });

    it('returns null when nothing is published', () => {
      const empty = { ...fixture, sessions: [] };

      expect(selectorsForFixture(empty).getNextOpenDay(1)).toBeNull();
    });
  });

  describe('getActiveDays', () => {
    it('omits days with no classes, so the week view has no empty columns', () => {
      const names = selectorsForFixture().getActiveDays().map((day) => day.name);

      expect(names).toEqual(['Lunes', 'Sábado']);
    });

    it('keeps display order', () => {
      const weekdays = selectorsForFixture().getActiveDays().map((day) => day.weekday);

      expect(weekdays).toEqual([1, 6]);
    });

    it('is empty when nothing is published', () => {
      expect(selectorsForFixture({ ...fixture, sessions: [] }).getActiveDays()).toEqual([]);
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
  });

  // The published schedule, exercised through the real dataset rather than the
  // fixture. These assert the shape the page depends on, not the content: they
  // are expected to change when the academy publishes a different month.
  describe('the published schedule', () => {
    it('is published', () => {
      expect(hasPublishedSchedule()).toBe(true);
    });

    it('lists a weekday in start order', () => {
      const tuesday = getSessionsForWeekday(2);

      expect(tuesday.map((s) => `${s.slot.start} ${s.genre.name}`)).toEqual([
        '19:00 Sexy Style',
        '20:00 Bachata',
        '21:00 Bachata',
      ]);
    });

    it('has no classes at the weekend', () => {
      expect(getSessionsForWeekday(6)).toEqual([]);
      expect(getSessionsForWeekday(0)).toEqual([]);
    });

    // The week view renders a column per active day, so adding a Saturday
    // class later widens it without anyone configuring anything.
    it('runs Monday to Friday', () => {
      expect(getActiveDays().map((day) => day.name))
        .toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    });

    // The flyer runs a one-hour and a ninety-minute class from the same start
    // time on different days, so slots overlap rather than tile a grid.
    it('keeps slots that share a start time but not an end time apart', () => {
      const starts = getActiveTimeSlots().filter((slot) => slot.start === '19:00');

      expect(starts.map((slot) => slot.end).sort()).toEqual(['20:00', '20:30']);
    });

    it('keeps the lone morning class in its own slot', () => {
      const [friday] = getSessionsForWeekday(5);

      expect(friday.slot.label).toBe('10:00 - 11:30');
      expect(friday.genre.name).toBe('Heels');
    });

    it('builds a matrix with one row per used slot and one column per day', () => {
      const matrix = buildWeekMatrix();

      expect(matrix).toHaveLength(getActiveTimeSlots().length);
      matrix.forEach((row) => expect(row).toHaveLength(7));
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

/*
 * A teacher keeps their genreIds after they stop appearing in the schedule,
 * so a class page reading the links alone names people the faculty page no
 * longer shows.
 *
 * The pair below is the whole point: one teacher linked to salsa and in the
 * schedule, one linked to salsa and absent from it. An earlier version of
 * these tests asserted against the committed dataset, which the importer
 * regenerates — a month where every linked teacher happened to be scheduled
 * would have turned them red with no code change.
 */
describe('getActiveTeachersByGenreId', () => {
  const LINKED_AND_SCHEDULED = { id: 'mishel', name: 'Mishel', genreIds: ['salsa'] };
  const LINKED_AND_GONE = { id: 'retirada', name: 'Retirada', genreIds: ['salsa'] };

  function withBothKinds() {
    return selectorsForFixture({
      ...fixture,
      teachers: [LINKED_AND_SCHEDULED, LINKED_AND_GONE],
    });
  }

  it('keeps the teacher the schedule still names', () => {
    expect(withBothKinds().getActiveTeachersByGenreId('salsa').map((t) => t.id))
      .toEqual(['mishel']);
  });

  it('drops the teacher who kept the genre but left the schedule', () => {
    expect(withBothKinds().getActiveTeachersByGenreId('salsa').map((t) => t.id))
      .not.toContain('retirada');
  });

  it('empties a genre whose only teacher has left', () => {
    const selectors = selectorsForFixture({
      ...fixture,
      teachers: [LINKED_AND_GONE],
    });

    expect(selectors.getActiveTeachersByGenreId('salsa')).toEqual([]);
  });

  it('returns nothing for a genre nobody is linked to', () => {
    expect(withBothKinds().getActiveTeachersByGenreId('bachata')).toEqual([]);
  });
});
