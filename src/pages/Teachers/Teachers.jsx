import { Component } from 'react';
import TEACHERS from './api/teachers';
import { TeacherModal, TeachersCarousel } from './components';

import './css/teachers.css';

class Teachers extends Component {
  constructor(props) {
    super(props);
    this.state = {
      teacherForModal: {},
      modalIsOpen: false,
      teachers: [],
    };
  }

  componentDidMount() {
    return this.setState({ teachers: TEACHERS });
  }

  showProfile = (teacher) => {
    if (teacher) {
      return this.setState({
        modalIsOpen: true,
        teacherForModal: { ...teacher },
      });
    }
    return this.setState({
      modalIsOpen: false,
    });
  };

  render() {
    const {
      teacherForModal,
      teachers,
      modalIsOpen,
    } = this.state;

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
