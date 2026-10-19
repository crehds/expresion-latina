import PropTypes from 'prop-types';

import { Page } from '../../components';
import { CURRENT_NOTICE_VERSION } from '../../features/accounts/domain/noticeVersion';
import { CONTACT, CONTROLLER } from '../../features/accounts/domain/privacyContacts';
import {
  ATTENDANCE_CONFIRMATION_DAYS,
  DORMANT_ACCOUNT_YEARS,
  PENDING_CONSENT_DELETED_WITHIN_HOURS,
  UNCONFIRMED_EMAIL_DAYS,
} from '../../features/accounts/domain/retentionTerms';

import './css/privacy.css';

// A figure with its unit in the right number: "1 hora", "24 horas".
const amount = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const DATA_KEPT = [
  'Tu correo y tu contraseña. De la contraseña, Supabase guarda solo una versión protegida (un hash), no la contraseña tal cual.',
  'Tu nombre completo.',
  'El registro de tu consentimiento: la versión de este aviso que aceptaste y la fecha.',
  'Si ingresas con Google, la identidad de tu cuenta de Google (por ejemplo, tu correo y tu nombre).',
  'Los periodos pagados que la academia registra en tu cuenta.',
  'Tus confirmaciones de asistencia a clases.',
  'Las fechas de tus ingresos y de la renovación de tu sesión, para saber si tu cuenta sigue en uso.',
];

const PURPOSES = [
  'Administrar tu cuenta.',
  'Registrar tus pagos y el estado de tu membresía.',
  'Saber cuántas personas asisten a cada clase.',
];

const WHO_SEES = [
  'Tú ves tus propios datos.',
  'Los administradores de la academia ven el directorio de miembros (nombre y correo), los periodos pagados, el registro de consentimiento y las listas de asistentes de cada clase.',
  'Ninguna otra persona que use el sitio puede verlos. Los profesores no tienen acceso.',
];

const WHERE_KEPT = [
  'Los datos de tu cuenta se guardan en servidores de Supabase ubicados en São Paulo (Brasil).',
  'El sitio web se publica en Vercel.',
  'Si ingresas con Google, Google verifica tu identidad.',
  'Los correos de tu cuenta, como el de confirmación o el de cambio de contraseña, se envían mediante un servicio de envío de correo electrónico.',
];

// The figures come from the retention terms, which a test ties to the database.
const RETENTION = [
  `Si no se registra tu consentimiento, la cuenta se elimina en un plazo máximo de ${amount(PENDING_CONSENT_DELETED_WITHIN_HOURS, 'hora', 'horas')} desde su creación.`,
  `Si no confirmas tu correo, la cuenta se elimina después de ${amount(UNCONFIRMED_EMAIL_DAYS, 'día', 'días')}.`,
  `Después de ${amount(DORMANT_ACCOUNT_YEARS, 'año', 'años')} sin que ingreses, renueves tu sesión ni tengas pagos registrados, eliminamos la cuenta.`,
  `Las confirmaciones de asistencia se eliminan ${amount(ATTENDANCE_CONFIRMATION_DAYS, 'día', 'días')} después de la fecha de la clase.`,
  'Si eliminas tu cuenta, se borra de inmediato junto con tus pagos y tus confirmaciones de asistencia.',
];

function Section({ title, children }) {
  return (
    <section className="privacy__section">
      <h2 className="heading-sm privacy__heading">{title}</h2>
      {children}
    </section>
  );
}

Section.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function Paragraph({ children }) {
  return <p className="text-md privacy__text">{children}</p>;
}

Paragraph.propTypes = {
  children: PropTypes.string.isRequired,
};

function Bullets({ items }) {
  return (
    <ul className="text-md privacy__list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

Bullets.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
};

/**
 * The privacy notice (Design: D5, D10; Spec: Consent Record).
 *
 * It is public within the feature and static: it calls no backend and does not
 * start the session, so it reads the same for a visitor, for a member and for
 * an account whose consent is still pending (the consent gate lets this route
 * through). The consent checkbox and the consent screen link here. Its version
 * is the one a member accepts, and every retention figure it states comes from
 * the retention terms, which a test ties to the database.
 */
export default function Privacy() {
  return (
    <Page title="Aviso de privacidad" lead={`Versión ${CURRENT_NOTICE_VERSION}`} className="privacy">
      <div className="privacy__body">
        <Section title="Quién es responsable">
          <Paragraph>{`Responsable de tus datos: ${CONTROLLER}.`}</Paragraph>
          <Paragraph>{`Contacto: ${CONTACT}.`}</Paragraph>
        </Section>

        <Section title="Qué datos guardamos">
          <Paragraph>Cuando creas una cuenta y la usas, guardamos:</Paragraph>
          <Bullets items={DATA_KEPT} />
        </Section>

        <Section title="Para qué los usamos">
          <Paragraph>Usamos tus datos para:</Paragraph>
          <Bullets items={PURPOSES} />
        </Section>

        <Section title="Quién puede verlos">
          <Bullets items={WHO_SEES} />
        </Section>

        <Section title="Dónde se guardan">
          <Bullets items={WHERE_KEPT} />
        </Section>

        <Section title="Cuánto tiempo los conservamos">
          <Bullets items={RETENTION} />
        </Section>

        <Section title="Tus derechos">
          <Paragraph>{`Tienes derecho de acceso, rectificación, cancelación y oposición sobre tus datos. Para ejercerlos, escribe a ${CONTACT}.`}</Paragraph>
          <Paragraph>También puedes eliminar tu cuenta cuando quieras desde «Mi cuenta».</Paragraph>
        </Section>

        <Section title="Cambios en este aviso">
          <Paragraph>
            Si cambiamos este aviso, te pediremos que lo aceptes de nuevo cuando ingreses. Si no lo
            aceptas, eliminaremos tu cuenta.
          </Paragraph>
        </Section>
      </div>
    </Page>
  );
}
