import PropTypes from 'prop-types';
import '../css/genero.css';

export default function Genero(props) {
  const { content, setGeneroRef, onClick } = props;
  return (
    <div
      id={content.name}
      ref={setGeneroRef}
      className="genero"
      onClick={onClick}
      onKeyDown={onClick}
      role="button"
      tabIndex={0}
    >
      {content.name}
    </div>
  );
}

Genero.propTypes = {
  content: PropTypes.instanceOf(Object).isRequired,
  setGeneroRef: PropTypes.func.isRequired,
  onClick: PropTypes.func.isRequired,
};
