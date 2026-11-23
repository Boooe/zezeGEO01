import { useEffect, useMemo, useRef } from 'react';
import { Skeleton } from '@client/src/components/ui/skeleton';
import type { IndustryNewsItem } from '@shared/api.interface';

interface IndustryNewsMarqueeProps {
  items: IndustryNewsItem[] | undefined;
  isLoading?: boolean;
}

const ROW_HEIGHT = 52;
const VISIBLE_COUNT = 5;
const VIEW_HEIGHT = ROW_HEIGHT * VISIBLE_COUNT;
const SCROLL_SPEED = 30;

const IndustryNewsMarquee: React.FC<IndustryNewsMarqueeProps> = ({ items, isLoading }) => {
  const baseCount = items?.length ?? 0;
  const shouldLoop = baseCount >= VISIBLE_COUNT;
  const trackRef = useRef<HTMLUListElement>(null);
  const pausedRef = useRef<boolean>(false);

  const loopItems = useMemo(() => {
    if (!items?.length) return [];
    const base = items.slice();
    if (!shouldLoop) return base;
    return [...base, ...base];
  }, [items, shouldLoop]);

  const scrollDistance = shouldLoop ? baseCount * ROW_HEIGHT : 0;

  useEffect(() => {
    if (!shouldLoop || !trackRef.current) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    let offset = 0;
    let last = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current) {
        offset = (offset + SCROLL_SPEED * dt) % scrollDistance;
        trackRef.current!.style.transform = `translate3d(0, ${-offset}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    pausedRef.current = false;
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [shouldLoop, scrollDistance]);

  const handleMouseEnter = () => { pausedRef.current = true; };
  const handleMouseLeave = () => { pausedRef.current = false; };
  const handleTouchStart = () => { pausedRef.current = true; };
  const handleTouchEnd = () => { pausedRef.current = false; };

  if (isLoading) {
    return (
      <div className="dashboard-card flex h-full flex-col p-5">
        <div className="mb-3 flex items-center">
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: VISIBLE_COUNT }).map((_: unknown, i: number) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="dashboard-card flex h-full items-center justify-center px-5 text-sm" style={{ color: '#94A3B8' }}>
        暂无行业资讯
      </div>
    );
  }

  return (
    <div className="dashboard-card relative flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5" style={{ height: 40, minHeight: 40 }}>
        <h3 className="text-[15px] font-semibold" style={{ color: '#101828' }}>
          行业观察
        </h3>
        <span className="text-[12px]" style={{ color: '#98A2B3' }}>实时更新</span>
      </div>

      <div
        className="news-viewport relative overflow-hidden px-5 pt-2"
        style={{ height: VIEW_HEIGHT }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="pointer-events-none absolute left-5 right-5 top-0 z-10 h-8"
          style={{
            background: 'linear-gradient(to bottom, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-5 right-5 z-10 h-8"
          style={{
            background: 'linear-gradient(to top, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
          }}
        />

        <ul
          ref={trackRef}
          className="news-track"
          style={{ willChange: 'transform' }}
        >
          {loopItems.map((item: IndustryNewsItem, idx: number) => (
            <li
              key={`${item.id ?? item.newsDate}-${idx}`}
              className="news-row flex items-center gap-3"
              style={{ height: ROW_HEIGHT }}
            >
              <span className="shrink-0 text-[12px] tabular-nums" style={{ color: '#98A2B3', width: 84, minWidth: 84 }}>
                {item.newsDate}
              </span>
              <span className="flex-1 truncate text-[13px]" style={{ color: '#101828' }}>
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <style>{`
        .news-row {
          border-bottom: 1px solid #F0F4FA;
          cursor: default;
        }
        .news-row:last-child {
          border-bottom: none;
        }
        .news-track {
          margin: 0;
          padding: 0;
          list-style: none;
        }
      `}</style>
    </div>
  );
};

export default IndustryNewsMarquee;
