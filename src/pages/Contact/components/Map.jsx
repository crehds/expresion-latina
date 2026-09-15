import { studio } from '../../../data';

import '../css/map.css';

function Map() {
  const {
    address, city, country, mapEmbedUrl, name,
  } = studio;

  return (
    <div className="map">
      <div className="map__google">
        <iframe
          className="map__iframe"
          title={`Mapa de ${name}`}
          key="google-map"
          src={mapEmbedUrl}
          width={600}
          height={450}
          style={{ border: 0, borderRadius: 5 }}
          allowFullScreen=""
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <div className="text-sm map__direction">
        <span>{address}</span>
        <span>
          {city}
          {city && country ? ' - ' : ''}
          {country}
        </span>
      </div>
    </div>
  );
}

export default Map;
