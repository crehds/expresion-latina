// Adds the DOM matchers the tests rely on — toBeInTheDocument, toHaveAttribute,
// toHaveTextContent. Registering them here means every suite gets them without
// importing anything.
//
// The subpath this used to import, /extend-expect, was removed in v7; the
// package root now registers the matchers on its own.
import '@testing-library/jest-dom';

/*
 * jsdom implements no matchMedia at all, and the header, the faculty and the
 * schedule all read it on construction to pick their layout before the first
 * paint. Without this they throw rather than fail an assertion, which hides
 * whatever the test was actually about.
 *
 * The default is the narrow layout because that is the one a phone gets, and a
 * suite that cares about the wide one overrides this with its own mock.
 */
window.matchMedia = window.matchMedia || ((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}));
