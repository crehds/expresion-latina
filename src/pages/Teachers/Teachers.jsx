import { Component } from 'react';
import PropTypes from 'prop-types';

import { Page } from '../../components';
import { getTeacherById, teachers } from '../../data';
import { getActiveTeacherIds } from '../../data/selectors';
import withRouter from '../../hocs/withRouter';
import { TeacherPanel, TeachersGrid } from './components';

/**
 * The faculty, and one teacher's profile.
 *
 * Which profile is open lives in the URL rather than in state: /teachers/omar
 * is a page that can be linked to, so a class in the schedule can point at the
 * person teaching it, and a visitor can share a teacher with a friend.
 *
 * One grid at every width. A phone used to get its own component that paged
 * the faculty four at a time behind two arrows pinned to the middle of the
 * viewport, and padded its two-card slide by 30rem on a 36rem screen. A grid
 * that reflows needs none of that: the phone scrolls, which is the gesture it
 * already has, and the same markup groups who is teaching now on every screen
 * rather than only on a desktop.
 */
// eslint-disable-next-line react/prefer-stateless-function
class Teachers extends Component {
  showProfile = (teacher) => {
    const { navigate } = this.props;

    return navigate(teacher ? `/teachers/${teacher.id}` : '/teachers');
  };

  render() {
    const { params } = this.props;

    // An unknown id in the URL shows the faculty rather than an empty modal,
    // which is what a stale link from an old schedule produces.
    const teacherForModal = params.teacherId ? getTeacherById(params.teacherId) : null;

    return (
      <Page title="Profesores" lead="Toca a un profesor para ver su perfil.">
        <TeachersGrid
          teachers={teachers}
          activeIds={getActiveTeacherIds()}
          showProfile={this.showProfile}
        />

        {teacherForModal && (
          <TeacherPanel
            onClose={() => this.showProfile()}
            teacher={teacherForModal}
          />
        )}
      </Page>
    );
  }
}

Teachers.propTypes = {
  navigate: PropTypes.func.isRequired,
  params: PropTypes.shape({ teacherId: PropTypes.string }).isRequired,
};

export default withRouter(Teachers);
