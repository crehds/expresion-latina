import './css/reviews.css';

const src = 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?cs=srgb&dl=actitud-apariencia-atractivo-belleza-415829.jpg&fm=jpg';

function Reviews() {
  return (
    <div className="reviews">
      <textarea
        className="text-md review"
        name="review"
        id="1"
        cols="30"
        rows="5"
        value="Excelente escuela. Todos los profesores están bien capacitados, excepto un tal mishel que dice ser campeón"
        readOnly
      />

      <div className="review__random-user">
        <div className="review__random-user-image-container">
          <img
            src={src}
            className="review__random-user-image"
            alt="random-user"
          />
        </div>
        <div className="review__random-user-name text-md">
          <p>Evelyn</p>
        </div>
      </div>
    </div>
  );
}

export default Reviews;
