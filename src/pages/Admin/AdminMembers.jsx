import { useId } from 'react';

import MemberSearch from '../../features/membership/ui/MemberSearch';

import './css/admin-members.css';

/**
 * The member directory (Spec: Member Directory): a section of the admin frame,
 * which brings the heading of the area and the landmark, so this one adds only
 * its own level 2 heading and the search.
 */
export default function AdminMembers() {
  const titleId = useId();

  return (
    <section className="admin-members" aria-labelledby={titleId}>
      <h2 className="heading-sm admin-members__title" id={titleId}>Miembros</h2>
      <MemberSearch />
    </section>
  );
}
