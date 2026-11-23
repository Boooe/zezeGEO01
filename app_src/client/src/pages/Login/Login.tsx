import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Lock, User, Check } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Alert, AlertDescription } from '@client/src/components/ui/alert';
import { useAuth } from '@client/src/hooks/useAuth';
import BrandLogo from '@client/src/components/BrandLogo';

/**
 * 登录页：独立布局，不使用主 Layout。
 * - 蓝色渐变背景 + 居中白色卡片
 * - 用户名/密码表单
 * - 常驻红色错误条（非 toast），用户再次输入时清除
 * - 登录成功跳转到首页
 * - URL 带 ?expired=1 时显示橙色过期提示
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  // 已登录用户访问登录页 → 跳回首页
  useEffect(() => {
    const targetTitle = '星河GEO - 登录';
    document.title = targetTitle;
    const timers: number[] = [];
    [50, 200, 800, 2000].forEach((delay: number) => {
      timers.push(window.setTimeout(() => {
        if (document.title !== targetTitle) document.title = targetTitle;
      }, delay));
    });
    if (user) {
      navigate('/', { replace: true });
    }
    return () => {
      timers.forEach((t: number) => window.clearTimeout(t));
    };
  }, [user, navigate]);

  // 从 URL 读取 expired 参数，显示过期提示
  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      setShowExpired(true);
    }
  }, [searchParams]);

  const handleUsernameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUsername(e.target.value);
      if (errorMsg) setErrorMsg(null);
      if (showExpired) setShowExpired(false);
    },
    [errorMsg, showExpired],
  );

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
      if (errorMsg) setErrorMsg(null);
      if (showExpired) setShowExpired(false);
    },
    [errorMsg, showExpired],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isSubmitting) return;
      if (!username.trim() || !password) {
        setErrorMsg('请输入用户名和密码');
        return;
      }

      setIsSubmitting(true);
      setErrorMsg(null);

      try {
        await login({ username: username.trim(), password, rememberMe });
        navigate('/', { replace: true });
      } catch (err: unknown) {
        // 错误提示文案规则
        const status =
          (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          setErrorMsg('用户名或密码错误，请检查后重试');
        } else {
          setErrorMsg(
            `服务异常（HTTP ${status ?? '错误'}），请稍后重试`,
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, username, password, login, navigate],
  );

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#0f172a] px-4">
      <div
        className="w-full rounded-[12px] bg-white p-8 shadow-xl"
        style={{ maxWidth: 400 }}
      >
        {/* Logo / 标题区域 */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <BrandLogo size={48} withText={false} />
          </div>
          <h1 className="text-[22px] font-semibold text-[#0f172a]">
            星河GEO
          </h1>
          <p className="mt-1 text-sm text-[#64748b]">
            本地商户增长服务平台
          </p>
        </div>

        {/* 过期提示（橙色） */}
        {showExpired && (
          <Alert
            variant="warning"
            className="mb-5 border-orange-200 bg-orange-50 text-orange-700"
          >
            <AlertTriangle size={16} />
            <AlertDescription className="text-orange-700">
              登录已过期，请重新登录
            </AlertDescription>
          </Alert>
        )}

        {/* 错误提示（红色常驻条） */}
        {errorMsg && (
          <Alert
            variant="destructive"
            className="mb-5 border-red-200 bg-red-50 text-red-700"
          >
            <AlertDescription className="text-red-700">
              {errorMsg}
            </AlertDescription>
          </Alert>
        )}

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-sm font-medium text-[#334155]"
            >
              用户名
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
              />
              <Input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="请输入用户名"
                className="pl-9"
                autoComplete="username"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-[#334155]"
            >
              密码
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
              />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="请输入密码"
                className="pl-9"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              disabled={isSubmitting}
            />
            <label
              htmlFor="remember-me"
              className="text-sm text-[#64748b] cursor-pointer select-none"
            >
              记住我（30 天）
            </label>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#3B5BFF] hover:bg-[#2d4ae8]"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? '登录中...' : '登 录'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-[#94a3b8]">
          © {new Date().getFullYear()} 星河GEO · 仅限授权人员使用
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
