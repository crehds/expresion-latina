/**
 * The form of one payment of a member, a paid period (Spec: Recording Paid
 * Periods, Correcting Paid Periods): a start and an end, both inclusive.
 *
 * With no `period` it records a new payment. It starts on the day after the
 * latest payment the member has that has not ended yet (today when there is
 * none), and leaves the end empty and required: the administrator types it or
 * presses "+1 mes" or "+1 año", which fill it from the start in the field and
 * leave it editable. With a `period` it corrects that payment, starting from its
 * own dates, with the same shortcuts.
 *
 * Before it asks anything of the backend it checks only that both dates are real
 * and that the end is not before the start (`validatePeriod`), with a message
 * per field and the focus on the first one that is wrong. The five-year limit
 * and the overlap with another payment of the member stay with the database,
 * whose refusal comes back as a result code and is shown as the fixed message of
 * that code, never what the backend said. `onSubmit` takes the two dates and
 * resolves to a result; the form stays off while it waits, and a second submit in
 * the same instant is ignored, so one press cannot record a payment twice. The
 * dates stay as they were after a failure, so they can be changed and sent again.
 */
import PropTypes from 'prop-types';
import {
  useEffect, useId, useRef, useState,
} from 'react';

import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import { isIsoDate, todayInLima } from '../../../shared/limaCalendar';
import { validatePeriod } from '../domain/periodValidation';
import { defaultStart, endAfter } from '../domain/rules';
import {
  ADD_ONE_MONTH,
  ADD_ONE_YEAR,
  CANCEL,
  CREATE_PERIOD_TITLE,
  EDIT_PERIOD_TITLE,
  END_SHORTCUTS_LABEL,
  ENDS_ON_LABEL,
  SAVE_PERIOD,
  SAVING_PERIOD,
  STARTS_ON_LABEL,
  periodFieldMessage,
  savePeriodErrorMessage,
} from './membershipCopy';

import './css/period-form.css';

const asText = (value) => (typeof value === 'string' ? value : '');

// A date from the server that is no calendar day must not break the form, so
// only the payments with a real end say where a new one starts.
function startAfter(periods) {
  const withRealEnd = periods.filter((period) => isIsoDate(period.endsOn));
  return defaultStart(withRealEnd, todayInLima(new Date()));
}

function initialValues(period, periods) {
  return period
    ? { startsOn: asText(period.startsOn), endsOn: asText(period.endsOn) }
    : { startsOn: startAfter(periods), endsOn: '' };
}

// One labelled date field. The message of a wrong field is tied to it, and the
// field is announced as required without the `required` attribute: the form
// checks the dates itself, and a native constraint would also flag an untouched
// empty field. `children` go under the field, outside its label.
function DateField({
  label, value, onChange, error = undefined, inputRef, children = undefined,
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="period-form__field">
      <label className="period-form__label" htmlFor={id}>
        {label}
        <input
          id={id}
          ref={inputRef}
          className="period-form__input"
          type="date"
          aria-required="true"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </label>
      {children}
      {error && <p id={errorId} className="period-form__error">{error}</p>}
    </div>
  );
}

DateField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  inputRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }).isRequired,
  children: PropTypes.node,
};

export default function PeriodForm({
  periods = [], period = undefined, onSubmit, onCancel,
}) {
  const titleId = useId();
  const [values, setValues] = useState(() => initialValues(period, periods));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [failureCode, setFailureCode] = useState(null);
  const startsOnRef = useRef(null);
  const endsOnRef = useRef(null);
  // Set at once by the first submit; the state above is only drawn later, so on
  // its own it would let a second submit in the same instant through.
  const submittingRef = useRef(false);

  useEffect(() => {
    startsOnRef.current?.focus();
  }, []);

  const setField = (field) => (value) => setValues((previous) => ({ ...previous, [field]: value }));

  const fillEnd = (months) => {
    if (!isIsoDate(values.startsOn)) {
      setErrors({ startsOn: validatePeriod(values).errors.startsOn });
      startsOnRef.current?.focus();
      return;
    }
    setValues((previous) => ({ ...previous, endsOn: endAfter(values.startsOn, { months }) }));
    setErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }
    const checks = validatePeriod(values);
    setErrors(checks.errors);
    setFailureCode(null);
    if (!checks.valid) {
      (checks.errors.startsOn ? startsOnRef : endsOnRef).current?.focus();
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    try {
      const result = await onSubmit({ startsOn: values.startsOn, endsOn: values.endsOn });
      if (!result.ok) {
        setFailureCode(result.code);
      }
    } catch {
      // Whatever went wrong, the form is freed and the administrator can try again.
      setFailureCode(RESULT_CODES.UNKNOWN);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form className="period-form" noValidate aria-labelledby={titleId} onSubmit={handleSubmit}>
      <h4 className="heading-xs period-form__title" id={titleId}>
        {period ? EDIT_PERIOD_TITLE : CREATE_PERIOD_TITLE}
      </h4>
      {failureCode && (
        <p className="period-form__alert" role="alert">{savePeriodErrorMessage(failureCode)}</p>
      )}
      <DateField
        label={STARTS_ON_LABEL}
        value={values.startsOn}
        onChange={setField('startsOn')}
        error={periodFieldMessage('startsOn', errors.startsOn)}
        inputRef={startsOnRef}
      />
      <DateField
        label={ENDS_ON_LABEL}
        value={values.endsOn}
        onChange={setField('endsOn')}
        error={periodFieldMessage('endsOn', errors.endsOn)}
        inputRef={endsOnRef}
      >
        <div className="period-form__shortcuts" role="group" aria-label={END_SHORTCUTS_LABEL}>
          <button type="button" className="period-form__shortcut" onClick={() => fillEnd(1)}>
            {ADD_ONE_MONTH}
          </button>
          <button type="button" className="period-form__shortcut" onClick={() => fillEnd(12)}>
            {ADD_ONE_YEAR}
          </button>
        </div>
      </DateField>
      <div className="period-form__actions">
        <button type="submit" className="period-form__button period-form__button--primary" disabled={saving}>
          {saving ? SAVING_PERIOD : SAVE_PERIOD}
        </button>
        <button type="button" className="period-form__button" disabled={saving} onClick={onCancel}>
          {CANCEL}
        </button>
      </div>
    </form>
  );
}

PeriodForm.propTypes = {
  /** The payments the member has, for the start of a new one. Unused when correcting. */
  periods: PropTypes.arrayOf(PropTypes.shape({ endsOn: PropTypes.string })),
  /** The payment to correct; without it the form records a new one. */
  period: PropTypes.shape({ startsOn: PropTypes.string, endsOn: PropTypes.string }),
  /** Takes `{ startsOn, endsOn }` and resolves to a result (`{ ok }` or `{ ok: false, code }`). */
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
