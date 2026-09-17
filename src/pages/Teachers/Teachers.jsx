import { Component } from 'react';

import { teachers } from '../../data';
import { TeacherModal, TeachersCarousel, TeachersGrid } from './components';

import './css/teachers.css';

const WIDE_SCREEN = '(min-width: 768px)';

class Teachers extends Component {
  constructor(props) {
    super(props);

    this.mediaQuery = window.matchMedia(WIDE_SCREEN);

    this.state = {
      teacherForModal: null,
      modalIsOpen: false,
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
    if (teacher) {
      return this.setState({
        modalIsOpen: true,
        teacherForModal: teacher,
      });
    }
    return this.setState({
      modalIsOpen: false,
    });
  };

  render() {
    const { teacherForModal, modalIsOpen, isWide } = this.state;

    return (
      <div className="teachers">
        {isWide
          ? <TeachersGrid teachers={teachers} showProfile={this.showProfile} />
          : <TeachersCarousel teachers={teachers} showProfile={this.showProfile} />}

        {modalIsOpen && (
          <TeacherModal
            showProfile={this.showProfile}
            teacher={teacherForModal}
          />
        )}
      </div>
    );
  }
}

export default Teachers;
