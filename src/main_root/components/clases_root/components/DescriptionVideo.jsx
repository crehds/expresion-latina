import PropTypes from 'prop-types';
import '../css/descriptionvideo.css';

export default function DescriptionVideo(props) {
  const { contentTitle, toggleContent } = props;
  return (
    <div className="description-video">
      <i
        className="icon-arrow-left3 arrow-description"
        onClick={toggleContent}
        onKeyDown={toggleContent}
        role="button"
        tabIndex={0}
        aria-label="arrow-description-video"
      />
      <h3>{contentTitle}</h3>
    </div>
  );
}

DescriptionVideo.propTypes = {
  contentTitle: PropTypes.string.isRequired,
  toggleContent: PropTypes.func.isRequired,
};
