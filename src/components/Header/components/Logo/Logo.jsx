import './css/logo.css';
import logo from '../../../../assets/images/logos/logo_negro_resize.png';

export default function Logo() {
  return (
    <div className="logo">
      <img className="logo__img" src={logo} alt="logo de eyl" />
    </div>
  );
}
