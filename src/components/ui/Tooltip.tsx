import React, { useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Tooltip({ text, children, disabled = false }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (disabled || !text) return <>{children}</>;

  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[1000] w-max max-w-[200px]">
          <div className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded shadow-xl border border-white/10 animate-in fade-in zoom-in-95 duration-200 text-center leading-relaxed">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}
