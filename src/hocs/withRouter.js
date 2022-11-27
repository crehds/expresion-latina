import { useLocation, useNavigate } from 'react-router-dom';

const withRouter = (Component) => (
  function componentWithRouter(props) {
    return <Component {...props} navigate={useNavigate()} location={useLocation()} />;
  }
);

export default withRouter;
