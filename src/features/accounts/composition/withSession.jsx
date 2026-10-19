import { useSession } from './SessionProvider';

const withSession = (Component) => (
  function componentWithSession(props) {
    return <Component {...props} session={useSession()} />;
  }
);

export default withSession;
