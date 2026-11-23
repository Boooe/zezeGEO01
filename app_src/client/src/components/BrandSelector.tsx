import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';

export function BrandSelector() {
  const { brands, selectedBrandId, setSelectedBrandId, isLoading } = useBrandSelector();
  
  return (
    <Select value={selectedBrandId} onValueChange={setSelectedBrandId} disabled={isLoading || brands.length === 0}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={isLoading ? '加载中...' : '选择品牌'} />
      </SelectTrigger>
      <SelectContent>
        {brands.map((b: { id: string; name: string }) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
