import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { getTeacherById } from '../../../data';
import TeacherPanel from './TeacherPanel';

// The router state that marks a profile opened from a page's own cards, as opposed to
// one reached by a shared link.
const OPENED_HERE = 'openedHere';

/**
 * Builds the `teacherLink` a page hands to its session cards: back to that page with the
 * teacher in the address, which opens the profile over it (see TeacherProfileOverlay).
 * The state says the visit began on the page, so that closing the profile can go back
 * instead of forward.
 *
 * @param {string} pathname The page the link returns to, such as '/schedules'.
 */
export const teacherProfileLink = (pathname) => (teacher) => ({
  to: `${pathname}?teacher=${encodeURIComponent(teacher.id)}`,
  state: { [OPENED_HERE]: true },
});

/**
 * Opens a teacher's profile over whatever page renders it.
 *
 * Which teacher's profile is open lives in the address (?teacher=<id>), so the back
 * button closes it and a link to it can be shared. Render it as a sibling of the page,
 * not a wrapper around it: the search changing re-renders this component, but the page
 * keeps its place in the tree, so its own state (and the scroll) stay put. Nothing in
 * the app scrolls on a location change.
 *
 * An unknown id shows the page alone, the same as the teachers page does.
 */
function TeacherProfileOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const teacherId = searchParams.get('teacher');
  const teacher = teacherId ? getTeacherById(teacherId) : null;

  // Stepping back is asynchronous in a browser: the panel stays up until the location
  // changes. A second close in that gap (a double click, Escape and then a click)
  // would step back again and leave the site, so it is ignored. The flag is cleared
  // by the location changing, not by the entry: forward reopens the same entry, and
  // closing that one must work again.
  const goingBack = useRef(false);
  useEffect(() => {
    goingBack.current = false;
  }, [location.key]);

  // Opened from a card: the previous entry is this page without the profile, so going
  // back is exactly what the back button would do. Reached by a link: there may be no
  // previous entry on this site at all, so drop the parameter in place instead.
  const closeProfile = () => {
    if (location.state?.[OPENED_HERE]) {
      if (goingBack.current) return;
      goingBack.current = true;
      navigate(-1);
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('teacher');
      return next;
    }, { replace: true });
  };

  if (!teacher) return null;

  return <TeacherPanel teacher={teacher} onClose={closeProfile} />;
}

export default TeacherProfileOverlay;
