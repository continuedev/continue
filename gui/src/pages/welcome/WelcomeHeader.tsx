import React from 'react';
import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import { getMetaKeyLabel } from '@/util';
import { ArrowLeftIcon } from 'lucide-react';

interface WelcomeHeaderProps {
  onBack?: () => void;
  showBack?: boolean;
}

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ onBack, showBack = true }) => {
  if (!showBack) return null;

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
        onBack?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  return (
    <div
    onClick={onBack}
    className="absolute left-6 top-4 cursor-pointer flex items-center justify-center gap-1"
    >
        <ArrowLongRightIcon className="w-5 h-5 rotate-180" />
        <span className="text-base text-center mx-2">Back</span>
        <span className="flex items-center gap-1 text-base">
        </span>
    </div>
  );
};