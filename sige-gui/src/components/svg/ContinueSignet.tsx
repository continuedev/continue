interface ContinueSignetProps {
  /** Height of the signet in pixels */
  height?: number;
  /** Width of the signet in pixels */
  width?: number;
  /** Additional CSS classes to apply to the SVG */
  className?: string;
}

/**
 * The Continue signet/logo symbol without text
 */
export default function ContinueSignet({
  height = 103,
  width = 107,
  className = "",
}: ContinueSignetProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 106.67 103.11"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="m68.65,34.69l-2.71,4.7,6.85,11.86c.05.09.08.2.08.3s-.03.21-.08.3l-6.85,11.87,2.71,4.7,9.74-16.87-9.74-16.87Zm-3.76,4.09l2.71-4.7h-5.42s-2.71,4.7-2.71,4.7h5.43Zm-5.43,1.22l6.33,10.95h5.42l-6.32-10.95h-5.43Zm5.43,23.12l6.32-10.96h-5.42l-6.33,10.96h5.43Zm-5.43,1.22l2.71,4.68h5.42s-2.71-4.68-2.71-4.68h-5.43Zm-18.37,5.84c-.11,0-.21-.03-.3-.08-.09-.05-.17-.13-.22-.22l-6.86-11.87h-5.42s9.74,16.86,9.74,16.86h19.47s-2.71-4.69-2.71-4.69h-13.69Zm14.75-.61l2.71,4.69,2.71-4.7-2.71-4.7-2.71,4.7Zm1.66-5.31h-12.64s-2.71,4.7-2.71,4.7h12.64s2.71-4.7,2.71-4.7Zm-13.7-.6l-6.33-10.96-2.71,4.7,6.33,10.96,2.71-4.7Zm-15.52-6.87h5.42s2.71-4.7,2.71-4.7h-5.41s-2.72,4.7-2.72,4.7Zm12.26-23.53c.05-.09.13-.17.22-.22.09-.05.2-.08.3-.08h13.71s2.71-4.7,2.71-4.7h-19.48l-9.74,16.87h5.42s6.84-11.86,6.84-11.86Zm-4.13,17.78l-2.71-4.7h-5.42s2.71,4.7,2.71,4.7h5.42Zm4.66-16.26l-6.32,10.95,2.71,4.7,6.32-10.95-2.71-4.7Zm13.71-.61h-12.66s2.71,4.7,2.71,4.7h12.66s-2.71-4.7-2.71-4.7Zm3.77,4.09l2.7-4.69-2.7-4.7-2.71,4.69,2.71,4.7Z"
        fill="currentColor"
      />
    </svg>
  );
}
