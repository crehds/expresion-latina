import PropTypes from 'prop-types';
import Genero from './Genero';
import '../css/generos.css';

export default function Generos(props) {
  const { generos, toggleContent, setGeneroRef } = props;
  return (
    <div className="generos">
      {generos.length > 0
          && generos.map((genero) => (
            <Genero
              key={genero.id}
              content={genero}
              onClick={toggleContent}
              setGeneroRef={setGeneroRef}
            />
          ))}
    </div>
  );
}

Generos.propTypes = {
  generos: PropTypes.instanceOf(Array).isRequired,
  toggleContent: PropTypes.func.isRequired,
  setGeneroRef: PropTypes.func.isRequired,
};
