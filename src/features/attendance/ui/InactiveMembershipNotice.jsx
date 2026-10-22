import PropTypes from 'prop-types';

import { useAttendance } from '../composition/AttendanceProvider';
import { isMembershipInactive } from '../domain/rules';
import { INACTIVE_NOTICE, WHATSAPP_LINK_TEXT } from './attendanceCopy';

import './css/inactive-membership-notice.css';

/**
 * The notice above the public schedule for a signed-in member whose membership is
 * not active today: it says so once and invites to enrol, with the link to WhatsApp
 * when the studio has one. It replaces the message that every class card used to
 * carry. A class after the end of a membership that is active today still gets the
 * message of its own card.
 *
 * It renders nothing for anyone else: a visitor, a signed-out member, a disabled
 * backend or a session that is still loading (the provider is inert for all of
 * them), data that has not been read yet or could not be (the retry notice speaks
 * then), a member who is active today, and an administrator, who has free access to
 * classes. The administrator flag comes from the session profile, which is read
 * before the provider starts its own reads (see AttendanceProvider.session.test),
 * so an administrator is never shown this for a moment. The page works out "today"
 * with the clock of the provider, on the Lima calendar like the cards.
 */
function InactiveMembershipNotice({ whatsappLink = null }) {
  const { membership, isAdmin, now } = useAttendance();

  if (!isMembershipInactive({ membership, now, isAdmin })) {
    return null;
  }

  return (
    <div className="inactive-membership-notice" role="status">
      <p className="text-md inactive-membership-notice__message">{INACTIVE_NOTICE}</p>
      {whatsappLink && (
        <a
          className="text-md inactive-membership-notice__link"
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
        >
          {WHATSAPP_LINK_TEXT}
        </a>
      )}
    </div>
  );
}

InactiveMembershipNotice.propTypes = { whatsappLink: PropTypes.string };

export default InactiveMembershipNotice;
