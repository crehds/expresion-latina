import './css/footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <a
        className="footer__social-media"
        href="http://www.facebook.com/expresionlatina.peru"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="expresion-latina-facebook"
      >
        <i className="icon-facebook-square footer__social-media-icon" />
      </a>
      <a
        className="footer__social-media"
        href="http://www.instagram.com/expresionlatina.peru/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <i className="icon-instagram footer__social-media-icon" />
      </a>
    </footer>
  );
}
