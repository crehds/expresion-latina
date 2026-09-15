import PropTypes from 'prop-types';

import { Modal } from '../../../components';
import { getGenreById } from '../../../data';

import '../css/teacher-modal.css';

const SOCIAL_ICONS = {
  facebook: 'icon-facebook-square',
  instagram: 'icon-instagram',
  tiktok: 'icon-twitter',
};

function TeacherModal(props) {
  const { showProfile, teacher } = props;

  const genreNames = (teacher.genreIds ?? [])
    .map((id) => getGenreById(id)?.name)
    .filter(Boolean);

  // Only networks the teacher actually has. The modal used to render three
  // buttons that linked nowhere.
  const socialLinks = Object.entries(teacher.social ?? {})
    .filter(([network, url]) => url && SOCIAL_ICONS[network]);

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
            aria-label="Cerrar"
          >
            <i className="icon-x teacher-modal__icon-close" />
          </button>
        </div>
        <div className="teacher-modal__presentation">
          <div className="teacher-modal__container-image">
            {teacher.image ? (
              <img className="teacher-modal__image" src={teacher.image} alt={teacher.name} />
            ) : (
              <div className="teacher-modal__placeholder" aria-hidden="true">{teacher.initials}</div>
            )}
          </div>
          {socialLinks.length > 0 && (
            <div className="teacher-modal__social-media">
              {socialLinks.map(([network, url]) => (
                <a
                  key={network}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="teacher-modal__social-media-button"
                  aria-label={network}
                >
                  <i className={`${SOCIAL_ICONS[network]} teacher-modal__social-media-icon`} />
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="teacher-modal__description text-sm">
          {genreNames.length > 0 && (
            <p className="teacher-modal__genres">{genreNames.join(' · ')}</p>
          )}
          {teacher.bio && <p>{teacher.bio}</p>}
        </div>
      </div>
    </Modal>
  );
}

TeacherModal.propTypes = {
  showProfile: PropTypes.func.isRequired,
  teacher: PropTypes.shape({
    name: PropTypes.string.isRequired,
    image: PropTypes.string,
    initials: PropTypes.string,
    bio: PropTypes.string,
    genreIds: PropTypes.arrayOf(PropTypes.string),
    social: PropTypes.instanceOf(Object),
  }).isRequired,
};

export default TeacherModal;
