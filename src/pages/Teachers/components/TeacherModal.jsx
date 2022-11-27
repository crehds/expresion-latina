import PropTypes from 'prop-types';
import { Modal } from '../../../components';

import '../css/teacher-modal.css';

function TeacherModal(props) {
  const { showProfile, teacher } = props;
  return (
    <Modal>
      <div className="teacher-modal">
        <div className="teacher-modal__header">
          <h3 className="teacher-modal__title heading-sm">{teacher.name}</h3>
          <button
            onClick={() => showProfile()}
            onKeyDown={() => showProfile()}
            type="button"
            className="teacher-modal__button-close"
          >
            <i className="icon-x teacher-modal__icon-close" />
          </button>
        </div>
        <div className="teacher-modal__presentation">
          <div className="teacher-modal__container-image">
            <img className="teacher-modal__image" src={teacher.src} alt={teacher.name} />

          </div>
          <div className="teacher-modal__social-media">
            <button type="button" className="teacher-modal__social-media-button">
              <i className="icon-facebook2 teacher-modal__social-media-icon" />
            </button>
            <button type="button" className="teacher-modal__social-media-button">
              <i className="icon-instagram teacher-modal__social-media-icon" />
            </button>
            <button type="button" className="teacher-modal__social-media-button">
              <i className="icon-twitter teacher-modal__social-media-icon" />
            </button>
          </div>
        </div>
        <div className="teacher-modal__description text-sm">
          <p>Sin description</p>
        </div>
      </div>
    </Modal>
  );
}
TeacherModal.propTypes = {
  showProfile: PropTypes.func.isRequired,
  teacher: PropTypes.instanceOf(Object).isRequired,
};
export default TeacherModal;
