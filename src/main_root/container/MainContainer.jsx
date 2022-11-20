import PropTypes from 'prop-types';
import '../css/mainContainer.css';

export default function MainContainer(props) {
  const { children } = props;
  return <main className="main-container">{children}</main>;
}

MainContainer.propTypes = {
  children: PropTypes.element.isRequired,
};
