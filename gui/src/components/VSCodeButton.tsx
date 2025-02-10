import React, { ButtonHTMLAttributes } from 'react';

interface VSCodeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional variant of the button. The "primary" variant represents an active button.
   * The "secondary" variant represents an unclickable button, akin to a label.
   * If undefined, the variant is "primary" by default.
   */
  variant?: 'primary' | 'secondary';
}

export const VSCodeButton: React.FC<VSCodeButtonProps> = ({
  variant = 'primary',
  className = '',
  style,
  disabled,
  ...props
}) => {
  const baseClassName = `px-2 py-1 text-sm focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder)] rounded-sm
    ${variant === 'primary'
      ? 'bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)]'
      : 'bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)]'
    } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`;
  const mergedClassName = `${baseClassName} ${className} ${className.includes('border ')?'':'border-none'}`.trim();

  return (
    <button
      className={mergedClassName}
      style={style}
      disabled={disabled}
      title={props.title}
      {...props}
    />
  );
};
