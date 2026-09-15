import { Component } from 'react';

import { teachers } from '../../data';
import { TeacherModal, TeachersCarousel } from './components';

import './css/teachers.css';

class Teachers extends Component {
  constructor(props) {
    super(props);
    // Teachers come from the bundle, so there is nothing to load: keeping them
    // in state only forced a second render with an empty first frame.
    this.state = {
      teacherForModal: null,
      modalIsOpen: false,
    };
  }

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
    const { teacherForModal, modalIsOpen } = this.state;

    return (
      <div className="teachers">
        <TeachersCarousel
          showProfile={this.showProfile}
          teachers={teachers}
        />
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
