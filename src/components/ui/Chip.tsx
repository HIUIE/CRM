import React from 'react';

export default function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral' }) {
  return (
    <span className={`chip-base ${tone === 'success' ? 'chip-success' : tone === 'warning' ? 'chip-warning' : tone === 'error' ? 'chip-error' : tone === 'info' ? 'chip-info' : 'chip-neutral'}`}>
      {children}
    </span>
  );
}
