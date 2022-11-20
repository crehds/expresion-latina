import '../css/logo.css';
import logo from '../../assets/imageseymreact/logo_negro_resize.png';

export default function Logo() {
  return (
    <div className="logo-container">
      <img src={logo} alt="logo de eyl" />
    </div>
  );
}
