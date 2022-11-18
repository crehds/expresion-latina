import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import '../css/videos.css';
import Video from './Video';
import DescriptionVideo from './DescriptionVideo';

function setHeightContainer() {
  const videosContainer = document.getElementById('videos-container');
  const height = window.innerHeight;

  const vh = window.innerHeight * 0.01;
  if (height >= 920) {
    videosContainer.style.height = `${vh * 70}px`;
    videosContainer.style.gridTemplateRows = '220px 220px';
    videosContainer.style.gridAutoRows = '220px';
  } else if (height >= 740) {
    videosContainer.style.height = `${vh * 62}px`;
    videosContainer.style.gridTemplateRows = '210px 210px';
    videosContainer.style.gridAutoRows = '210px';
  } else if (height >= 640) {
    videosContainer.style.height = `${vh * 58.5}px`;
    videosContainer.style.gridTemplateRows = '190px 190px';
    videosContainer.style.gridAutoRows = '190px';
  } else {
    videosContainer.style.height = `${vh * 57}px`;
    videosContainer.style.gridTemplateRows = '170px 170px';
    videosContainer.style.gridAutoRows = '170px';
  }
}

export default class Videos extends PureComponent {
  componentDidMount() {
    const { cleanRef } = this.props;
    cleanRef();
    setHeightContainer();
  }

  render() {
    const { videos, toggleContent, contentTitle } = this.props;
    return (
      <div className="videos">
        <DescriptionVideo
          toggleContent={toggleContent}
          contentTitle={contentTitle}
        />
        <div id="videos-container" className="videos-container">
          {videos.map((video) => (
            <Video key={`video-${video.id}`} src={video.src} />
          ))}
        </div>
      </div>
    );
  }
}

Videos.propTypes = {
  cleanRef: PropTypes.func.isRequired,
  videos: PropTypes.instanceOf(Array).isRequired,
  contentTitle: PropTypes.string.isRequired,
  toggleContent: PropTypes.func.isRequired,
};
