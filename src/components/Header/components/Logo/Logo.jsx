import './css/logo.css';
// The white wordmark, not the black one: the header band is the darkest
// surface on the site, and logo_negro disappeared into it completely.
import logo from '../../../../assets/images/logos/logo.png';

export default function Logo() {
  return (
    <div className="logo">
      <img className="logo__img" src={logo} alt="logo de eyl" />
    </div>
  );
}
