import React, { Component } from 'react';
import './css/inicio.css';
import Carousel from 'nuka-carousel';
import PageLoading from '../../../loading_root/PageLoading';
export default class Inico extends Component {
  state = {
    slideIndex: 0,
    postersReady: false,
    posters: []
  };
  componentWillUnmount() {
    this.props.handleLoading();
  }

  getPosters = async () => {
    const posters = await fetch('/inicio').then((result) => result.json());
    console.log(posters);
    this.props.setGlobalProps(posters);
    return this.setState({ posters, postersReady: true });
  };

  componentDidMount() {
    this.getPosters();
    this.props.getFunction(this.getPosters);
  }

  render() {
    let timer;
    if (this.state.postersReady === false) {
      return <PageLoading />;
    }
    const { data: posters } = this.state.posters;
    return (
      <div className='inicio'>
        <Carousel
          autoplay
          slideIndex={this.state.slideIndex}
          beforeSlide={() => {
            clearTimeout(timer);
          }}
          afterSlide={(slideIndex) => {
            if (slideIndex === posters.length - 1) {
              timer = setTimeout(() => this.setState({ slideIndex: 0 }), 5000);
            } else {
              this.setState({ slideIndex });
            }
          }}
          framePadding='0px 20px'
          defaultControlsConfig={{
            pagingDotsStyle: {
              fill: 'rgba(95, 209, 249, 1)'
            }
          }}
          getControlsContainerStyles={(key) => {
            switch (key) {
              case 'CenterLeft':
                return {
                  position: 'fixed',
                  top: '50%',
                  left: '-19px'
                };
              case 'CenterRight':
                return {
                  position: 'fixed',
                  top: '50%',
                  right: '-19px'
                };
              default:
                return {};
            }
          }}
          renderCenterLeftControls={({ previousSlide }) => (
            <div className='inicio-arrow'>
              <i
                className='icon-keyboard_arrow_left'
                onClick={previousSlide}
              ></i>
            </div>
          )}
          renderCenterRightControls={({ nextSlide }) => (
            <div className='inicio-arrow'>
              <i className='icon-keyboard_arrow_right' onClick={nextSlide}></i>
            </div>
          )}
        >
          {posters.map((e, i) => (
            <img
              key={`img-inicio-${i}`}
              src={`data:${e.contentType};base64,${e.img}`}
              alt={e.description}
            />
          ))}
        </Carousel>
      </div>
    );
  }
}
