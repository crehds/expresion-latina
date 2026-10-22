import PropTypes from 'prop-types';
import { useEffect, useId, useRef } from 'react';

import Modal from '../../../components/Modal/Modal';
import { useAttendance } from '../composition/AttendanceProvider';
import { CrossIcon } from './AttendanceIcons';
import {
  MEMBERSHIP_MODAL_CLOSE,
  MEMBERSHIP_MODAL_SCRIM,
  MEMBERSHIP_MODAL_TEXT,
  MEMBERSHIP_MODAL_TITLE,
  WHATSAPP_LINK_TEXT,
} from './attendanceCopy';

import './css/membership-modal.css';

const FOCUSABLE = 'a[href], button:not([disabled])';

// The dialog itself, mounted only while it is open, so everything it does on the way
// in (take the focus) and out (give it back, stop listening for keys) is its mount
// and its unmount.
function Dialog({ whatsappLink = null, opener = null, onClose }) {
  const titleId = useId();
  const textId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  // What had the focus when it opened, for a tap that left it nowhere (a browser
  // that does not focus a button on click) or an opener that is gone.
  const previousRef = useRef(null);

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
      // Keep the focus inside: two stops, so Tab and Shift+Tab go round them.
      const stops = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) {
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
      const target = opener?.isConnected ? opener : previousRef.current;
      target?.focus?.();
    };
    // The dialog is mounted for one opening: a new opener or handler is a new one.
  }, [onClose, opener]);

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
        <h2 className="heading-sm membership-modal__title" id={titleId}>
          {MEMBERSHIP_MODAL_TITLE}
        </h2>
        <p className="text-md membership-modal__text" id={textId}>{MEMBERSHIP_MODAL_TEXT}</p>
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
  onClose: PropTypes.func.isRequired,
};

/**
 * The prompt for a member who needs a membership to confirm (F2b). It opens when the
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
  const { promptOpen, promptOpener, closePrompt } = useAttendance();

  if (!promptOpen) {
    return null;
  }

  return <Dialog whatsappLink={whatsappLink} opener={promptOpener} onClose={closePrompt} />;
}

MembershipRequiredModal.propTypes = { whatsappLink: PropTypes.string };

export default MembershipRequiredModal;
