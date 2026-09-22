import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import guardAcademy from '../guard.mjs';

/** A finished academy the guard should let through untouched. */
function academy(overrides = {}) {
  return {
    studio: {
      name: 'Expresión Latina',
      address: 'Av. Palmeras 3839, 3er piso, Los Olivos',
      whatsapp: '+51 960 507 583',
      email: 'expresionlatina@gmail.com',
      phone: null,
      social: {},
    },
    genres: [{ id: 'salsa' }],
    teachers: [{ id: 'mishel-fernandez' }],
    sessions: [{ id: 'lun-1900' }],
    timeSlots: [{ id: 't1900-2000' }],
    videos: [],
    reviews: [],
    ...overrides,
  };
}

const messages = (problems) => problems.map((problem) => problem.message).join('\n');

describe('an academy the site can actually serve', () => {
  it('passes', () => {
    assert.deepEqual(guardAcademy(academy()), []);
  });

  it('passes with no reviews, which is the published state today', () => {
    assert.deepEqual(guardAcademy(academy({ reviews: [] })), []);
  });

  it('passes with no videos, which are hand-curated and optional', () => {
    assert.deepEqual(guardAcademy(academy({ videos: [] })), []);
  });

  it('passes with no phone, which is null in the published file', () => {
    const studio = { ...academy().studio, phone: null };
    assert.deepEqual(guardAcademy(academy({ studio })), []);
  });
});

describe('a rebuild that would empty the site', () => {
  it('refuses an academy with no teachers', () => {
    const problems = guardAcademy(academy({ teachers: [] }));

    assert.equal(problems.length, 1);
    assert.match(messages(problems), /sin profesores/);
  });

  it('refuses an academy with no genres', () => {
    const problems = guardAcademy(academy({ genres: [] }));

    assert.equal(problems.length, 1);
    assert.match(messages(problems), /sin géneros/);
  });

  it('refuses an academy with no sessions', () => {
    const problems = guardAcademy(academy({ sessions: [] }));

    assert.equal(problems.length, 1);
    assert.match(messages(problems), /sin clases/);
  });

  it('collects every emptied collection rather than stopping at the first', () => {
    const problems = guardAcademy(academy({ teachers: [], genres: [], sessions: [] }));

    assert.equal(problems.length, 3);
  });

  it('names the sheet that is probably missing', () => {
    const problems = guardAcademy(academy({ teachers: [] }));

    assert.match(messages(problems), /Profesores/);
  });

  it('says how many there were, so the size of the loss is visible', () => {
    const previous = academy({ teachers: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    const problems = guardAcademy(academy({ teachers: [] }), previous);

    assert.match(messages(problems), /antes hab[íi]a 3/);
  });

  it('says nothing about counts when there is no previous file to compare', () => {
    const problems = guardAcademy(academy({ teachers: [] }), null);

    assert.doesNotMatch(messages(problems), /antes/);
  });
});

describe('studio details the footer shows on every page', () => {
  it('refuses a studio with no address', () => {
    const studio = { ...academy().studio, address: null };
    const problems = guardAcademy(academy({ studio }));

    assert.equal(problems.length, 1);
    assert.match(messages(problems), /Direccion/);
  });

  it('refuses a studio with no whatsapp', () => {
    const studio = { ...academy().studio, whatsapp: null };

    assert.match(messages(guardAcademy(academy({ studio }))), /Whatsapp/);
  });

  it('refuses a studio with no email', () => {
    const studio = { ...academy().studio, email: null };

    assert.match(messages(guardAcademy(academy({ studio }))), /Email/);
  });

  it('treats an empty string as missing, not as a value', () => {
    const studio = { ...academy().studio, address: '   ' };

    assert.equal(guardAcademy(academy({ studio })).length, 1);
  });

  it('refuses a studio the import dropped entirely', () => {
    const problems = guardAcademy(academy({ studio: { name: 'Expresión Latina', social: {} } }));

    assert.equal(problems.length, 3);
  });
});
