import React, { useEffect, useState } from "react";

interface SafeImg {
  src: string;
  height?: string;
  width?: string;
  className?: string;
  fallback: React.ReactNode;
}

function assertLocalhostUrl(url: URL, context?: string): void {
  const hostname = url.hostname.toLowerCase();
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost");

  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) {
    return;
  }

  if (!isLocalhost) {
    const contextSuffix = context ? ` (${context})` : "";
    throw new Error(
      `Airgapped mode: external network calls are disabled${contextSuffix}. Host "${url.hostname}" is not allowed.`,
    );
  }
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
    const resolvedUrl = new URL(src, window.location.href);
    assertLocalhostUrl(resolvedUrl, "safe-img");
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
