import React, { useState } from "react";

interface SafeImg {
  src: string;
  height?: string;
  width?: string;
  className?: string;
  fallback: React.ReactNode;
}

const SafeImg: React.FC<SafeImg> = ({
  src,
  height,
  width,
  className,
  fallback,
}) => {
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
  };

  return (
    <>
      {!hasError ? (
        <img
          src={src}
          height={height}
          width={width}
          className={className}
          onError={handleError}
        />
      ) : (
        fallback
      )}
    </>
  );
};

export default SafeImg;
