/**
 * Who answers for the personal data of the accounts, as the privacy notice
 * states it (`src/pages/Privacy/Privacy.jsx`).
 *
 * The owner fills these two in before the feature goes live (owner decision
 * 2026-10-19). The brackets are part of the text so that nobody can take them
 * for a name, and a production build with the backend on refuses to ship while
 * either one is still bracketed (`src/composition/activationGuardPlugin.js`).
 *
 * - CONTROLLER: the legal name of the data controller (razón social) and its
 *   tax id (RUC).
 * - CONTACT: the address a member writes to in order to exercise their rights.
 */
export const CONTROLLER = '[RESPONSABLE]';
export const CONTACT = '[CONTACTO]';
