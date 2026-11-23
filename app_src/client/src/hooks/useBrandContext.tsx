import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrands } from '@client/src/api/brands';
import type { BrandOption } from '@client/src/api/brands';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'geo_selected_brand_id_v2';

const TEST_BRAND_PATTERNS = ['E2E', '测试', '验收', '验证', '预取测'];

function isTestBrand(name: string): boolean {
  return TEST_BRAND_PATTERNS.some((p) => name.includes(p));
}

interface BrandContextValue {
  brands: BrandOption[];
  realBrands: BrandOption[];
  testBrands: BrandOption[];
  selectedBrandId: string | null;
  selectedBrand: BrandOption | null;
  setSelectedBrandId: (id: string | null) => void;
  isLoading: boolean;
  isClient: boolean;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export const BrandProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands', 'options', 'all'],
    queryFn: () => getBrands({ includeDemo: true }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { realBrands, testBrands, sortedBrands } = useMemo(() => {
    const real: BrandOption[] = [];
    const test: BrandOption[] = [];
    for (const b of brands) {
      if (isTestBrand(b.name)) {
        test.push(b);
      } else {
        real.push(b);
      }
    }
    return {
      realBrands: real,
      testBrands: test,
      sortedBrands: [...real, ...test],
    };
  }, [brands]);

  const [selectedBrandId, setSelectedBrandIdState] = React.useState<
    string | null
  >(() => {
    if (typeof window === 'undefined') return null;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ?? null;
  });

  useEffect(() => {
    if (isLoading || brands.length === 0) return;

    if (isClient && user?.brandId) {
      if (selectedBrandId !== user.brandId) {
        setSelectedBrandIdState(user.brandId);
        window.localStorage.setItem(STORAGE_KEY, user.brandId);
      }
      return;
    }

    if (
      selectedBrandId &&
      !brands.some((b: BrandOption) => b.id === selectedBrandId)
    ) {
      setSelectedBrandIdState(null);
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (!selectedBrandId && realBrands.length > 0) {
      const defaultBrand = realBrands.find((b: BrandOption) =>
        b.name.includes('麦香坊烘焙坊'),
      );
      const defaultId = defaultBrand ? defaultBrand.id : realBrands[0].id;
      setSelectedBrandIdState(defaultId);
      window.localStorage.setItem(STORAGE_KEY, defaultId);
    }
  }, [brands, selectedBrandId, isLoading, isClient, user?.brandId, realBrands]);

  const setSelectedBrandId = useCallback(
    (id: string | null) => {
      setSelectedBrandIdState(id);
      if (id) {
        window.localStorage.setItem(STORAGE_KEY, id);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const selectedBrand = useMemo(
    () =>
      selectedBrandId
        ? brands.find((b) => b.id === selectedBrandId) ?? null
        : null,
    [brands, selectedBrandId],
  );

  const value = useMemo<BrandContextValue>(
    () => ({
      brands: sortedBrands,
      realBrands,
      testBrands,
      selectedBrandId,
      selectedBrand,
      setSelectedBrandId,
      isLoading,
      isClient,
    }),
    [
      sortedBrands,
      realBrands,
      testBrands,
      selectedBrandId,
      selectedBrand,
      setSelectedBrandId,
      isLoading,
      isClient,
    ],
  );

  return (
    <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
  );
};

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return ctx;
}
