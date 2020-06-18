import React, { Component } from "react";
import "./css/inicio.css";
import Carousel from "nuka-carousel";
import posters from "../../../api/posters.json";

export default class Inico extends Component {
  componentWillUnmount() {
    this.props.handleLoading();
  }

  render() {
    return (
      <div className="inicio">
        <Carousel
          autoplay
          framePadding="0px 20px"
          defaultControlsConfig={{
            pagingDotsStyle: {
              fill: "rgba(255,194,48)",
            },
          }}
          getControlsContainerStyles={(key) => {
            switch (key) {
              case "CenterLeft":
                return {
                  position: "fixed",
                  top: "45%",
                  left: "-20px",
                };
              case "CenterRight":
                return {
                  position: "fixed",
                  top: "45%",
                  right: "-20px",
                };
              default:
                return {};
            }
          }}
          renderCenterLeftControls={({ previousSlide }) => (
            <div className="inicio-arrow">
              <i
                className="icon-keyboard_arrow_left"
                onClick={previousSlide}
              ></i>
            </div>
          )}
          renderCenterRightControls={({ nextSlide }) => (
            <div className="inicio-arrow">
              <i className="icon-keyboard_arrow_right" onClick={nextSlide}></i>
            </div>
          )}
        >
          {posters.posters.map((e) => (
            <img src={process.env.PUBLIC_URL + e.src} alt={e.description} />
          ))}
        </Carousel>
      </div>
    );
  }
}
