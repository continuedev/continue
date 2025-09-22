import React from "react";

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

export function Avatar({
  src,
  alt = "",
  fallback = "?",
  size = "md",
  className = "",
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const sizeClass = sizeClasses[size];

  if (!src || imageError) {
    // Fallback to initials or default icon
    return (
      <div
        className={`${sizeClass} bg-accent text-accent-foreground flex items-center justify-center rounded-full text-xs font-medium ${className}`}
        title={alt}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClass} rounded-full object-cover ${className}`}
      onError={handleImageError}
    />
  );
}
