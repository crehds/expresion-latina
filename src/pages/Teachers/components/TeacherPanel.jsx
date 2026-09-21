import { Component } from 'react';
import PropTypes from 'prop-types';

import { Modal, VideoPlayer } from '../../../components';
import { getGenreById, getVideosByTeacherId } from '../../../data';

import '../css/teacher-panel.css';

const SOCIAL_ICONS = {
  facebook: 'icon-facebook-square',
  instagram: 'icon-instagram',
  tiktok: 'icon-twitter',
};

/**
 * One teacher, in a panel that slides in from the left over the faculty.
 *
 * A panel rather than a centred box because the content is a profile — photo,
 * age, what they teach, what they have won — and that reads as a column, not
 * as a dialog. It keeps the grid visible behind it, so moving from one teacher
 * to the next does not feel like leaving the page.
 */
class TeacherPanel extends Component {
  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown);
    // The panel is fixed and scrolls itself; without this the page behind it
    // scrolls instead whenever the pointer leaves the panel.
    document.body.classList.add('has-panel');

    if (this.closeButton) this.closeButton.focus();
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.body.classList.remove('has-panel');
  }

  handleKeyDown = (event) => {
    const { onClose } = this.props;

    if (event.key === 'Escape') onClose();
  };

  render() {
    const { onClose, teacher } = this.props;

    const genreNames = (teacher.genreIds ?? [])
      .map((id) => getGenreById(id)?.name)
      .filter(Boolean);

    // Only networks the teacher actually has. This used to render three
    // buttons that linked nowhere.
    const socialLinks = Object.entries(teacher.social ?? {})
      .filter(([network, url]) => url && SOCIAL_ICONS[network]);

    const videos = getVideosByTeacherId(teacher.id);
    const achievements = teacher.achievements ?? [];

    return (
      <Modal>
        <button
          type="button"
          className="teacher-panel__scrim"
          onClick={onClose}
          aria-label="Cerrar perfil"
          tabIndex={-1}
        />

        <aside
          className="teacher-panel"
          role="dialog"
          aria-modal="true"
          aria-label={teacher.name}
        >
          <button
            ref={(node) => { this.closeButton = node; }}
            type="button"
            className="teacher-panel__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <i className="icon-x" aria-hidden="true" />
          </button>

          <div className={`teacher-panel__portrait${teacher.image ? '' : ' teacher-panel__portrait--empty'}`}>
            {teacher.image ? (
              <img className="teacher-panel__image" src={teacher.image} alt={teacher.name} />
            ) : (
              <span className="teacher-panel__initials" aria-hidden="true">{teacher.initials}</span>
            )}
          </div>

          <div className="teacher-panel__body">
            <h2 className="heading-sm teacher-panel__name">{teacher.name}</h2>

            {teacher.age !== null && teacher.age !== undefined && (
              <p className="text-sm teacher-panel__age">{`${teacher.age} años`}</p>
            )}

            {socialLinks.length > 0 && (
              <div className="teacher-panel__social">
                {socialLinks.map(([network, url]) => (
                  <a
                    key={network}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="teacher-panel__social-link"
                    aria-label={network}
                  >
                    <i className={SOCIAL_ICONS[network]} aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}

            {genreNames.length > 0 && (
              <section className="teacher-panel__section">
                <h3 className="text-sm teacher-panel__label">Enseña</h3>
                <ul className="teacher-panel__genres">
                  {genreNames.map((name) => (
                    <li className="text-sm teacher-panel__genre" key={name}>{name}</li>
                  ))}
                </ul>
              </section>
            )}

            {achievements.length > 0 && (
              <section className="teacher-panel__section">
                <h3 className="text-sm teacher-panel__label">Logros</h3>
                <ul className="teacher-panel__achievements">
                  {achievements.map(({ title, year }) => (
                    <li className="text-md teacher-panel__achievement" key={`${title}-${year ?? ''}`}>
                      <span>{title}</span>
                      {year && <span className="teacher-panel__year">{year}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {teacher.bio && (
              <section className="teacher-panel__section">
                <h3 className="text-sm teacher-panel__label">Sobre</h3>
                <p className="text-md teacher-panel__bio">{teacher.bio}</p>
              </section>
            )}

            {videos.length > 0 && (
              <section className="teacher-panel__section">
                <h3 className="text-sm teacher-panel__label">Video</h3>
                {videos.map((video) => (
                  <VideoPlayer key={video.id} src={video.src} title={video.title} />
                ))}
              </section>
            )}
          </div>
        </aside>
      </Modal>
    );
  }
}

TeacherPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
  teacher: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    image: PropTypes.string,
    initials: PropTypes.string,
    age: PropTypes.number,
    bio: PropTypes.string,
    genreIds: PropTypes.arrayOf(PropTypes.string),
    achievements: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string.isRequired,
      year: PropTypes.number,
    })),
    social: PropTypes.instanceOf(Object),
  }).isRequired,
};

export default TeacherPanel;
