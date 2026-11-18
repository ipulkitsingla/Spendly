import { formatMoney } from '../utils/format.js';
import { usePrivacy } from '../context/PrivacyContext.jsx';

/**
 * @param {object} props
 * @param {number} props.value
 * @param {string} [props.className]
 * @param {string} [props.title]
 * @param {boolean} [props.hero] — Face lock / blur applies to dashboard hero balance only when using face lock without global blur
 */
export default function Money({ value, className = '', title, hero = false }) {
  const {
    amountsHidden,
    heroBalanceHidden,
    faceLock,
    credentialId,
    revealWithTap,
    revealWithBiometric,
  } = usePrivacy();
  const text = formatMoney(value);
  const hidden = hero ? heroBalanceHidden || amountsHidden : amountsHidden;

  const onActivate = async (e) => {
    e.preventDefault();
    if (!hidden) return;
    if (faceLock && credentialId) {
      await revealWithBiometric();
      return;
    }
    revealWithTap();
  };

  if (!hidden) {
    return (
      <span className={className} title={title}>
        {text}
      </span>
    );
  }

  return (
    <span
      className={`sensitive-money ${className}`.trim()}
      title={
        title ||
        (faceLock && credentialId ? 'Tap to unlock with Face ID / Touch ID' : 'Tap to show amount')
      }
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate(e);
        }
      }}
    >
      {text}
    </span>
  );
}
