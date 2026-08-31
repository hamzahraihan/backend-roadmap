import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSplit, saveSplit, clampSplit } from '../../lib/split';

type Orientation = 'horizontal' | 'vertical';

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  storageKey?: string;
  defaultPct?: number;
  minPct?: number;
  maxPct?: number;
  orientation?: Orientation;
  className?: string;
  handleClassName?: string;
  leftClassName?: string;
  rightClassName?: string;
}

export default function ResizableSplit({
  left,
  right,
  storageKey,
  defaultPct = 50,
  minPct = 25,
  maxPct = 75,
  orientation = 'horizontal',
  className = '',
  leftClassName = '',
  rightClassName = '',
}: ResizableSplitProps) {
  const [pct, setPct] = useState<number>(() => {
    if (storageKey) return loadSplit(storageKey, defaultPct);
    return defaultPct;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // persist
  useEffect(() => {
    if (!storageKey) return;
    saveSplit(storageKey, pct);
  }, [pct, storageKey]);

  // mobile detection: < lg (1024px) we stack; drag disabled
  useEffect(() => {
    const m = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);

  const clamp = useCallback((v: number) => clampSplit(v, minPct, maxPct), [minPct, maxPct]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let next: number;
      if (orientation === 'horizontal') {
        next = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        next = ((e.clientY - rect.top) / rect.height) * 100;
      }
      // prevent layout thrash: rAF
      requestAnimationFrame(() => setPct(clamp(next)));
    },
    [clamp, orientation],
  );

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isMobile) return;
      e.preventDefault();
      draggingRef.current = true;
      setIsDragging(true);
      document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      // setPointerCapture if available
      const target = e.currentTarget as HTMLElement;
      if (target.setPointerCapture) {
        try {
          target.setPointerCapture(e.pointerId);
        } catch {}
      }
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [isMobile, onPointerMove, onPointerUp, orientation],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [onPointerMove, onPointerUp]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (orientation === 'horizontal') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setPct((p) => clamp(p - 5));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setPct((p) => clamp(p + 5));
        } else if (e.key === 'Home') {
          e.preventDefault();
          setPct(minPct);
        } else if (e.key === 'End') {
          e.preventDefault();
          setPct(maxPct);
        }
      } else {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setPct((p) => clamp(p - 5));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setPct((p) => clamp(p + 5));
        } else if (e.key === 'Home') {
          e.preventDefault();
          setPct(minPct);
        } else if (e.key === 'End') {
          e.preventDefault();
          setPct(maxPct);
        }
      }
    },
    [clamp, maxPct, minPct, orientation],
  );

  const onDoubleClick = useCallback(() => {
    setPct(defaultPct);
  }, [defaultPct]);

  const isHorizontal = orientation === 'horizontal';

  // styles for desktop; on mobile we stack with natural heights
  const leftStyle: React.CSSProperties | undefined = isMobile
    ? undefined
    : isHorizontal
      ? { flexBasis: `${pct}%`, minWidth: 0 }
      : { flexBasis: `${pct}%`, minHeight: 0 };

  const rightStyle: React.CSSProperties | undefined = isMobile
    ? undefined
    : isHorizontal
      ? { flexBasis: `${100 - pct}%`, minWidth: 0 }
      : { flexBasis: `${100 - pct}%`, minHeight: 0 };

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 flex-1 ${isHorizontal ? 'flex-col lg:flex-row' : 'flex-col'} ${isDragging ? 'split-dragging' : ''} ${className}`}
    >
      <div className={`min-h-0 min-w-0 ${leftClassName}`} style={leftStyle}>
        {left}
      </div>

      {/* handle — hidden on mobile, visible on lg for horizontal; always visible for vertical */}
      <div
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        aria-valuemin={minPct}
        aria-valuemax={maxPct}
        aria-valuenow={Math.round(pct)}
        tabIndex={isMobile ? -1 : 0}
        onPointerDown={onPointerDown}
        onKeyDown={handleKeyDown}
        onDoubleClick={onDoubleClick}
        title="Drag to resize • Double-click to reset • Arrow keys to nudge"
        className={`group relative shrink-0 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-0 ${
          isHorizontal ? 'hidden lg:flex lg:w-2 lg:cursor-col-resize lg:items-center lg:justify-center' : 'flex h-2 cursor-row-resize items-center justify-center'
        } bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 ${isDragging ? '!bg-sky-500/20' : ''} ${isMobile && isHorizontal ? '!hidden' : ''}`}
      >
        {/* hairline core */}
        <div
          className={`${isHorizontal ? 'h-full w-px' : 'h-px w-full'} bg-zinc-200 group-hover:bg-sky-500/30 dark:bg-zinc-700 ${isDragging ? '!bg-sky-500' : ''} transition-colors`}
        />
        {/* dots indicator */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-60 group-hover:opacity-100">
          <div className={`flex ${isHorizontal ? 'flex-col gap-0.5' : 'gap-0.5'} rounded-full bg-zinc-300 px-0.5 py-1 dark:bg-zinc-600`}>
            <span className={`block rounded-full bg-zinc-500 dark:bg-zinc-300 ${isHorizontal ? 'h-1 w-1' : 'h-1 w-1'}`} />
            <span className="block h-1 w-1 rounded-full bg-zinc-500 dark:bg-zinc-300" />
            <span className="block h-1 w-1 rounded-full bg-zinc-500 dark:bg-zinc-300" />
          </div>
        </div>
        {/* hit area expanded invisible */}
        <div className={`absolute ${isHorizontal ? 'inset-y-0 -left-1 -right-1' : 'inset-x-0 -top-1 -bottom-1'}`} aria-hidden />
      </div>

      <div className={`min-h-0 min-w-0 ${rightClassName}`} style={rightStyle}>
        {right}
      </div>
    </div>
  );
}
