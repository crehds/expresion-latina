import { Link } from 'react-router-dom';

import { classGenres, studio } from '../../../data';

import '../css/hero.css';

/**
 * The first screen: what this place is, where it is, and the two things a
 * visitor actually came to do — read the schedule, or ask about a class.
 *
 * The genre list is read from the published schedule rather than written here,
 * so a month without Heels stops advertising Heels.
 */
function Hero() {
  const whatsappNumber = studio.whatsapp.replace(/\D/g, '');

  return (
    <section className="hero">
      <div className="hero__content">
        <p className="text-sm hero__eyebrow">
          {studio.address}
          {' · '}
          {studio.city}
        </p>

        <h1 className="heading-l hero__title">{studio.name}</h1>

        <p className="text-md hero__tagline">
          Academia de baile en Los Olivos. Salsa, bachata y estilos urbanos,
          de lunes a viernes.
        </p>

        <div className="hero__actions">
          <Link className="hero__cta hero__cta--primary" to="/schedules">
            Ver horarios
          </Link>
          <a
            className="hero__cta hero__cta--secondary"
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noreferrer"
          >
            Escríbenos por WhatsApp
          </a>
        </div>

        <ul className="hero__genres">
          {classGenres.slice(0, 8).map((genre) => (
            <li className="text-sm hero__genre" key={genre.id}>
              {genre.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Hero;
