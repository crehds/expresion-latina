import PropTypes from 'prop-types';
import { useEffect, useId, useRef } from 'react';

import Modal from '../../../components/Modal/Modal';
import { useAttendance } from '../composition/AttendanceProvider';
import { membershipPrompt } from '../domain/rules';
import { CrossIcon } from './AttendanceIcons';
import {
  MEMBERSHIP_MODAL_CLOSE,
  MEMBERSHIP_MODAL_SCRIM,
  WHATSAPP_LINK_TEXT,
  membershipModalCopy,
} from './attendanceCopy';

import './css/membership-modal.css';

const FOCUSABLE = 'a[href], button:not([disabled])';

// The dialog itself, mounted only while it is open, so everything it does on the way
// in (take the focus) and out (give it back, stop listening for keys) is its mount
// and its unmount.
function Dialog({
  whatsappLink = null, opener = null, prompt = null, onClose,
}) {
  const titleId = useId();
  const textId = useId();
  const { title, text } = membershipModalCopy(prompt, Boolean(whatsappLink));
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  // What had the focus when it opened, for a tap that left it nowhere (a browser
  // that does not focus a button on click) or an opener that is gone.
  const previousRef = useRef(null);
  // The latest opener, read when the dialog closes: opening it again while it is open
  // (from another check) changes where the focus goes back to, not the dialog.
  const openerRef = useRef(opener);
  openerRef.current = opener;

  useEffect(() => {
    previousRef.current = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }
      // Keep the focus inside, from anywhere: the stops are few, so Tab and Shift+Tab
      // go round them, and a focus that is not on one of them (on the page behind,
      // after a click on the text, or on the dialog itself) goes in at the first stop
      // for Tab and at the last for Shift+Tab. No helper of the site does this: the
      // teacher panel only closes on Escape.
      const stops = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
      const first = stops[0];
      const last = stops[stops.length - 1];
      const onAStop = stops.includes(document.activeElement);
      if (!onAStop) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const latest = openerRef.current;
      const target = latest?.isConnected ? latest : previousRef.current;
      target?.focus?.();
    };
  }, [onClose]);

  return (
    <Modal>
      <button
        type="button"
        className="membership-modal__scrim"
        onClick={onClose}
        aria-label={MEMBERSHIP_MODAL_SCRIM}
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        className="membership-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <button
          ref={closeRef}
          type="button"
          className="membership-modal__close"
          onClick={onClose}
          aria-label={MEMBERSHIP_MODAL_CLOSE}
        >
          <CrossIcon className="attendance-icon--close" />
        </button>
        <h2 className="heading-sm membership-modal__title" id={titleId}>{title}</h2>
        <p className="text-md membership-modal__text" id={textId}>{text}</p>
        {whatsappLink && (
          <a
            className="text-md membership-modal__link"
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
          >
            {WHATSAPP_LINK_TEXT}
          </a>
        )}
      </div>
    </Modal>
  );
}

Dialog.propTypes = {
  whatsappLink: PropTypes.string,
  opener: PropTypes.instanceOf(Element),
  prompt: PropTypes.shape({ kind: PropTypes.string, startsOn: PropTypes.string }),
  onClose: PropTypes.func.isRequired,
};

/**
 * The prompt for a member who needs a membership to confirm (F2b). It says one of two
 * things (`membershipPrompt`): that they have to enrol, or that their membership starts
 * on a day and that an earlier start is asked for (the admin moves the dates). It opens when the
 * check of a card is tapped by a member with no active membership, and when a confirm
 * that the database refuses is followed by a fresh read that shows the membership
 * lapsed, so the checks never vanish under a finger. It asks the member to enrol and
 * links to WhatsApp, or only says so when the studio has no WhatsApp. The wording is a
 * draft for the owner's review.
 *
 * It is a modal dialog on the site's Modal portal, with a label and a description:
 * the focus goes to its close button, Tab stays inside, Escape, the close button and
 * the scrim close it, and the focus goes back to the check that was tapped. It lives
 * once on the page, inside the attendance provider, which holds whether it is open.
 */
function MembershipRequiredModal({ whatsappLink = null }) {
  const {
    promptOpen, promptOpener, closePrompt, membership, now, isAdmin,
  } = useAttendance();

  if (!promptOpen) {
    return null;
  }

  // What it says depends on the periods held now: no membership at all, or one that
  // starts later. The periods were just read when a refused confirm opened it.
  const prompt = membershipPrompt({ membership, now, isAdmin });

  return (
    <Dialog
      whatsappLink={whatsappLink}
      opener={promptOpener}
      prompt={prompt}
      onClose={closePrompt}
    />
  );
}

MembershipRequiredModal.propTypes = { whatsappLink: PropTypes.string };

export default MembershipRequiredModal;
