import PropTypes from 'prop-types';

import './css/page.css';

/*
 * The frame a content page sits in.
 *
 * Before this existed each page answered "how do I sit on a screen" for
 * itself, and the five answers did not agree: two used --page-gutter, one
 * padded itself 1rem, one 0.8rem, and the faculty page declared nothing at
 * all. The gutter token was already there to settle it; what was missing was
 * something that consumed it.
 *
 * It also carries the two things four of the five pages were missing outright:
 * a <main> landmark to skip to, and an <h1> saying where you are.
 *
 * Home does not use this. It is a landing page whose hero runs edge to edge,
 * so it owns its own bands; wrapping it here would mean a prop to switch the
 * gutters back off, which is the configuration this component exists to avoid.
 */
export default function Page({
  title,
  lead = undefined,
  action = undefined,
  titleHidden = false,
  className = undefined,
  children = undefined,
}) {
  return (
    <main className={className ? `page ${className}` : 'page'}>
      <header className={titleHidden ? 'sr-only' : 'page__header'}>
        <div className="page__title-row">
          {action}
          <h1 className="heading-md page__title">{title}</h1>
        </div>
        {lead && <p className="text-md page__lead">{lead}</p>}
      </header>
      {children}
    </main>
  );
}

Page.propTypes = {
  title: PropTypes.string.isRequired,
  /** One line under the title. Omit it rather than pad the page with filler. */
  lead: PropTypes.string,
  /*
   * Sits beside the title: a back button on a detail page. A node rather than
   * a set of flags, so a page that needs something else here does not need
   * this component to learn about it.
   */
  action: PropTypes.node,
  /*
   * For a page that already names itself on screen — a full-bleed hero, a map
   * that is its own label. The heading still ships for a screen reader, which
   * is the half of it that cannot be inferred from the picture.
   */
  titleHidden: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};
