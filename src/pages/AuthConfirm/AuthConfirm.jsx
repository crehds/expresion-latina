import { useContext, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Page } from '../../components';
import BackendContext from '../../shared/backend/BackendContext';
import { RESULT_CODES } from '../../shared/backend/resultCodes';
import { useSession } from '../../features/accounts/composition/SessionProvider';
import NewPassword from '../../features/accounts/ui/NewPassword';
import ResendConfirmation from '../../features/accounts/ui/ResendConfirmation';
import { authErrorMessage } from '../../features/accounts/ui/authCopy';
import startSession from '../../features/accounts/ui/startSession';

import './css/auth-confirm.css';

// The only two links the page opens: the confirmation of a new account and the
// password recovery. Anything else, such as an invite or a magic link, is not a
// link this app sends, so a crafted address for one is treated as no link at all.
const LINK_COPY = {
  email: {
    title: 'Confirmar correo',
    lead: 'Confirma tu correo para activar tu cuenta.',
    button: 'Confirmar mi correo',
  },
  recovery: {
    title: 'Restablecer contraseña',
    lead: 'Continúa para elegir una nueva contraseña.',
    button: 'Continuar',
  },
};

const INVALID_LINK = 'El enlace no es válido.';

// The link from the query, or null. Every other parameter is ignored: nothing in
// the address decides where the member goes next.
function readLink(search) {
  const params = new URLSearchParams(search);
  const type = params.get('type');
  const tokenHash = params.get('token_hash');
  const accepted = type !== null && Object.hasOwn(LINK_COPY, type);
  return accepted && tokenHash !== null && tokenHash.trim() !== '' ? { tokenHash, type } : null;
}

/**
 * Where the link of a confirmation or recovery email lands (Design: D5, D10).
 *
 * The page does NOT verify the link when it opens: mail programs and link
 * scanners open addresses on their own, and the token is single use, so
 * verifying on load would let a scanner spend it before the member does. The
 * member presses one button instead, and the token is verified once.
 *
 * - confirmation: once verified the member is signed in and goes to the home
 *   page. An expired or used link offers a new confirmation email.
 * - recovery: once verified the member is signed in with a recovery session, and
 *   the new-password form takes the place of the button. An expired or used
 *   link points to the page that asks for a new one.
 *
 * Failed calls show the fixed message of their result code, never what the
 * backend said.
 */
export default function AuthConfirm() {
  const { services } = useContext(BackendContext);
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const link = readLink(searchParams.toString());

  const [phase, setPhase] = useState('ready');
  const [errorCode, setErrorCode] = useState(null);
  // Set at the first press and kept until the call fails in a way that spent
  // nothing, so a double click or a repeated event sends the token once.
  const pressedRef = useRef(false);

  const auth = services?.auth;
  if (!auth) {
    return null;
  }

  if (!link) {
    return (
      <Page title="Enlace no válido" className="auth-confirm">
        <p className="text-md auth-confirm__message" role="alert">{INVALID_LINK}</p>
        <Link className="auth-confirm__link" to="/login">Ir a ingresar</Link>
      </Page>
    );
  }

  const copy = LINK_COPY[link.type];

  const verify = async () => {
    if (pressedRef.current) {
      return;
    }
    pressedRef.current = true;
    setErrorCode(null);
    setPhase('verifying');

    let result;
    try {
      result = await auth.verifyEmailLink(link);
    } catch {
      result = { ok: false, code: RESULT_CODES.UNKNOWN };
    }

    if (!result.ok) {
      if (result.code === RESULT_CODES.LINK_EXPIRED) {
        setErrorCode(result.code);
        setPhase('expired');
      } else {
        // Nothing was spent, so the member may press again.
        pressedRef.current = false;
        setErrorCode(result.code);
        setPhase('ready');
      }
      return;
    }

    // The link was good and supabase-js holds the session; a rejected start is
    // retried once and otherwise left for the next page load (see startSession).
    await startSession(session);
    if (link.type === 'email') {
      navigate('/', { replace: true });
    } else {
      setPhase('password');
    }
  };

  if (phase === 'password' || phase === 'done') {
    return (
      <Page title="Nueva contraseña" className="auth-confirm">
        {phase === 'password' ? (
          <div className="auth-confirm__panel">
            <NewPassword onDone={() => setPhase('done')} />
          </div>
        ) : (
          <>
            <p className="text-md auth-confirm__message" role="status">
              Tu contraseña se actualizó.
            </p>
            <Link className="auth-confirm__link" to="/">Ir al inicio</Link>
          </>
        )}
      </Page>
    );
  }

  if (phase === 'expired') {
    return (
      <Page title={copy.title} className="auth-confirm">
        <p className="text-md auth-confirm__message" role="alert">
          {authErrorMessage(errorCode)}
        </p>
        {link.type === 'email' ? (
          <div className="auth-confirm__panel">
            <ResendConfirmation />
          </div>
        ) : (
          <Link className="auth-confirm__link" to="/login" state={{ forgotPassword: true }}>
            Pedir un enlace nuevo
          </Link>
        )}
      </Page>
    );
  }

  return (
    <Page title={copy.title} lead={copy.lead} className="auth-confirm">
      {errorCode && (
        <p className="text-md auth-confirm__message" role="alert">{authErrorMessage(errorCode)}</p>
      )}
      <button
        type="button"
        className="auth-confirm__button"
        disabled={phase === 'verifying'}
        onClick={verify}
      >
        {copy.button}
      </button>
    </Page>
  );
}
