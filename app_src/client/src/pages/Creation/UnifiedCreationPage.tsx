import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Plus,
  X,
  Search,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Play,
  Eye,
  Send,
  Wand2,
  Sparkles,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Badge } from '@client/src/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@client/src/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Switch } from '@client/src/components/ui/switch';
import { Slider } from '@client/src/components/ui/slider';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import { Label } from '@client/src/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@client/src/components/ui/tabs';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { DataTable } from '@client/src/components/layout/DataTable';
import { Pill } from '@client/src/components/layout/Pill';
import { Image } from '@client/src/components/ui/image';
import { Skeleton } from '@client/src/components/ui/skeleton';

import { getMaterials } from '@client/src/api/content';
import {
  generateLongtail,
  batchImportPool,
} from '@client/src/api/keywords';
import {
  getKeywordGroups,
  getKeywords,
  generateCopy,
  splitImagePrompts,
  createUnifiedImageTask,
  createUnifiedVideoTask,
  listUnifiedTasks,
  deleteUnifiedTask,
  retryUnifiedTask,
  pollUnifiedTask,
} from '@client/src/api/creation';

import {
  CREATION_IMG_MODES,
  CREATION_IMG_MODE_LABELS,
  CREATION_RATIOS,
  CREATION_VIDEO_DURATIONS,
  CREATION_VIDEO_DURATION_LABELS,
  CREATION_RESOLUTIONS,
  CREATION_RESOLUTION_LABELS,
  SUBTITLE_STYLES,
  SUBTITLE_STYLE_LABELS,
  CREATION_TASK_TYPE_LABELS,
  CREATION_TASK_STATUS_LABELS,
  type CreationImgMode,
  type CreationRatio,
  type CreationVideoDuration,
  type CreationResolution,
  type SubtitleStyle,
  type KeywordGroup,
  type KeywordItem,
  type CreationTaskDetail,
  type CreationTaskType,
  type CreationTaskStatus,
} from '@shared/api.interface';

import { logger } from '@lark-apaas/client-toolkit/logger';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import { useMutation } from '@tanstack/react-query';
import { ComplianceCheckDialog } from '@client/src/components/compliance/ComplianceCheckDialog';
import { checkCompliance } from '@client/src/api/compliance';
import type { ComplianceCheckResponse } from '@shared/api.interface';

const RATIO_OPTIONS = CREATION_RATIOS.map((v) => ({ value: v, label: v }));

const VOICE_OPTIONS = [
  { id: 'female_zhixing', name: '知性女声', gender: 'female' as const },
  { id: 'male_cixing', name: '磁性男声', gender: 'male' as const },
  { id: 'female_huopo', name: '活泼女声', gender: 'female' as const },
  { id: 'male_chenwen', name: '沉稳男声', gender: 'male' as const },
];

const MAX_TAGS = 5;

/* -------------------- Multi-select helper -------------------- */

