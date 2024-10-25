import React from "react";

export const Button = ({
  onClick,
  children,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => {
  return (
    <button className="btn btn-primary" onClick={onClick}>
      {children}
    </button>
  );
};
