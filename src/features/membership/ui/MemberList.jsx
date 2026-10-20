/**
 * The members a search found (Spec: Member Directory), one row each.
 *
 * A row shows the name, the email, whether the membership is active and the date
 * their payments run to, and nothing else of the member. The status comes from
 * the directory as the database worked it out for today in Lima, and the date is
 * written without ever going through a time zone. A date that is no calendar day
 * gets a neutral line, so one bad row never takes the whole list down. The name
 * links to the member's page by the id the server sent; the name and the email
 * never go into an address.
 */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import {
  ACTIVE, INACTIVE, NO_PAYMENTS, lastDueText, paidUntilText,
} from './membershipCopy';

import './css/member-list.css';

function paymentLine({ isActive, paidUntil }) {
  if (!paidUntil) {
    return NO_PAYMENTS;
  }
  return isActive ? paidUntilText(paidUntil) : lastDueText(paidUntil);
}

export default function MemberList({ members }) {
  return (
    <ul className="member-list">
      {members.map((member) => (
        <li className="member-list__item" key={member.id}>
          <Link className="member-list__name" to={`/admin/members/${member.id}`}>
            {member.fullName}
          </Link>
          <span className="member-list__email">{member.email}</span>
          <span
            className={`member-list__status member-list__status--${member.isActive ? 'active' : 'inactive'}`}
          >
            {member.isActive ? ACTIVE : INACTIVE}
          </span>
          <span className="member-list__payment">{paymentLine(member)}</span>
        </li>
      ))}
    </ul>
  );
}

MemberList.propTypes = {
  members: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    fullName: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    paidUntil: PropTypes.string,
    isActive: PropTypes.bool.isRequired,
  })).isRequired,
};
