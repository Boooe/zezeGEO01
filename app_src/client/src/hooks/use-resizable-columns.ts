import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_WIDTH = 64;
const MAX_WIDTH = 480;
const STORAGE_PREFIX = 'geo:table:cols';

function getStorageKey(tableKey: string, userId: string): string {
  return `${STORAGE_PREFIX}:${tableKey}:${userId}`;
}

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

interface UseResizableColumnsOptions {
  tableKey: string;
  defaultWidths: Record<string, number>;
  userId?: string;
  defaultVersion?: number;
  fillContainer?: boolean;
}

interface UseResizableColumnsReturn {
  colWidths: Record<string, number>;
  getThStyle: (colKey: string) => React.CSSProperties;
  getTdStyle: (colKey: string) => React.CSSProperties;
  getTableStyle: () => React.CSSProperties;
  handleResizeStart: (colKey: string, e: React.PointerEvent) => void;
  resetColumn: (colKey: string) => void;
  resetAll: () => void;
  isResizing: boolean;
}

export function useResizableColumns({
  tableKey,
  defaultWidths,
  userId = 'guest',
  defaultVersion = 1,
  fillContainer = false,
}: UseResizableColumnsOptions): UseResizableColumnsReturn {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(tableKey, userId));
      if (stored) {
        const data = JSON.parse(stored) as {
          version?: number;
          widths: Record<string, number>;
        };
        if (data.version === defaultVersion && data.widths) {
          return { ...defaultWidths, ...data.widths };
        }
      }
    } catch {
      // ignore parse errors
    }
    return { ...defaultWidths };
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeStateRef = useRef<{
    colKey: string;
    startX: number;
    startWidth: number;
    rafId: number | null;
    pendingWidth: number;
  } | null>(null);

  const persistWidths = useCallback(
    (widths: Record<string, number>) => {
      try {
        localStorage.setItem(
          getStorageKey(tableKey, userId),
          JSON.stringify({ version: defaultVersion, widths }),
        );
      } catch {
        // ignore storage errors
      }
    },
    [tableKey, userId, defaultVersion],
  );

  const handleResizeStart = useCallback(
    (colKey: string, e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = colWidths[colKey] ?? defaultWidths[colKey] ?? 100;

      resizeStateRef.current = {
        colKey,
        startX,
        startWidth,
        rafId: null,
        pendingWidth: startWidth,
      };

      setIsResizing(true);
      document.body.classList.add('col-resizing');

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!resizeStateRef.current) return;
        const state = resizeStateRef.current;
        const delta = moveEvent.clientX - state.startX;
        const newWidth = clampWidth(state.startWidth + delta);
        state.pendingWidth = newWidth;

        if (state.rafId === null) {
          state.rafId = requestAnimationFrame(() => {
            if (!resizeStateRef.current) return;
            const w = resizeStateRef.current.pendingWidth;
            const key = resizeStateRef.current.colKey;
            setColWidths((prev) => ({ ...prev, [key]: w }));
            resizeStateRef.current!.rafId = null;
          });
        }
      };

      const onPointerUp = () => {
        if (resizeStateRef.current?.rafId !== null && resizeStateRef.current?.rafId !== undefined) {
          cancelAnimationFrame(resizeStateRef.current.rafId);
        }
        // Flush final width
        if (resizeStateRef.current) {
          const finalWidth = resizeStateRef.current.pendingWidth;
          const key = resizeStateRef.current.colKey;
          setColWidths((prev) => {
            const next = { ...prev, [key]: finalWidth };
            persistWidths(next);
            return next;
          });
        }
        resizeStateRef.current = null;
        setIsResizing(false);
        document.body.classList.remove('col-resizing');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    },
    [colWidths, defaultWidths, persistWidths],
  );

  const resetColumn = useCallback(
    (colKey: string) => {
      setColWidths((prev) => {
        const next = { ...prev, [colKey]: defaultWidths[colKey] ?? prev[colKey] };
        persistWidths(next);
        return next;
      });
    },
    [defaultWidths, persistWidths],
  );

  const resetAll = useCallback(() => {
    try {
      localStorage.removeItem(getStorageKey(tableKey, userId));
    } catch {
      // ignore
    }
    setColWidths({ ...defaultWidths });
  }, [tableKey, userId, defaultWidths]);

  const getThStyle = useCallback(
    (colKey: string): React.CSSProperties => {
      const w = colWidths[colKey] ?? defaultWidths[colKey];
      return {
        width: `${w}px`,
        minWidth: `${w}px`,
        maxWidth: `${w}px`,
      };
    },
    [colWidths, defaultWidths],
  );

  const getTdStyle = useCallback(
    (colKey: string): React.CSSProperties => {
      const w = colWidths[colKey] ?? defaultWidths[colKey];
      return {
        width: `${w}px`,
        minWidth: `${w}px`,
        maxWidth: `${w}px`,
      };
    },
    [colWidths, defaultWidths],
  );

  const getTableStyle = useCallback((): React.CSSProperties => {
    const total = Object.values(colWidths).reduce((sum, w) => sum + w, 0);
    return fillContainer
      ? { width: `${total}px`, minWidth: '100%' }
      : { width: `${total}px`, maxWidth: '100%' };
  }, [colWidths, fillContainer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resizeStateRef.current?.rafId) {
        cancelAnimationFrame(resizeStateRef.current.rafId);
      }
      document.body.classList.remove('col-resizing');
    };
  }, []);

  return {
    colWidths,
    getThStyle,
    getTdStyle,
    getTableStyle,
    handleResizeStart,
    resetColumn,
    resetAll,
    isResizing,
  };
}
