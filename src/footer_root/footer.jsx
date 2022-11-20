import './css/footer.css';

export default function Footer() {
  return (
    <footer className="footer-container">
      <a
        href="http://www.facebook.com/expresionlatina.peru"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="expresion-latina-facebook"
      >
        <i className="icon-facebook-square" />
      </a>
      <a
        href="http://www.instagram.com/expresionlatina.peru/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <i className="icon-instagram" />
      </a>
    </footer>
  );
}