interface MultiSelectProps {
  placeholder: string;
  items: KeywordItem[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
}

const KeywordMultiSelect: React.FC<MultiSelectProps> = ({
  placeholder,
  items,
  value,
  onChange,
  disabled,
  searchPlaceholder = '搜索关键词',
  emptyText = '暂无数据',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((it) => it.keyword.toLowerCase().includes(q));
  }, [items, search]);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const displayText = useMemo(() => {
    if (value.length === 0) return '';
    const selected = items.filter((it) => value.includes(it.id));
    if (selected.length === 0) return `${value.length} 项`;
    const names = selected.slice(0, 3).map((it) => it.keyword).join('、');
    return value.length > 3 ? `${names} 等 ${value.length} 项` : names;
  }, [value, items]);

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal h-9"
          disabled={disabled}
        >
          {displayText || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="mb-2">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-400">{emptyText}</div>
          ) : (
            filtered.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={value.includes(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                />
                <span className="truncate">{item.keyword}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* -------------------- Tag input -------------------- */

const TagInput: React.FC<{
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
}> = ({ value, onChange, placeholder = '输入后按回车添加', max = MAX_TAGS }) => {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setInput('');
      return;
    }
    if (value.length >= max) {
      toast.warning('话题标签最多5个');
      return;
    }
    onChange([...value, trimmed]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const remove = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1 px-2 py-1"
          >
            #{tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="ml-1 text-gray-500 hover:text-gray-700"
              aria-label={`删除标签 ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleAdd}
      />
    </div>
  );
};

/* -------------------- Image uploader -------------------- */

const ImageUploader: React.FC<{
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  overLimitMessage?: string;
}> = ({ urls, onChange, max = 4, overLimitMessage }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - urls.length;
    if (remaining <= 0) {
      toast.warning(overLimitMessage || `参考图片最多${max}张`);
      return;
    }
    const fileArr = Array.from(files).slice(0, remaining);
    const previewUrls = fileArr.map((f) => URL.createObjectURL(f));
    const currentUrls = [...urls, ...previewUrls];
    onChange(currentUrls);
    setUploadingCount((c) => c + fileArr.length);

    const dataloom = await getDataloom();
    const bucket = dataloom.storage.from('default');
    const results: Array<{ preview: string; realUrl: string | null; error: boolean }> = [];

    await Promise.all(
      fileArr.map(async (file, idx) => {
        const preview = previewUrls[idx];
        try {
          const result = await bucket.uploadFile(file);
          if (result.error) {
            throw result.error;
          }
          results.push({ preview, realUrl: result.data.download_url, error: false });
        } catch (err) {
          logger.error('图片上传失败', err);
          results.push({ preview, realUrl: null, error: true });
        }
      }),
    );

    setUploadingCount((c) => Math.max(0, c - fileArr.length));

    // 用真实 URL 替换 blob URL，失败的项移除
    let nextUrls = [...currentUrls];
    for (const r of results) {
      if (r.error) {
        nextUrls = nextUrls.filter((u) => u !== r.preview);
        toast.error('图片上传失败，已移除该图片');
      } else if (r.realUrl) {
        const idx = nextUrls.indexOf(r.preview);
        if (idx !== -1) {
          nextUrls[idx] = r.realUrl;
        }
      }
      // 释放 blob URL
      try {
        URL.revokeObjectURL(r.preview);
      } catch {
        // ignore
      }
    }
    onChange(nextUrls);
  };

  const remove = (idx: number) => {
    const next = [...urls];
    const removed = next.splice(idx, 1)[0];
    if (removed && removed.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(removed);
      } catch {
        // ignore
      }
    }
    onChange(next);
  };

  const displayCount = urls.length + uploadingCount;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {urls.map((url, idx) => {
          const isUploading = url.startsWith('blob:');
          return (
            <div
              key={idx}
              className="relative w-20 h-20 rounded-md overflow-hidden border"
            >
              <Image
                src={url}
                alt={`上传图片 ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-white animate-spin" />
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-0.5 right-0.5 h-5 w-5 bg-black/50 text-white hover:bg-black/70"
                onClick={() => remove(idx)}
                aria-label={`删除第${idx + 1}张图片`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
        {displayCount < max && (
          <Button
            variant="outline"
            className="w-20 h-20 border-dashed"
            onClick={() => inputRef.current?.click()}
            aria-label="上传图片"
            disabled={uploadingCount > 0}
          >
            {uploadingCount > 0 ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      <p className="text-xs text-gray-400">
        最多 {max} 张，支持 jpg / png / webp
      </p>
    </div>
  );
};

/* -------------------- Material picker dialog -------------------- */

const MaterialPicker: React.FC<{
  open: boolean;
  onClose: () => void;
  brandId: string;
  materialType: 'image' | 'video';
  multiple: boolean;
  onConfirm: (selected: Array<{ id: string; name: string; url: string | null }>) => void;
  title?: string;
}> = ({ open, onClose, brandId, materialType, multiple, onConfirm, title }) => {
  const [list, setList] = useState<
    Array<{ id: string; name: string; url: string | null }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !brandId) return;
    setLoading(true);
    setSelected([]);
    getMaterials({
      brandId,
      materialType,
      keyword: search || undefined,
      page: 1,
      pageSize: 50,
    })
      .then((res) => {
        setList(res.items.map((m) => ({ id: m.id, name: m.name, url: m.fileUrl })));
      })
      .catch((err) => {
        logger.error('加载素材失败', err);
        toast.error('加载素材失败');
      })
      .finally(() => setLoading(false));
  }, [open, brandId, materialType, search]);

  const toggle = (id: string) => {
    if (multiple) {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
      );
    } else {
      setSelected([id]);
    }
  };

  const handleConfirm = () => {
    if (selected.length === 0) {
      toast.warning('请选择素材');
      return;
    }
    const items = list.filter((m) => selected.includes(m.id));
    onConfirm(items);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title || `选择${materialType === 'image' ? '图片' : '视频'}素材`}</DialogTitle>
          <DialogDescription>
            从素材库中选择{multiple ? '多个' : '一个'}{materialType === 'image' ? '图片' : '视频'}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3">
          <Input
            placeholder="搜索素材名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">暂无素材</div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {list.map((item) => {
                const isSelected = selected.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={`relative rounded-md overflow-hidden border cursor-pointer transition-all ${
                      isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="aspect-square bg-gray-100">
                      {item.url ? (
                        materialType === 'image' ? (
                          <Image
                            src={item.url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <VideoIcon className="h-8 w-8 text-gray-400" />
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-gray-300" />
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div className="px-1.5 py-1 text-xs truncate bg-white/80">{item.name}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleConfirm} disabled={selected.length === 0}>
            确定（{selected.length}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* -------------------- Status badge -------------------- */

const statusVariantMap: Record<CreationTaskStatus, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  pending: 'muted',
  generating: 'info',
  completed: 'success',
  failed: 'danger',
};

const TaskStatusBadge: React.FC<{ status: CreationTaskStatus }> = ({ status }) => {
  const variant = statusVariantMap[status];
  const label = CREATION_TASK_STATUS_LABELS[status] ?? status;

  return <Pill variant={variant}>{label}</Pill>;
};

/* -------------------- Preview dialog -------------------- */

const PreviewDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  task: CreationTaskDetail | null;
}> = ({ open, onClose, task }) => {
  if (!task) return null;
  const isImage = task.taskType === 'image';
  const images = task.resultImages || [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{task.title || '预览'}</DialogTitle>
          <DialogDescription>
            {CREATION_TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {isImage ? (
            images.length === 0 ? (
              <div className="py-16 text-center text-gray-400">暂无图片</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {images.map((url, idx) => (
                  <div key={idx} className="relative rounded-md overflow-hidden border">
                    <Image
                      src={url}
                      alt={`图片 ${idx + 1}`}
                      className="w-full h-auto"
                    />
                  </div>
                ))}
              </div>
            )
          ) : task.resultVideoUrl ? (
            <video
              src={task.resultVideoUrl}
              controls
              className="w-full rounded-md"
            />
          ) : (
            <div className="py-16 text-center text-gray-400">暂无视频</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ================================================================ */
/*                      UnifiedCreationPage                          */
/* ================================================================ */

const UnifiedCreationPage: React.FC = () => {
  // Brand
  const { brands, selectedBrandId, setSelectedBrandId } = useBrandSelector();

  // Tab: image | video
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  // Common form fields
  const [groupId, setGroupId] = useState<string>('');
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const [coreKeywords, setCoreKeywords] = useState<string[]>([]);
  const [longtailKeywords, setLongtailKeywords] = useState<string[]>([]);
  const [coreKeywordItems, setCoreKeywordItems] = useState<KeywordItem[]>([]);
  const [longtailKeywordItems, setLongtailKeywordItems] = useState<KeywordItem[]>([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [complianceResult, setComplianceResult] = useState<ComplianceCheckResponse | null>(null);
  const [generatingCopy, setGeneratingCopy] = useState(false);

  // Image-specific
  const [imageMode, setImageMode] = useState<CreationImgMode>('ai_generate');
  const [imagePrompt, setImagePrompt] = useState('');
  const [splitPrompts, setSplitPrompts] = useState<string[]>([]);
  const [splittingPrompts, setSplittingPrompts] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [imageCount, setImageCount] = useState(1);
  const [materialImageIds, setMaterialImageIds] = useState<string[]>([]);
  const [materialImageNames, setMaterialImageNames] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [imageRatio, setImageRatio] = useState<CreationRatio>('1:1');

  // Video-specific
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoRefImages, setVideoRefImages] = useState<string[]>([]);
  const [videoMaterialId, setVideoMaterialId] = useState<string>('');
  const [videoMaterialName, setVideoMaterialName] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<CreationVideoDuration>('15s');
  const [videoRatio, setVideoRatio] = useState<CreationRatio>('9:16');
  const [videoResolution, setVideoResolution] = useState<CreationResolution>('hd');
  const [subtitleEnabled, setSubtitleEnabled] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>('default');
  const [bgmUrl, setBgmUrl] = useState('');
  const [bgmVolume, setBgmVolume] = useState(50);
  const [voiceId, setVoiceId] = useState('female_zhixing');
  const [originalAudioEnabled, setOriginalAudioEnabled] = useState(false);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  // Polling: track in-progress task ids and interval refs
  const pollingRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Task list
  const [taskList, setTaskList] = useState<CreationTaskDetail[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState<CreationTaskType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<CreationTaskStatus | 'all'>('all');
  const [filterKeyword, setFilterKeyword] = useState('');

  // Dialogs
  const [imageMaterialOpen, setImageMaterialOpen] = useState(false);
  const [videoMaterialOpen, setVideoMaterialOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTask, setPreviewTask] = useState<CreationTaskDetail | null>(null);

  // Longtail generator dialog
  const [longtailDialogOpen, setLongtailDialogOpen] = useState(false);
  const [longtailInputText, setLongtailInputText] = useState('');
  const [longtailCity, setLongtailCity] = useState('石家庄');
  const [generatedLongtail, setGeneratedLongtail] = useState<string[]>([]);
  const [selectedLongtail, setSelectedLongtail] = useState<string[]>([]);
  const [generatingLongtail, setGeneratingLongtail] = useState(false);
  const [addingToPool, setAddingToPool] = useState(false);

  /* ---------- Keyword groups ---------- */

  useEffect(() => {
    if (!selectedBrandId) return;
    setGroupsLoading(true);
    getKeywordGroups(selectedBrandId)
      .then((data) => {
        setKeywordGroups(data);
        if (data.length > 0 && !groupId) {
          setGroupId(data[0].id);
        }
      })
      .catch((err) => {
        logger.error('加载关键词分组失败', err);
        toast.error('加载关键词分组失败');
      })
      .finally(() => setGroupsLoading(false));
  }, [selectedBrandId]);

  // Reset keywords when group changes
  useEffect(() => {
    setCoreKeywords([]);
    setLongtailKeywords([]);
  }, [groupId]);

  /* ---------- Load keywords when group changes ---------- */

  useEffect(() => {
    if (!groupId) {
      setCoreKeywordItems([]);
      setLongtailKeywordItems([]);
      return;
    }
    let cancelled = false;

    getKeywords({ groupId, type: 'core' })
      .then((data) => {
        if (!cancelled) setCoreKeywordItems(data);
      })
      .catch((err) => logger.error('加载核心关键词失败', err));

    getKeywords({ groupId, type: 'longtail' })
      .then((data) => {
        if (!cancelled) setLongtailKeywordItems(data);
      })
      .catch((err) => logger.error('加载长尾关键词失败', err));

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  /* ---------- Task list ---------- */

  const startTaskPolling = (taskId: string) => {
    if (pollingRef.current.has(taskId)) return;
    const interval = setInterval(async () => {
      try {
        const updated = await pollUnifiedTask(taskId);
        // 更新列表中的该任务
        setTaskList((prev) =>
          prev.map((t) => (t.id === taskId ? updated : t)),
        );
        // 如果任务完成或失败，停止轮询并提示
        if (updated.status === 'completed') {
          clearInterval(interval);
          pollingRef.current.delete(taskId);
          toast.success(`任务「${updated.title || '未命名'}」已完成`);
        } else if (updated.status === 'failed') {
          clearInterval(interval);
          pollingRef.current.delete(taskId);
          toast.error(
            `任务「${updated.title || '未命名'}」失败：${updated.error || '未知错误'}`,
          );
        }
      } catch (err) {
        logger.error(`轮询任务 ${taskId} 失败`, err);
        clearInterval(interval);
        pollingRef.current.delete(taskId);
      }
    }, 3000);
    pollingRef.current.set(taskId, interval);
  };

  const stopAllPolling = () => {
    pollingRef.current.forEach((interval) => clearInterval(interval));
    pollingRef.current.clear();
  };

  // 组件卸载时清理所有轮询
  useEffect(() => {
    return () => stopAllPolling();
  }, []);

  // 列表加载完成后，对 generating 状态的任务自动开启轮询
  useEffect(() => {
    taskList.forEach((task) => {
      if (task.status === 'generating' || task.status === 'pending') {
        startTaskPolling(task.id);
      }
    });
    // 对列表中不再是 generating 的任务停止轮询（如切页后）
    const currentIds = new Set(
      taskList
        .filter((t) => t.status === 'generating' || t.status === 'pending')
        .map((t) => t.id),
    );
    pollingRef.current.forEach((_, id) => {
      if (!currentIds.has(id)) {
        const interval = pollingRef.current.get(id);
        if (interval) clearInterval(interval);
        pollingRef.current.delete(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskList]);

  const fetchTasks = () => {
    if (!selectedBrandId) return;
    setListLoading(true);
    listUnifiedTasks({
      brandId: selectedBrandId,
      taskType: filterType === 'all' ? undefined : filterType,
      status: filterStatus === 'all' ? undefined : filterStatus,
      keyword: filterKeyword || undefined,
      page,
      pageSize,
    })
      .then((res) => {
        setTaskList(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        logger.error('加载任务列表失败', err);
        toast.error('加载任务列表失败');
      })
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrandId, page, filterType, filterStatus, filterKeyword]);

  /* ---------- AI generate copy ---------- */

  const handleGenerateCopy = async () => {
    if (!selectedBrandId) {
      toast.error('请先选择品牌');
      return;
    }
    if (!title.trim()) {
      toast.error(activeTab === 'image' ? '请输入图文标题' : '请输入视频标题');
      return;
    }
    if (coreKeywords.length === 0 && longtailKeywords.length === 0) {
      toast.error('请至少选择一个关键词');
      return;
    }
    setGeneratingCopy(true);
    try {
      const res = await generateCopy({
        brandId: selectedBrandId,
        keywords: coreKeywordItems
          .filter((it) => coreKeywords.includes(it.id))
          .map((it) => it.keyword),
        longtailKeywords: longtailKeywordItems
          .filter((it) => longtailKeywords.includes(it.id))
          .map((it) => it.keyword),
        title: title.trim(),
        taskType: activeTab,
      });
      setContent(res.content);
      toast.success('文案生成成功');
    } catch (err: unknown) {
      logger.error('文案生成失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '文案生成失败';
      toast.error(msg);
    } finally {
      setGeneratingCopy(false);
    }
  };

  const complianceMutation = useMutation<ComplianceCheckResponse, unknown, { title: string; content: string }>({
    mutationFn: ({ title, content }) => checkCompliance({ title, content }),
    retry: false,
    onSuccess: (data) => {
      setComplianceResult(data);
      setComplianceOpen(true);
    },
    onError: () => {
      toast.error('合规检测失败');
    },
  });

  const handleComplianceCheck = () => {
    if (!content.trim()) {
      toast.error('请先输入文案内容');
      return;
    }
    complianceMutation.mutate({ title: title.trim(), content });
  };

  /* ---------- Split image prompts ---------- */

  const handleSplitPrompts = async () => {
    if (!title.trim()) {
      toast.error('请输入图文标题');
      return;
    }
    if (imageCount < 1) {
      toast.error('生成数量必须大于 0');
      return;
    }
    setSplittingPrompts(true);
    try {
      const res = await splitImagePrompts({
        content: content.trim(),
        imageCount,
        keywords: coreKeywordItems
          .filter((it) => coreKeywords.includes(it.id))
          .map((it) => it.keyword),
        title: title.trim(),
      });
      setSplitPrompts(res.prompts);
      if (res.prompts.length > 0) {
        setImagePrompt(res.prompts.join('\n\n'));
      }
      toast.success(`已生成 ${res.prompts.length} 条提示词`);
    } catch (err: unknown) {
      logger.error('拆分提示词失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '拆分提示词失败';
      toast.error(msg);
    } finally {
      setSplittingPrompts(false);
    }
  };

  /* ---------- Material pickers ---------- */

  const handleConfirmImageMaterial = (
    items: Array<{ id: string; name: string; url: string | null }>,
  ) => {
    setMaterialImageIds(items.map((it) => it.id));
    setMaterialImageNames(items.map((it) => it.name));
  };

  const handleConfirmVideoMaterial = (
    items: Array<{ id: string; name: string; url: string | null }>,
  ) => {
    if (items.length !== 1) {
      toast.warning('请只选择一个视频');
      return;
    }
    setVideoMaterialId(items[0].id);
    setVideoMaterialName(items[0].name);
  };

  /* ---------- Longtail generator ---------- */

  const handleGenerateLongtail = async () => {
    const raw = longtailInputText
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (raw.length === 0) {
      toast.warning('请输入至少一个关键词');
      return;
    }
    if (raw.length > 10) {
      toast.warning('最多支持10个核心关键词');
      return;
    }
    setGeneratingLongtail(true);
    try {
      const res = await generateLongtail({
        keywords: raw,
        city: longtailCity.trim() || '石家庄',
      });
      setGeneratedLongtail(res.keywords);
      setSelectedLongtail(res.keywords);
      toast.success(`生成 ${res.keywords.length} 条长尾词`);
    } catch (err: unknown) {
      logger.error('生成长尾词失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '生成长尾词失败';
      toast.error(msg);
    } finally {
      setGeneratingLongtail(false);
    }
  };

  const toggleLongtailItem = (kw: string) => {
    setSelectedLongtail((prev) =>
      prev.includes(kw) ? prev.filter((v) => v !== kw) : [...prev, kw],
    );
  };

  const handleSelectAllLongtail = () => {
    if (selectedLongtail.length === generatedLongtail.length && generatedLongtail.length > 0) {
      setSelectedLongtail([]);
    } else {
      setSelectedLongtail([...generatedLongtail]);
    }
  };

  const handleAddToPool = async () => {
    if (!selectedBrandId) {
      toast.error('请先选择品牌');
      return;
    }
    if (selectedLongtail.length === 0) {
      toast.warning('请至少选择一个关键词');
      return;
    }
    setAddingToPool(true);
    try {
      const res = await batchImportPool({
        keywords: selectedLongtail.map((kw) => ({
          keyword: kw,
          keywordType: 'longtail' as const,
        })),
        brandId: selectedBrandId,
        source: 'keyword_expand',
      });
      toast.success(`已加入 ${res.added} 条到词池`);
    } catch (err: unknown) {
      logger.error('加入词池失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '加入词池失败';
      toast.error(msg);
    } finally {
      setAddingToPool(false);
    }
  };

  const handleUseForCreation = () => {
    if (selectedLongtail.length === 0) {
      toast.warning('请至少选择一个关键词');
      return;
    }
    // 构造临时 keyword items 并追加到长尾词列表
    const newItems: KeywordItem[] = selectedLongtail
      .filter(
        (kw) => !longtailKeywordItems.some((it) => it.keyword === kw),
      )
      .map((kw) => ({
        id: `generated_${kw}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        keyword: kw,
        keywordType: 'longtail' as const,
        groupId: groupId || null,
      }));
    if (newItems.length > 0) {
      setLongtailKeywordItems((prev) => [...prev, ...newItems]);
    }
    const allIds = [
      ...longtailKeywords,
      ...newItems.map((it) => it.id),
    ];
    setLongtailKeywords(Array.from(new Set(allIds)));
    toast.success(`已添加 ${selectedLongtail.length} 条长尾词到创作`);
    setLongtailDialogOpen(false);
    setGeneratedLongtail([]);
    setSelectedLongtail([]);
    setLongtailInputText('');
  };

  const handleCloseLongtailDialog = () => {
    setLongtailDialogOpen(false);
    setGeneratedLongtail([]);
    setSelectedLongtail([]);
    setLongtailInputText('');
  };

  /* ---------- Submit ---------- */

  const handleSubmit = async () => {
    // Common validation
    if (!selectedBrandId) {
      toast.error('请选择品牌');
      return;
    }
    if (!groupId) {
      toast.error('请选择分组后进行创作');
      return;
    }
    if (coreKeywords.length === 0) {
      toast.error('请选择核心关键词');
      return;
    }
    if (longtailKeywords.length === 0) {
      toast.error('请选择长尾关键词');
      return;
    }
    if (!title.trim()) {
      toast.error(activeTab === 'image' ? '请输入图文标题' : '请输入视频标题');
      return;
    }
    if (!content.trim()) {
      toast.error(activeTab === 'image' ? '请输入正文内容' : '请输入文案内容');
      return;
    }

    const coreKws = coreKeywordItems
      .filter((it) => coreKeywords.includes(it.id))
      .map((it) => it.keyword);
    const longtailKws = longtailKeywordItems
      .filter((it) => longtailKeywords.includes(it.id))
      .map((it) => it.keyword);

    setSubmitting(true);
    try {
      let task: CreationTaskDetail | null = null;
      if (activeTab === 'image') {
        // Image-specific validation
        if (imageMode === 'ai_generate') {
          if (imageCount < 1 || imageCount > 4) {
            toast.error('生成数量必须在 1-4 之间');
            setSubmitting(false);
            return;
          }
        } else if (imageMode === 'material') {
          if (materialImageIds.length === 0) {
            toast.error('请从素材库选择图片');
            setSubmitting(false);
            return;
          }
        } else if (imageMode === 'upload') {
          if (uploadedImageUrls.length === 0) {
            toast.error('请上传图片');
            setSubmitting(false);
            return;
          }
        }

        task = await createUnifiedImageTask({
          brandId: selectedBrandId,
          groupId,
          keywords: coreKws,
          longtailKeywords: longtailKws,
          title: title.trim(),
          content: content.trim(),
          tags,
          imageMode,
          imagePrompt:
            splitPrompts.length >= imageCount
              ? undefined
              : imagePrompt.trim() || undefined,
          perImagePrompts:
            splitPrompts.length >= imageCount
              ? splitPrompts.slice(0, imageCount)
              : undefined,
          imageCount,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          materialImageIds: materialImageIds.length > 0 ? materialImageIds : undefined,
          uploadedImageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
          ratio: imageRatio,
        });
      } else {
        // Video-specific validation
        if (!videoPrompt.trim()) {
          toast.error('请输入视频生成提示词');
          setSubmitting(false);
          return;
        }
        if (videoPrompt.length > 300) {
          toast.error('视频生成提示词不能超过 300 字');
          setSubmitting(false);
          return;
        }

        task = await createUnifiedVideoTask({
          brandId: selectedBrandId,
          groupId,
          keywords: coreKws,
          longtailKeywords: longtailKws,
          title: title.trim(),
          content: content.trim(),
          tags,
          videoPrompt: videoPrompt.trim(),
          videoReferenceImages: videoRefImages.length > 0 ? videoRefImages : undefined,
          videoMaterialId: videoMaterialId || undefined,
          duration: videoDuration,
          ratio: videoRatio,
          resolution: videoResolution,
          subtitleEnabled,
          subtitleStyle: subtitleEnabled ? subtitleStyle : undefined,
          bgmUrl: bgmUrl.trim() || undefined,
          bgmVolume,
          voiceId: voiceId || undefined,
          voiceName: VOICE_OPTIONS.find((v) => v.id === voiceId)?.name,
          originalAudioEnabled,
        });
      }

      toast.success('提交成功');
      fetchTasks();
      if (task) startTaskPolling(task.id);
    } catch (err: unknown) {
      logger.error('提交失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '提交失败';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- Task actions ---------- */

  const handlePreview = (task: CreationTaskDetail) => {
    setPreviewTask(task);
    setPreviewOpen(true);
  };

  const handleDownload = (task: CreationTaskDetail) => {
    if (task.taskType === 'image' && task.resultImages?.length) {
      task.resultImages.forEach((url, idx) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${task.title || 'image'}-${idx + 1}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    } else if (task.taskType === 'video' && task.resultVideoUrl) {
      const link = document.createElement('a');
      link.href = task.resultVideoUrl;
      link.download = task.title || 'video';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast.warning('暂无可下载内容');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryUnifiedTask(id);
      toast.success('已重新提交任务');
      fetchTasks();
    } catch (err) {
      logger.error('重试失败', err);
      toast.error('重试失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUnifiedTask(id);
      toast.success('删除成功');
      fetchTasks();
    } catch (err) {
      logger.error('删除失败', err);
      toast.error('删除失败');
    }
  };

  const handleGoPublish = () => {
    toast.info('发布记录功能开发中');
  };

  const handleVoicePreview = () => {
    toast.info('试听功能开发中');
  };

  /* ---------- Pagination ---------- */

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  /* ---------- Render ---------- */

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 内容创作"
        subtitle="一站式生成文章、图片、视频内容，支持多品牌管理"
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">品牌</Label>
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择品牌" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Tabs: image / video */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'image' | 'video')}>
        <TabsList className="bg-white border p-1">
          <TabsTrigger value="image" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            图文
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-2">
            <VideoIcon className="h-4 w-4" />
            视频
          </TabsTrigger>
        </TabsList>

        {/* Main form area: left form + right settings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Left: main form */}
          <SectionCard
            className="lg:col-span-2"
            title={activeTab === 'image' ? '图文创作' : '视频创作'}
          >
            <p className="text-[13px] text-[#5B6B85] mb-4">
              填写基础信息和内容，设置右侧创作参数后提交
            </p>
            <div className="space-y-5">
              {/* Keyword group */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  关键词分组 <span className="text-red-500">*</span>
                </Label>
                {groupsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="请选择素材分组" />
                    </SelectTrigger>
                    <SelectContent>
                      {keywordGroups.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-gray-400">
                          暂无分组
                        </div>
                      ) : (
                        keywordGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {!groupId && (
                  <p className="text-xs text-amber-600">请选择分组后进行创作</p>
                )}
              </div>

              {/* Core keywords */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  核心关键词 <span className="text-red-500">*</span>
                </Label>
                <KeywordMultiSelect
                  placeholder={!groupId ? '请先选择分组' : '选择核心关键词'}
                  items={coreKeywordItems}
                  value={coreKeywords}
                  onChange={setCoreKeywords}
                  disabled={!groupId}
                />
              </div>

              {/* Longtail keywords */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">
                    长尾关键词 <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary"
                    onClick={() => setLongtailDialogOpen(true)}
                    disabled={!groupId}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    生成长尾词
                  </Button>
                </div>
                <KeywordMultiSelect
                  placeholder={!groupId ? '请先选择分组' : '选择长尾关键词'}
                  items={longtailKeywordItems}
                  value={longtailKeywords}
                  onChange={setLongtailKeywords}
                  disabled={!groupId}
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  标题 <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={activeTab === 'image' ? '请输入图文标题' : '请输入视频标题'}
                />
              </div>

              {/* Content / Copy */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">
                    {activeTab === 'image' ? '正文内容' : '视频文案'}{' '}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateCopy}
                    disabled={generatingCopy}
                  >
                    {generatingCopy ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    AI 生成文案
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleComplianceCheck}
                    disabled={!content.trim() || complianceMutation.isPending}
                  >
                    {complianceMutation.isPending ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Shield className="h-3.5 w-3.5" />
                    )}
                    合规预检
                  </Button>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    activeTab === 'image'
                      ? '请输入正文内容'
                      : '请输入文案内容'
                  }
                  rows={6}
                />
              </div>

              {/* Topic tags */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  话题标签 <span className="text-gray-400 text-xs">（最多 {MAX_TAGS} 个）</span>
                </Label>
                <TagInput value={tags} onChange={setTags} placeholder="请添加话题标签" />
              </div>

              {/* Content type (read-only) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">内容类型</Label>
                <div className="h-9 px-3 rounded-md border bg-gray-50 text-gray-500 flex items-center text-sm">
                  {activeTab === 'image' ? '图文' : '视频'}
                </div>
              </div>

              {/* Submit button */}
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    确认提交
                  </>
                )}
              </Button>
            </div>
          </SectionCard>

          {/* Right: creation settings */}
          <SectionCard title="创作设置">
            <p className="text-[13px] text-[#5B6B85] mb-4">
              {activeTab === 'image' ? '图片生成相关参数' : '视频生成相关参数'}
            </p>
            <div className="space-y-5 max-h-[calc(100vh-240px)] overflow-y-auto">
              {activeTab === 'image' ? (
                <>
                  {/* Image mode */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">
                      配图获取方式
                    </Label>
                    <RadioGroup
                      value={imageMode}
                      onValueChange={(v) => setImageMode(v as CreationImgMode)}
                      className="space-y-2"
                    >
                      {CREATION_IMG_MODES.map((mode) => (
                        <div key={mode} className="flex items-center space-x-2">
                          <RadioGroupItem value={mode} id={`img-mode-${mode}`} />
                          <Label htmlFor={`img-mode-${mode}`} className="text-sm">
                            {CREATION_IMG_MODE_LABELS[mode]}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* AI Generate */}
                  {imageMode === 'ai_generate' && (
                    <div className="space-y-4 pl-1">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          生成提示词
                        </Label>
                        <Textarea
                          value={imagePrompt}
                          onChange={(e) => setImagePrompt(e.target.value)}
                          placeholder="描述画面风格、元素和构图..."
                          rows={4}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSplitPrompts}
                          disabled={splittingPrompts}
                          className="w-full"
                        >
                          {splittingPrompts ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          生成各图提示词
                        </Button>
                        {splitPrompts.length > 0 && (
                          <div className="space-y-2">
                            {splitPrompts.map((p, idx) => (
                              <div key={idx} className="flex gap-2">
                                <span className="pt-2 text-xs font-medium text-primary w-7 flex-shrink-0">
                                  #{idx + 1}
                                </span>
                                <Textarea
                                  value={p}
                                  onChange={(e) => {
                                    const next = [...splitPrompts];
                                    next[idx] = e.target.value;
                                    setSplitPrompts(next);
                                  }}
                                  rows={2}
                                  className="text-xs resize-none flex-1"
                                />
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const usable = splitPrompts.slice(0, imageCount);
                                setImagePrompt(usable.join('\n\n'));
                                toast.success(`已应用 ${usable.length} 条提示词到生成`);
                              }}
                              className="w-full"
                            >
                              应用这些提示词到生成
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          参考图片
                        </Label>
                        <ImageUploader
                          urls={referenceImages}
                          onChange={setReferenceImages}
                          max={4}
                          overLimitMessage="参考图片最多4张"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          生成数量
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setImageCount((c) => Math.max(1, c - 1))
                            }
                            aria-label="减少数量"
                          >
                            -
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">
                            {imageCount}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setImageCount((c) => Math.min(4, c + 1))
                            }
                            aria-label="增加数量"
                          >
                            +
                          </Button>
                          <span className="text-xs text-gray-400 ml-2">1-4 张</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Material library */}
                  {imageMode === 'material' && (
                    <div className="space-y-3 pl-1">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setImageMaterialOpen(true)}
                      >
                        <ImageIcon className="h-4 w-4" />
                        从素材库选择图片
                      </Button>
                      {materialImageIds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {materialImageNames.map((name, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {name.length > 12 ? name.slice(0, 12) + '...' : name}
                              <button
                                onClick={() => {
                                  setMaterialImageIds((prev) => prev.filter((_, i) => i !== idx));
                                  setMaterialImageNames((prev) => prev.filter((_, i) => i !== idx));
                                }}
                                className="ml-1 text-gray-500 hover:text-gray-700"
                                aria-label="移除"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload */}
                  {imageMode === 'upload' && (
                    <div className="space-y-2 pl-1">
                      <Label className="text-sm font-medium text-gray-700">
                        上传图片
                      </Label>
                      <ImageUploader
                        urls={uploadedImageUrls}
                        onChange={setUploadedImageUrls}
                        max={5}
                        overLimitMessage="最多上传5张图片"
                      />
                    </div>
                  )}

                  {/* Image ratio */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      图片比例
                    </Label>
                    <Select
                      value={imageRatio}
                      onValueChange={(v) => setImageRatio(v as CreationRatio)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RATIO_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  {/* Video prompt */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      视频生成提示词 <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder="描述视频画面、场景、风格..."
                      rows={5}
                      maxLength={300}
                    />
                    <p className="text-xs text-gray-400 text-right">
                      已用 {videoPrompt.length}/300
                    </p>
                  </div>

                  {/* Reference images */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      画面参考图
                    </Label>
                    <ImageUploader
                      urls={videoRefImages}
                      onChange={setVideoRefImages}
                      max={4}
                      overLimitMessage="参考图片最多4张"
                    />
                  </div>

                  {/* Video material */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      视频素材
                    </Label>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setVideoMaterialOpen(true)}
                    >
                      <VideoIcon className="h-4 w-4" />
                      从素材库选择视频
                    </Button>
                    {videoMaterialName && (
                      <Badge variant="secondary" className="text-xs">
                        {videoMaterialName.length > 20 ? videoMaterialName.slice(0, 20) + '...' : videoMaterialName}
                        <button
                          onClick={() => {
                            setVideoMaterialId('');
                            setVideoMaterialName('');
                          }}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                          aria-label="移除"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    <p className="text-xs text-gray-400">只能选择 1 个视频</p>
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">时长</Label>
                    <RadioGroup
                      value={videoDuration}
                      onValueChange={(v) =>
                        setVideoDuration(v as CreationVideoDuration)
                      }
                      className="flex flex-row space-x-4"
                    >
                      {CREATION_VIDEO_DURATIONS.map((d) => (
                        <div key={d} className="flex items-center space-x-2">
                          <RadioGroupItem value={d} id={`dur-${d}`} />
                          <Label htmlFor={`dur-${d}`} className="text-sm">
                            {CREATION_VIDEO_DURATION_LABELS[d]}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Ratio */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">比例</Label>
                    <Select
                      value={videoRatio}
                      onValueChange={(v) => setVideoRatio(v as CreationRatio)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RATIO_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Resolution */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">分辨率</Label>
                    <Select
                      value={videoResolution}
                      onValueChange={(v) =>
                        setVideoResolution(v as CreationResolution)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CREATION_RESOLUTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {CREATION_RESOLUTION_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subtitle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-gray-700">
                        显示字幕
                      </Label>
                      <Switch
                        checked={subtitleEnabled}
                        onCheckedChange={setSubtitleEnabled}
                      />
                    </div>
                    {subtitleEnabled && (
                      <Select
                        value={subtitleStyle}
                        onValueChange={(v) =>
                          setSubtitleStyle(v as SubtitleStyle)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBTITLE_STYLES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {SUBTITLE_STYLE_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* BGM */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      背景音乐
                    </Label>
                    <Input
                      value={bgmUrl}
                      onChange={(e) => setBgmUrl(e.target.value)}
                      placeholder="输入音乐 URL（选填）"
                    />
                    {bgmUrl && (
                      <div className="flex items-center gap-3">
                        <Volume2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <Slider
                          value={[bgmVolume]}
                          onValueChange={(vals) => setBgmVolume(vals[0])}
                          min={0}
                          max={100}
                          className="flex-1"
                        />
                        <span className="text-xs text-gray-500 w-10 text-right">
                          {bgmVolume}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Voice */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      声音 / 音色
                    </Label>
                    <div className="flex gap-2">
                      <Select value={voiceId} onValueChange={setVoiceId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VOICE_OPTIONS.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        onClick={handleVoicePreview}
                        className="flex-shrink-0"
                      >
                        试听
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-gray-600">开启原声</Label>
                      <Switch
                        checked={originalAudioEnabled}
                        onCheckedChange={setOriginalAudioEnabled}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </SectionCard>
        </div>
      </Tabs>

      {/* Task list (full-width) */}
      <SectionCard
          title="创作任务"
          actions={
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">类型：</span>
                <Select
                  value={filterType}
                  onValueChange={(v) => {
                    setFilterType(v as any);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-24 h-9">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="image">图文</SelectItem>
                    <SelectItem value="video">视频</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">状态：</span>
                <Select
                  value={filterStatus}
                  onValueChange={(v) => {
                    setFilterStatus(v as any);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-28 h-9">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {Object.entries(CREATION_TASK_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜索标题"
                  value={filterKeyword}
                  onChange={(e) => {
                    setFilterKeyword(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 w-48 h-9"
                />
              </div>
            </div>
          }
        >
            <p className="text-[13px] text-[#5B6B85] mb-4">
              所有图文和视频创作任务
            </p>
          {listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <DataTable
                rowKey="id"
                emptyText="暂无任务"
                data={taskList}
                columns={[
                  {
                    key: 'thumbnail',
                    title: '缩略图',
                    width: '64px',
                    render: (task: any) => (
                      task.taskType === 'image' && task.resultImages?.length ? (
                        <Image
                          src={task.resultImages[0]}
                          alt={task.title || '图片'}
                          className="w-12 h-8 rounded object-cover"
                        />
                      ) : task.taskType === 'video' && task.resultCoverUrl ? (
                        <Image
                          src={task.resultCoverUrl}
                          alt={task.title || '视频'}
                          className="w-12 h-8 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-8 rounded bg-gray-100 flex items-center justify-center">
                          {task.taskType === 'image' ? (
                            <ImageIcon className="h-3 w-3 text-gray-400" />
                          ) : (
                            <VideoIcon className="h-3 w-3 text-gray-400" />
                          )}
                        </div>
                      )
                    ),
                  },
                  {
                    key: 'title',
                    title: '标题',
                    render: (task: any) => (
                      <span className="font-medium block truncate" title={task.title || ''}>
                        {task.title || '-'}
                      </span>
                    ),
                  },
                  {
                    key: 'taskType',
                    title: '类型',
                    width: '80px',
                    render: (task: any) =>
                      CREATION_TASK_TYPE_LABELS[task.taskType] ?? task.taskType,
                  },
                  {
                    key: 'keywords',
                    title: '关键词',
                    width: '160px',
                    render: (task: any) => (
                      <div className="flex flex-wrap gap-1">
                        {task.keywords?.slice(0, 2).map((kw: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {kw.length > 8 ? kw.slice(0, 8) + '...' : kw}
                          </Badge>
                        ))}
                        {task.keywords?.length && task.keywords.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{task.keywords.length - 2}
                          </Badge>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'ratio',
                    title: '比例',
                    width: '80px',
                    render: (task: any) => task.ratio || '-',
                  },
                  {
                    key: 'status',
                    title: '状态',
                    width: '90px',
                    render: (task: any) => <TaskStatusBadge status={task.status} />,
                  },
                  {
                    key: 'createdAt',
                    title: '创建时间',
                    width: '130px',
                    render: (task: any) => (
                      <span className="text-xs text-gray-500">
                        {task.createdAt
                          ? new Date(task.createdAt).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    title: '操作',
                    align: 'right',
                    width: '200px',
                    render: (task: any) => (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handlePreview(task)}
                          aria-label="预览"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {task.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDownload(task)}
                            aria-label="下载"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {task.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRetry(task.id)}
                            aria-label="重试"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(task.id)}
                          aria-label="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleGoPublish}
                          aria-label="去发布记录"
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />

              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => goToPage(page - 1)}
                          className={page === 1 ? 'pointer-events-none opacity-50 cursor-pointer' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (p) => (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={page === p}
                              onClick={() => goToPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => goToPage(page + 1)}
                          className={
                            page === totalPages
                              ? 'pointer-events-none opacity-50 cursor-pointer'
                              : 'cursor-pointer'
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
              )}
        </SectionCard>

      {/* Material picker dialogs */}
      <MaterialPicker
        open={imageMaterialOpen}
        onClose={() => setImageMaterialOpen(false)}
        brandId={selectedBrandId}
        materialType="image"
        multiple
        onConfirm={handleConfirmImageMaterial}
        title="选择图片素材"
      />
      <MaterialPicker
        open={videoMaterialOpen}
        onClose={() => setVideoMaterialOpen(false)}
        brandId={selectedBrandId}
        materialType="video"
        multiple={false}
        onConfirm={handleConfirmVideoMaterial}
        title="选择视频素材"
      />

      {/* Preview dialog */}
      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        task={previewTask}
      />
      <ComplianceCheckDialog
        open={complianceOpen}
        onOpenChange={setComplianceOpen}
        result={complianceResult}
        isLoading={complianceMutation.isPending}
      />

      {/* Longtail generator dialog */}
      <Dialog open={longtailDialogOpen} onOpenChange={(o) => !o && handleCloseLongtailDialog()}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>生成长尾关键词</DialogTitle>
            <DialogDescription>
              输入核心关键词，自动生成地域+意图+场景等长尾词
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">核心关键词</Label>
              <Textarea
                value={longtailInputText}
                onChange={(e) => setLongtailInputText(e.target.value)}
                placeholder="请输入核心关键词，多个词用逗号或换行分隔，例如：生日蛋糕, 烘焙培训"
                rows={3}
              />
              <p className="text-xs text-gray-400">最多 10 个核心关键词</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">城市</Label>
              <Input
                value={longtailCity}
                onChange={(e) => setLongtailCity(e.target.value)}
                placeholder="请输入城市名称"
              />
            </div>

            <Button
              onClick={handleGenerateLongtail}
              disabled={generatingLongtail || !longtailInputText.trim()}
              className="w-full"
            >
              {generatingLongtail ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  生成长尾词
                </>
              )}
            </Button>

            {generatedLongtail.length > 0 && (
              <div className="space-y-2 border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    共生成 {generatedLongtail.length} 条候选词
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleSelectAllLongtail}
                  >
                    {selectedLongtail.length === generatedLongtail.length
                      ? '取消全选'
                      : '全选'}
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {generatedLongtail.map((kw) => (
                    <label
                      key={kw}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedLongtail.includes(kw)}
                        onCheckedChange={() => toggleLongtailItem(kw)}
                      />
                      <span className="truncate">{kw}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={handleCloseLongtailDialog}>
              取消
            </Button>
            <Button
              variant="outline"
              onClick={handleAddToPool}
              disabled={generatedLongtail.length === 0 || selectedLongtail.length === 0 || addingToPool}
            >
              {addingToPool ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  加入中...
                </>
              ) : (
                '加入词池'
              )}
            </Button>
            <Button
              onClick={handleUseForCreation}
              disabled={generatedLongtail.length === 0 || selectedLongtail.length === 0}
            >
              用于创作（{selectedLongtail.length}）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnifiedCreationPage;
