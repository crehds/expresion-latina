import { useParams } from 'react-router-dom';

import MemberDetail from '../../features/membership/ui/MemberDetail';

/**
 * The page of one member (Spec: Recording Paid Periods, Correcting Paid
 * Periods), a section of the admin frame like the directory: the frame brings
 * the heading of the area and the landmark, and this one adds only what is about
 * the member, with the id the address carries. An address with anything else in
 * that place is answered, inside the frame, as a member who is not there.
 */
export default function AdminMemberDetail() {
  const { memberId } = useParams();

  return <MemberDetail memberId={memberId} />;
}
