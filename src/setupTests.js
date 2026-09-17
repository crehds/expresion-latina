// Adds the DOM matchers the tests rely on — toBeInTheDocument, toHaveAttribute,
// toHaveTextContent. Registering them here means every suite gets them without
// importing anything.
//
// The subpath this used to import, /extend-expect, was removed in v7; the
// package root now registers the matchers on its own.
import '@testing-library/jest-dom';
