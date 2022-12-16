import '../css/map.css';

function Map() {
  return (
    <div className="map">
      <div className="map__google">
        <iframe
          className="map__iframe"
          title="google-map"
          key="google-map"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1951.385443483408!2d-77.0731053239558!3d-11.9903491741745!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105cf0324c33b47%3A0x19abafda29543543!2sExpresi%C3%B3n%20Latina!5e0!3m2!1ses!2spe!4v1671234284867!5m2!1ses!2spe"
          width={600}
          height={450}
          style={{ border: 0, borderRadius: 5 }}
          allowFullScreen=""
          aria-hidden="false"
        />
      </div>
      <div className="text-sm map__direction">
        <span>Av. José Santos Chocano 469 - Los Olivos</span>
        <span>Lima - Perú</span>
      </div>
    </div>
  );
}

export default Map;
