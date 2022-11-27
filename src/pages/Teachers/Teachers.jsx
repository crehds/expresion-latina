import { Component } from 'react';
import TEACHERS from './api/teachers';
// import PropTypes from 'prop-types';
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

  // componentWillUnmount() {
  //   const { handleLoading } = this.props;
  //   handleLoading();
  // }

  // handleCarouselImagesStructure = (structure) => {
  //   this.GettingAllImageProfesors(parseInt(structure, 10));
  //   this.setState({ carouselImagesStructure: structure });
  // };

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

  // handleProfile = (event) => {
  //   const { profesors } = this.state;
  //   const element = event.target.id;
  //   const profesorId = parseInt(element.match(/\d+/)[0], 10);
  //   const profesor = profesors.find(
  //     (e) => e.idProfesor === profesorId,
  //   );
  //   this.setState({
  //     src: profesor.ruta_imageProfesor,
  //     profesor: `${profesor.nombre} ${profesor.apellido}`,
  //     idProfesor: profesor.idProfesor,
  //     genero: 'No definido',
  //   });
  //   this.showProfile();
  // };

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

// Teachers.propTypes = {
//   handleLoading: PropTypes.func.isRequired,
// };

export default Teachers;
