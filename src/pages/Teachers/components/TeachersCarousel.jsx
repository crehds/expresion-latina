import { Component } from 'react';
import PropTypes from 'prop-types';
import Teacher from './Teacher';

import '../css/teachers-carousel.css';
import TeachersControls from './TeachersControls';

const MAX_TEACHER_PER_SLIDE = 4;

export default class TeachersCarousel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      carouselId: 0,
    };
  }

  handleTeachersCarousel = (direction) => {
    const { teachers } = this.props;
    const { carouselId } = this.state;

    if (direction === 'left') {
      if (carouselId === 0) {
        const tmp = (teachers.length % MAX_TEACHER_PER_SLIDE) || MAX_TEACHER_PER_SLIDE;
        return this.setState({
          carouselId: teachers.length - tmp,
        });
      }
      return this.setState({
        carouselId: carouselId - MAX_TEACHER_PER_SLIDE,
      });
    }
    if (teachers.length - carouselId > MAX_TEACHER_PER_SLIDE) {
      return this.setState({
        carouselId: carouselId + MAX_TEACHER_PER_SLIDE,
      });
    }
    return this.setState({
      carouselId: 0,
    });
  };

  render() {
    const { carouselId } = this.state;
    const { teachers, showProfile } = this.props;

    const teachersPerSlide = carouselId + MAX_TEACHER_PER_SLIDE;
    const teachersSlide = teachers.slice(carouselId, teachersPerSlide);
    const slideLength = teachersSlide.length;

    return (
      <div className={`teachers-carousel teachers-carousel--${slideLength}`}>
        {teachersSlide.map((teacher) => (
          <Teacher
            key={teacher.id}
            showProfile={showProfile}
            teacher={teacher}
          />
        ))}
        <TeachersControls handleTeachersCarousel={this.handleTeachersCarousel} />
      </div>

    );
  }
}

TeachersCarousel.propTypes = {
  showProfile: PropTypes.func.isRequired,
  teachers: PropTypes.instanceOf(Array).isRequired,
};
