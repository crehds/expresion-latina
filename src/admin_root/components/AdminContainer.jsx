import PropTypes from 'prop-types';

export default function AdminContainer({ children }) {
  return <div className="admin-modal_container">{children}</div>;
}

AdminContainer.propTypes = {
  children: PropTypes.element.isRequired,
};
