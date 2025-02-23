import React, { useEffect, useState } from "react";

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

  const [cachedSrc, setCachedSrc] = useState<string | null>(null);

  useEffect(() => {
    const cachedImage = localStorage.getItem(src);
    if (cachedImage) {
      console.log("Using cached image");
      setCachedSrc(cachedImage);
    } else {
      fetch(src)
        .then((response) => response.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            localStorage.setItem(src, reader.result as string);
            setCachedSrc(reader.result as string);
          };
          reader.readAsDataURL(blob);
        })
        .catch((error) => {
          // console.error("Error fetching image:", error);
        });
    }
  }, [src]);

  const handleError = () => {
    setHasError(true);
    setCachedSrc(null);
  };

  return (
    <>
      {!hasError ? (
        <img
          src={cachedSrc || src}
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
