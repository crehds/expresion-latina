import React from "react";
import "../css/mapa.css";

export default function Mapa() {
  return (
    <div className="map-google">
      <iframe
        key="google-map"
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3902.7134444423!2d-77.06639216020983!3d-11.994319238797937!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105ce570f81ac35%3A0xc005dcfb1c6c7f78!2sAv.%20Jos%C3%A9%20Santos%20Chocano%20469%2C%20Los%20Olivos%2015301!5e0!3m2!1ses!2spe!4v1590017482307!5m2!1ses!2spe"
        maxwidth="100%"
        height="300"
        frameBorder="0"
        style={{border: 0, borderRadius: 5}}
        allowFullScreen=""
        aria-hidden="false"
        tabIndex="0"
      ></iframe>
    </div>
  );
}
