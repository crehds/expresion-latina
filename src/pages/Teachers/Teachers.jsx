import { Component } from 'react';
import PropTypes from 'prop-types';

import { getTeacherById, teachers } from '../../data';
import { getActiveTeacherIds } from '../../data/selectors';
import withRouter from '../../hocs/withRouter';
import { TeacherModal, TeachersCarousel, TeachersGrid } from './components';

import './css/teachers.css';

const WIDE_SCREEN = '(min-width: 768px)';

/**
 * The faculty, and one teacher's profile.
 *
 * Which profile is open lives in the URL rather than in state: /teachers/omar
 * is a page that can be linked to, so a class in the schedule can point at the
 * person teaching it, and a visitor can share a teacher with a friend. The
 * only state left here is the viewport, which nothing outside the component
 * can ask about.
 */
class Teachers extends Component {
  constructor(props) {
    super(props);

    this.mediaQuery = window.matchMedia(WIDE_SCREEN);

    this.state = {
      // Read before the first paint so the right layout renders straight away.
      isWide: this.mediaQuery.matches,
    };
  }

  componentDidMount() {
    this.mediaQuery.addEventListener('change', this.handleViewportChange);
  }

  componentWillUnmount() {
    this.mediaQuery.removeEventListener('change', this.handleViewportChange);
  }

  handleViewportChange = (event) => this.setState({ isWide: event.matches });

  showProfile = (teacher) => {
    const { navigate } = this.props;

    return navigate(teacher ? `/teachers/${teacher.id}` : '/teachers');
  };

  render() {
    const { isWide } = this.state;
    const { params } = this.props;

    // An unknown id in the URL shows the faculty rather than an empty modal,
    // which is what a stale link from an old schedule produces.
    const teacherForModal = params.teacherId ? getTeacherById(params.teacherId) : null;

    return (
      <div className="teachers">
        {isWide
          ? (
            <TeachersGrid
              teachers={teachers}
              activeIds={getActiveTeacherIds()}
              showProfile={this.showProfile}
            />
          )
          : <TeachersCarousel teachers={teachers} showProfile={this.showProfile} />}

        {teacherForModal && (
          <TeacherModal
            showProfile={this.showProfile}
            teacher={teacherForModal}
          />
        )}
      </div>
    );
  }
}

Teachers.propTypes = {
  navigate: PropTypes.func.isRequired,
  params: PropTypes.shape({ teacherId: PropTypes.string }).isRequired,
};

export default withRouter(Teachers);
