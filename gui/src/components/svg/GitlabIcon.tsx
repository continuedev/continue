interface CustomGitlabIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export function GitlabIcon({
  size = 24,
  className,
  ...props
}: CustomGitlabIconProps) {
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
        d="M22.363 14.565l-2.555-7.876A.684.684 0 0019.151 6a.684.684 0 00-.657.488l-2.555 7.878H7.935l-2.556-7.878A.684.684 0 004.722 6a.684.684 0 00-.657.488L1.51 14.564a.679.679 0 00.255.754l9.555 6.947a.686.686 0 00.79 0l9.555-6.947a.681.681 0 00.255-.754z"
        fill="currentColor"
      />
    </svg>
  );
}
