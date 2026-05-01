import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Tooltip({ text, children, disabled = false }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, position: 'top' as 'top' | 'bottom' });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 动态计算坐标逻辑
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      
      let position: 'top' | 'bottom' = 'top';
      let top = rect.top + scrollY - 8; // 默认上方间距

      // 边缘检测：如果距离视口顶部不足 60px，则翻转到下方
      if (rect.top < 60) {
        position = 'bottom';
        top = rect.bottom + scrollY + 8;
      }

      setCoords({
        top,
        left: rect.left + scrollX + rect.width / 2,
        position
      });
    }
  };

  useLayoutEffect(() => {
    if (isVisible) {
      updatePosition();
      // 处理滚动和窗口大小变化时的重新定位
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);

  if (disabled || !text) return <>{children}</>;

  return (
    <div 
      ref={triggerRef}
      className="inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && createPortal(
        <div 
          ref={tooltipRef}
          style={{ 
            top: `${coords.top}px`, 
            left: `${coords.left}px`,
            transform: coords.position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 9999 
          }}
          className={`fixed pointer-events-none w-max max-w-[240px] animate-in fade-in zoom-in-95 duration-200`}
        >
          <div className="relative rounded-lg border border-white/10 bg-slate-900/95 px-3.5 py-2 text-center text-[10px] font-bold leading-relaxed tracking-tight text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-md dark:bg-navy-800/95">
            {text}
            {/* 三角形指示器 */}
            <div 
              className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent 
                ${coords.position === 'top' 
                  ? 'top-full border-t-slate-900/95 dark:border-t-navy-800/95' 
                  : 'bottom-full border-b-slate-900/95 dark:border-b-navy-800/95'
                }`} 
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
