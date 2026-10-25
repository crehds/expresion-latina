/**
 * Who answers for the personal data of the accounts, as the privacy notice
 * states it (`src/pages/Privacy/Privacy.jsx`).
 *
 * The owner gave both values on 2026-10-25; the razón social is still to be
 * checked against the RUC before launch. A production build with the backend
 * on still refuses to ship if either one goes back to a bracketed placeholder
 * or blank (`src/composition/activationGuardPlugin.js`).
 *
 * - CONTROLLER: the legal name of the data controller (razón social), and its
 *   tax id (RUC) if the owner wants it shown.
 * - CONTACT: the address a member writes to in order to exercise their rights:
 *   the academy's email, the same one the footer shows.
 */
export const CONTROLLER = 'Expresión Latina S.A.C.';
export const CONTACT = 'expresionlatina@gmail.com';
