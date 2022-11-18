import { Component } from 'react';
import PropTypes from 'prop-types';
import './css/inicio.css';
import Carousel from 'nuka-carousel';
import PageLoading from '../../../loading_root/PageLoading';

export default class Inicio extends Component {
  constructor(props) {
    super(props);
    this.state = {
      slideIndex: 0,
      postersReady: false,
      posters: [],
    };
  }

  componentDidMount() {
    const { getFunction } = this.props;
    this.getPosters();
    getFunction(this.getPosters);
  }

  componentWillUnmount() {
    const { handleLoading } = this.props;
    handleLoading();
  }

  getPosters = async () => {
    const { setGlobalProps } = this.props;
    const posters = await fetch('/inicio').then((result) => result.json());
    setGlobalProps(posters);
    return this.setState({ posters, postersReady: true });
  };

  render() {
    const { postersReady, posters, slideIndex } = this.state;
    let timer;
    if (postersReady === false) {
      return <PageLoading />;
    }
    const { data } = posters;
    return (
      <div className="inicio">
        <Carousel
          autoplay
          slideIndex={slideIndex}
          beforeSlide={() => {
            clearTimeout(timer);
          }}
          afterSlide={(sIndex) => {
            if (sIndex === posters.length - 1) {
              timer = setTimeout(() => this.setState({ slideIndex: 0 }), 5000);
            } else {
              this.setState({ slideIndex: sIndex });
            }
          }}
          // framePadding="0px 20px"
          defaultControlsConfig={{
            pagingDotsStyle: {
              fill: 'rgba(95, 209, 249, 1)',
              padding: '0px 20px',
            },
          }}
          // getControlsContainerStyles={(key) => {
          //   switch (key) {
          //     case 'CenterLeft':
          //       return {
          //         position: 'fixed',
          //         top: '50%',
          //         left: '-19px',
          //       };
          //     case 'CenterRight':
          //       return {
          //         position: 'fixed',
          //         top: '50%',
          //         right: '-19px',
          //       };
          //     default:
          //       return {};
          //   }
          // }}
          renderCenterLeftControls={({ previousSlide }) => (
            <div className="inicio-arrow">
              <i
                className="icon-keyboard_arrow_left"
                onClick={previousSlide}
                onKeyDown={previousSlide}
                role="button"
                tabIndex={0}
                aria-label="arrow-left-icon"
              />
            </div>
          )}
          renderCenterRightControls={({ nextSlide }) => (
            <div className="inicio-arrow">
              <i
                className="icon-keyboard_arrow_right"
                onClick={nextSlide}
                onKeyDown={nextSlide}
                role="button"
                tabIndex={0}
                aria-label="arrow-right-icon"
              />
            </div>
          )}
        >
          {data.map((e) => (
            <img
              key={`img-inicio-${e.id}`}
              src={`data:${e.contentType};base64,${e.img}`}
              alt={e.description}
            />
          ))}
        </Carousel>
      </div>
    );
  }
}

Inicio.propTypes = {
  getFunction: PropTypes.func.isRequired,
  handleLoading: PropTypes.func.isRequired,
  setGlobalProps: PropTypes.func.isRequired,
};
