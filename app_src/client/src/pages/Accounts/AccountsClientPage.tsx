import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Download,
  Copy,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import { useAuth } from '@client/src/hooks/useAuth';
import {
  generateAuthorizeCode,
  getPlatformCapabilities,
} from '@client/src/api/account-auths';
import type {
  PlatformCapability,
  AuthorizeCodeResponse,
} from '@shared/api.interface';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const CLIENT_DESKTOP_URL = 'https://aka.doubaocdn.com/s/38YlWs6ROf';
const CLIENT_GUI_URL = 'https://aka.doubaocdn.com/s/0W9ZMutVKg';
const CLIENT_FOLDER_URL = 'https://aka.doubaocdn.com/s/rkSvvyQ0Zg';

const PRIMARY = '#2E7DFF';

function handleOpenClient(): void {
  // eslint-disable-next-line no-restricted-syntax
  window.location.href = 'xinghegeo://open';
  setTimeout(() => {
    if (document.hasFocus()) {
      toast.warning(
        '未检测到已安装的客户端。请先在客户端页下载并运行一次桌面版，之后这里就能直接打开',
      );
    }
  }, 2500);
}

const PLATFORM_ORDER = [
  'douyin',
  'baijiahao',
  'zhihu',
  'weibo',
  'xiaohongshu',
  'wechat',
  'toutiao',
  'bilibili',
  'sohu',
  'netease',
];

const faqItems = [
  {
    q: '打不开 / 白屏怎么办？',
    a: '可能缺少 WebView2 运行时。可以安装图形版（不依赖 WebView2），或从微软官网下载 WebView2 运行时。',
  },
  {
    q: '客户端提示找不到 Chrome 或 Edge？',
    a: '请确认本机已安装 Chrome 或 Edge 浏览器，并且安装在默认路径；客户端会自动扫描系统浏览器。',
  },
  {
    q: '授权码失效了怎么办？',
    a: '授权码 30 分钟内有效且只能用一次，失效后在本页重新生成一个即可。',
  },
  {
    q: '发布后平台里没看到文章？',
    a: '先到客户端「账号管理」里复查登录态是否仍有效，状态显示异常就重新扫码授权一次。',
  },
];

const ClientDownloadCard: React.FC<{
  title: string;
  desc: string;
  url: string;
}> = ({ title, desc, url }) => (
  <div
    className="flex items-center justify-between gap-4 rounded-lg p-4"
    style={{
      backgroundColor: '#ffffff',
      border: '1px solid #E9EDF3',
    }}
  >
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-sm font-medium" style={{ color: '#0F172A' }}>
        {title}
      </span>
      <span className="text-xs" style={{ color: '#64748B' }}>
        {desc}
      </span>
    </div>
    <UniversalLink
      to={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-white no-underline hover:opacity-90"
      style={{ backgroundColor: PRIMARY }}
    >
      <Download className="h-3.5 w-3.5" />
      下载
    </UniversalLink>
  </div>
);

const FaqItem: React.FC<{ q: string; a: string; index: number }> = ({
  q,
  a,
  index,
}) => {
  const [open, setOpen] = useState(index === 0);
  return (
    <div
      className="border-b last:border-b-0"
      style={{ borderColor: '#E9EDF3' }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-sm font-medium" style={{ color: '#0F172A' }}>
          {q}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0" style={{ color: '#94a3b8' }} />
        ) : (
          <ChevronDown
            className="h-4 w-4 shrink-0"
            style={{ color: '#94a3b8' }}
          />
        )}
      </button>
      {open && (
        <p
          className="pb-4 text-xs leading-5"
          style={{ color: '#64748B' }}
        >
          {a}
        </p>
      )}
    </div>
  );
};

const AccountsClientPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const { brands: brandOptions, selectedBrandId, setSelectedBrandId } =
    useBrandSelector();
  const brandId = isClient ? user?.brandId || '' : selectedBrandId;

  useEffect(() => {
    if (!isClient && !selectedBrandId && brandOptions.length > 0) {
      setSelectedBrandId(brandOptions[0].id);
    }
  }, [isClient, selectedBrandId, brandOptions, setSelectedBrandId]);

  const { data: platformData } = useQuery({
    queryKey: ['platform-capabilities'],
    queryFn: () => getPlatformCapabilities(),
    staleTime: 1000 * 60 * 60,
  });
  const platforms: PlatformCapability[] = useMemo(() => {
    const raw = platformData?.platforms ?? [];
    return [...raw].sort((a, b) => {
      const ai = PLATFORM_ORDER.indexOf(a.key);
      const bi = PLATFORM_ORDER.indexOf(b.key);
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [platformData]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('douyin');

  useEffect(() => {
    if (selectedPlatform === '' && platforms.length > 0) {
      setSelectedPlatform(platforms[0].key);
    }
  }, [selectedPlatform, platforms]);

  const navigate = useNavigate();

  const [authCodeResult, setAuthCodeResult] =
    useState<AuthorizeCodeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () =>
      generateAuthorizeCode({
        platform: selectedPlatform,
        brandId,
        authMode: 'qr',
      }),
    retry: false,
    onSuccess: (data) => {
      setAuthCodeResult(data);
      toast.success('授权码已生成');
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? '生成失败，请重试';
      toast.error(message);
    },
  });

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleGenerate = () => {
    if (!selectedPlatform) {
      toast.error('请先选择平台');
      return;
    }
    if (!brandId) {
      toast.error('请先选择品牌');
      return;
    }
    generateMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <PageHeader
          title="客户端"
          description="下载、授权、查看状态"
          hideInHub={false}
          actions={
            <button
              type="button"
              onClick={() => navigate('/accounts?tab=auth')}
              className="text-xs hover:underline"
              style={{ color: PRIMARY }}
            >
              ← 返回账号授权
            </button>
          }
        />

        <div
          className="mt-5 flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:gap-4"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #E9EDF3',
          }}
        >
          <button
            type="button"
            onClick={handleOpenClient}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium text-white hover:opacity-90"
            style={{ backgroundColor: PRIMARY }}
          >
            <ExternalLink className="h-4 w-4" />
            打开本机客户端
          </button>
          <p className="text-xs leading-5" style={{ color: '#64748B' }}>
            首次使用请先下载桌面版并运行一次，程序会自动向系统注册
            xinghegeo:// 协议
          </p>
        </div>

        <div className="mt-6 space-y-6">
          {/* 区块 A：软件包 */}
          <section
            className="rounded-lg p-5"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #E9EDF3',
            }}
          >
            <h2 className="text-base font-semibold" style={{ color: '#0F172A' }}>
              软件包
            </h2>
            <p className="mt-1 text-xs" style={{ color: '#64748B' }}>
              选择适合你系统环境的版本下载
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <ClientDownloadCard
                title="桌面版"
                desc="12.25 MB · 需 WebView2"
                url={CLIENT_DESKTOP_URL}
              />
              <ClientDownloadCard
                title="图形版"
                desc="8 MB · 不依赖 WebView2"
                url={CLIENT_GUI_URL}
              />
              <ClientDownloadCard
                title="文件夹版"
                desc="zip · 杀软误报最低"
                url={CLIENT_FOLDER_URL}
              />
            </div>
          </section>

          {/* 区块 B：获取授权码 */}
          <section
            className="rounded-lg p-5"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #E9EDF3',
            }}
          >
            <h2 className="text-base font-semibold" style={{ color: '#0F172A' }}>
              获取授权码
            </h2>
            <p className="mt-1 text-xs" style={{ color: '#64748B' }}>
              选择平台后生成一次性授权码，用于客户端登录
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-start">
              <div className="flex flex-col gap-1.5 w-full sm:w-56">
                <label className="text-xs" style={{ color: '#64748B' }}>
                  平台
                </label>
                <Select
                  value={selectedPlatform}
                  onValueChange={setSelectedPlatform}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="选择平台" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  generateMutation.isPending || !selectedPlatform || !brandId
                }
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 self-start sm:self-auto"
                style={{ backgroundColor: PRIMARY }}
              >
                {generateMutation.isPending ? '生成中…' : '生成授权码'}
              </button>
            </div>

            {authCodeResult && (
              <div
                className="mt-5 rounded-lg p-4"
                style={{
                  backgroundColor: 'rgba(37, 99, 235, 0.04)',
                  border: '1px solid rgba(37, 99, 235, 0.15)',
                }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs" style={{ color: '#64748B' }}>
                      授权码
                    </span>
                    <span
                      className="text-3xl font-bold tracking-wider"
                      style={{ color: PRIMARY, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {authCodeResult.code}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(authCodeResult.code)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium hover:bg-black/5"
                    style={{ color: PRIMARY }}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        复制
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-1 text-xs" style={{ color: '#64748B' }}>
                  <span>30 分钟内有效，只能用一次</span>
                  <span>
                    把这串码填进客户端的「授权码」框，扫码登录一次即可
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* 区块 C：使用步骤 */}
          <section
            className="rounded-lg p-5"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #E9EDF3',
            }}
          >
            <h2 className="text-base font-semibold" style={{ color: '#0F172A' }}>
              使用步骤
            </h2>
            <p className="mt-1 text-xs" style={{ color: '#64748B' }}>
              三步完成客户端授权
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { num: '1', text: '下载并双击打开客户端（首次运行会自动注册唤起协议）' },
                { num: '2', text: '在本页生成 8 位授权码' },
                { num: '3', text: '客户端填该码并扫码登录一次' },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-3">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      color: PRIMARY,
                    }}
                  >
                    {step.num}
                  </div>
                  <span
                    className="text-xs leading-5 pt-0.5"
                    style={{ color: '#334155' }}
                  >
                    {step.text}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="mt-4 flex flex-col gap-1 text-xs"
              style={{ color: '#64748B' }}
            >
              <span>首次打开如提示未知发布者，点「更多信息 → 仍要运行」</span>
              <span>授权码只在本机使用，系统不保存明文登录态</span>
            </div>
          </section>

          {/* 区块 D：常见问题 */}
          <section
            className="rounded-lg p-5"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #E9EDF3',
            }}
          >
            <div className="flex items-center gap-2">
              <HelpCircle
                className="h-4 w-4"
                style={{ color: PRIMARY }}
              />
              <h2 className="text-base font-semibold" style={{ color: '#0F172A' }}>
                常见问题
              </h2>
            </div>
            <div className="mt-3">
              {faqItems.map((item, i) => (
                <FaqItem key={item.q} q={item.q} a={item.a} index={i} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AccountsClientPage;
