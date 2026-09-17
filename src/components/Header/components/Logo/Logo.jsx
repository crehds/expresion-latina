import './css/logo.css';
/*
 * The academy's Instagram avatar. The logo files already in the repo carry a
 * large transparent margin, so at any height that fits the bar the mark itself
 * came out tiny; this one is cropped to the wordmark and fills its box.
 *
 * The source is white on solid black; the black is keyed out to alpha here so
 * the mark sits on any dark surface rather than only on a pure black bar.
 */
import logo from '../../../../assets/images/logos/wordmark.png';

export default function Logo() {
  return <img className="logo__img" src={logo} alt="Expresión Latina" />;
}
