import { Settings as SettingsIcon } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import { useAuth } from '@client/src/hooks/useAuth';
import ProfileTab from './components/ProfileTab';
import PasswordTab from './components/PasswordTab';
import TokensTab from './components/TokensTab';
import CreditManagementTab from './components/CreditManagementTab';
import CommitmentVersionsTab from './components/CommitmentVersionsTab';

const Settings = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-[20px] font-semibold leading-none flex items-center gap-2"
          style={{ color: '#101828' }}
        >
          <SettingsIcon className="h-5 w-5" style={{ color: '#1e40af' }} />
          系统设置
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理个人资料、密码和自动化令牌
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">个人资料</TabsTrigger>
          <TabsTrigger value="password">修改密码</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="tokens">自动化令牌</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="credit">算力管理</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="commitment">承诺书版本</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="password">
          <PasswordTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="tokens">
            <TokensTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="credit">
            <CreditManagementTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="commitment">
            <CommitmentVersionsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;
