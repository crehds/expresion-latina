import { useLocation, useNavigate, useParams } from 'react-router-dom';

const withRouter = (Component) => (
  function componentWithRouter(props) {
    return (
      <Component
        {...props}
        navigate={useNavigate()}
        location={useLocation()}
        params={useParams()}
      />
    );
  }
);

export default withRouter;
