/**
 * ActionButton — button with instant loading feedback.
 * Shows BrailleSpinner immediately on click, prevents double-clicks.
 */

import { useState, useCallback } from 'react';
import BrailleSpinner from '../chat/BrailleSpinner';

interface Props {
  onClick: () => Promise<void> | void;
  label: string;
  loadingLabel?: string;
  disabled?: boolean;
  color?: string;
  variant?: 'primary' | 'outline' | 'danger';
  style?: React.CSSProperties;
}

export default function ActionButton({
  onClick, label, loadingLabel, disabled = false,
  color = 'var(--accent-teal)', variant = 'primary', style,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  }, [onClick, disabled]); // loading is checked inside, not a dep

  const isDisabled = disabled || loading;

  const baseStyle: React.CSSProperties = {
    fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
    letterSpacing: '1.5px', padding: '8px 20px', cursor: isDisabled ? 'default' : 'pointer',
    border: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px',
    transition: 'opacity 0.1s',
    ...style,
  };

  if (variant === 'primary') {
    baseStyle.background = color;
    baseStyle.color = '#ffffff';
    baseStyle.opacity = isDisabled ? 0.5 : 1;
  } else if (variant === 'outline') {
    baseStyle.background = 'transparent';
    baseStyle.color = 'var(--fg-muted)';
    baseStyle.border = '1px solid var(--border-color)';
    baseStyle.opacity = isDisabled ? 0.5 : 1;
  } else if (variant === 'danger') {
    baseStyle.background = 'transparent';
    baseStyle.color = '#ef4444';
    baseStyle.border = '1px solid var(--border-color)';
    baseStyle.opacity = isDisabled ? 0.5 : 1;
  }

  return (
    <button onClick={handleClick} disabled={isDisabled} style={baseStyle}>
      {loading && <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0, position: 'relative', top: '-2px' }}><BrailleSpinner color={variant === 'primary' ? '#ffffff' : color} /></span>}
      {loading ? (loadingLabel || label) : label}
    </button>
  );
}
