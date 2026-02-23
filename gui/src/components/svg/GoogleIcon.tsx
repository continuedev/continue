interface CustomGoogleIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export function GoogleIcon({
  size = 24,
  className,
  ...props
}: CustomGoogleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      {...props}
    >
      <path
        d="M21.805 10.023H12v4h5.641C16.864 16.504 14.072 18 12 18c-3.309 0-6-2.691-6-6s2.691-6 6-6c1.58 0 3.031 0.594 4.137 1.563l3.1-3.1C17.389 3.565 14.833 2 12 2 6.477 2 2 6.477 2 12s4.477 10 10 10c5.377 0 10-4.623 10-10 0-.666-.07-1.313-.195-1.977z"
        fill="currentColor"
      />
    </svg>
  );
}
