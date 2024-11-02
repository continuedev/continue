import React, { useEffect, useState } from 'react';

interface DelayedMessageProps {
  message: string;
  delay: number;
}

export const DelayedMessage: React.FC<DelayedMessageProps> = ({ message, delay }) => {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMessage(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <p 
      className={`text-sm text-muted-foreground italic mt-2 transition-opacity duration-3000 ease-in-out ${
        showMessage ? 'opacity-100' : 'hidden opacity-0'
      }`}
    >
      {message}
    </p>
  );
};

export default DelayedMessage;
