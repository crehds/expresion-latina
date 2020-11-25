import React, { PureComponent } from "react";
import "../css/profesor.css";
import logoDefault from "../../../../assets/imageseymreact/logoEL.png";
export default class Profesor extends PureComponent {
  state = {
    isLoaded: false,
  };

  handleLoad = () => {
    const img = document.getElementById(`prof-image-${this.props.id}`);
    img.addEventListener("load", this.setSrc, false);
  };

  setSrc = (event) => {
    let elementImg = event.target;
    elementImg.src = this.props.src;
    elementImg.removeEventListener("load", this.setSrc, false);
  };

  componentDidMount() {
    this.handleLoad();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.src !== this.props.src) {
      this.handleLoad();
    }
  }

  render() {
    const { handleProfile, id, profesor } = this.props;
    return (
      <div
        id={`prof-${id}`}
        className="div-profesor"
        onClick={handleProfile}
        key={id}
      >
        <img
          id={`prof-image-${id}`}
          alt={profesor}
          src={logoDefault}
          style={{
            backgroundImage:
              "linear-gradient(110.3deg,rgba(72, 85, 99, 1) 8.8%,rgba(127, 146, 166, 1) 95.1%",
          }}
        />
      </div>
    );
  }
}
