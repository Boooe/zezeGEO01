import { useBrand } from './useBrandContext';

export function useBrandSelector() {
  const {
    brands,
    realBrands,
    testBrands,
    isLoading,
    selectedBrandId: contextBrandId,
    selectedBrand,
    setSelectedBrandId: setContextBrandId,
  } = useBrand();

  const selectedBrandId = contextBrandId ?? '';

  const handleBrandChange = (id: string) => {
    setContextBrandId(id || null);
  };

  return {
    brands,
    realBrands,
    testBrands,
    isLoading,
    selectedBrandId,
    selectedBrand,
    setSelectedBrandId: handleBrandChange,
  };
}
