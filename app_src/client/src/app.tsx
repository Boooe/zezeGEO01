import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import './api/request';
import { queryClient } from './lib/query-client';
import { AuthContextProvider } from './contexts/AuthContext';
import { BrandProvider } from './hooks/useBrandContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import LoginPage from './pages/Login/Login';
import DashboardPage from './pages/Dashboard/Dashboard';
import LeadsPage from './pages/Leads/Leads';
import ContractsPage from './pages/Contracts/Contracts';
import ReportsPage from './pages/Reports/Reports';
import KeywordsPage from './pages/Keywords/Keywords';
import KeywordPoolPage from './pages/Keywords/KeywordPoolPage';
import KeywordInspirationPage from './pages/Keywords/KeywordInspirationPage';
import KeywordTasksPage from './pages/Keywords/KeywordTasksPage';
import KeywordReportsPage from './pages/Keywords/KeywordReportsPage';
import SettingsPage from './pages/Settings/Settings';
import CreationHome from './pages/Creation/CreationHome';
import CreationArticlePage from './pages/Creation/ArticlePage';
import CreationImagePage from './pages/Creation/ImagePage';
import CreationVideoPage from './pages/Creation/VideoPage';
import CreationTaskPage from './pages/Creation/TaskPage';
import UnifiedCreationPage from './pages/Creation/UnifiedCreationPage';
import LibraryPage from './pages/Content/LibraryPage';
import MyPlanPage from './pages/Creation/MyPlan';
import CommitmentManagementPage from './pages/Commitment/ManagementPage';
import NotFound from './pages/NotFound/NotFound';
import CommitmentPage from './pages/Commitment/CommitmentPage';
import CommitmentGuard from './components/CommitmentGuard';
import DiagnosisCreatePage from './pages/Diagnosis/DiagnosisCreatePage';
import DiagnosisReportPage from './pages/Diagnosis/DiagnosisReportPage';
import PublishRecordsPage from './pages/Publication/PublishRecordsPage';
import AllArticlesPage from './pages/Content/AllArticlesPage';
import AutoPublishPage from './pages/Publication/AutoPublishPage';
import LongtailComboPage from './pages/Keywords/LongtailComboPage';
import WebsiteSettingsPage from './pages/Website/WebsiteSettingsPage';
import WebsiteTdkPage from './pages/Website/WebsiteTdkPage';
import WebsiteSitesPage from './pages/Website/WebsiteSitesPage';
import ChannelAccountsPage from './pages/Publication/ChannelAccountsPage';
import PublishQueuePage from './pages/Publication/PublishQueuePage';
import PublishLedgerPage from './pages/Publication/PublishLedgerPage';
import AccountAuthsPage from './pages/Publication/AccountAuthsPage';
import PublishClientPage from './pages/Publication/PublishClientPage';
import SubmissionChannelsPage from './pages/Publication/SubmissionChannelsPage';
import SubmissionQueuePage from './pages/Publication/SubmissionQueuePage';
import AccountProfilePage from './pages/Account/AccountProfilePage';
import CreditTransactionsPage from './pages/Account/CreditTransactionsPage';
import CustomersPage from './pages/Customers/Customers';
import AiKeysPage from './pages/Settings/AiKeysPage';
import AdminPlansPage from './pages/Admin/PlansPage';
import AdminCreditOverviewPage from './pages/Admin/CreditOverviewPage';
import AdminDeliveryBoardPage from './pages/Admin/DeliveryBoardPage';
import { Navigate } from 'react-router-dom';
import WorkbenchPage from './pages/Workbench/WorkbenchPage';
import ClientsPage from './pages/Clients/ClientsPage';
import KeywordsHubPage from './pages/Keywords/KeywordsHubPage';
import CreationHubPage from './pages/Creation/CreationHubPage';
import PublishHubPage from './pages/Publication/PublishHubPage';
import AccountsClientPage from './pages/Accounts/AccountsClientPage';
import SiteAccountsPage from './pages/SiteAccounts/SiteAccountsPage';
import BillingPage from './pages/Billing/BillingPage';
import MediaMarketHub from './pages/MediaMarket/MediaMarketHub';
import GeoLoopPage from './pages/GeoLoop/GeoLoopPage';

const Redirect = ({ to }: { to: string }) => <Navigate to={to} replace />;

const RoutesComponent = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContextProvider>
        <BrandProvider>
        <Routes>
        {/* 登录页：独立布局，不经过 Layout 和 ProtectedRoute */}
        <Route path="/login" element={<LoginPage />} />

        {/* 承诺书签署页：需要登录，独立全屏布局，不触发签署检查 */}
        <Route
          path="/commitment"
          element={
            <ProtectedRoute>
              <CommitmentPage />
            </ProtectedRoute>
          }
        />

        {/* 受保护路由：需要登录 + 主布局 + 承诺书签署检查 */}
        <Route
          element={
            <ProtectedRoute>
              <CommitmentGuard>
                <Layout />
              </CommitmentGuard>
            </ProtectedRoute>
          }
        >
          {/* ===== 新架构：9 个 Hub 页面 ===== */}
          <Route index element={<Redirect to="/workbench" />} />
          <Route path="workbench" element={<WorkbenchPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="geo-loop" element={<GeoLoopPage />} />
          <Route path="diagnosis/new/create" element={<DiagnosisCreatePage />} />
          <Route path="diagnosis/:id" element={<DiagnosisReportPage />} />
          <Route path="diagnosis" element={<Redirect to="/geo-loop?tab=diagnosis" />} />
          <Route path="keywords" element={<KeywordsHubPage />} />
          <Route path="creation" element={<CreationHubPage />} />
          <Route path="publish" element={<PublishHubPage />} />
          <Route path="accounts" element={<SiteAccountsPage />} />
          <Route path="accounts/client" element={<AccountsClientPage />} />
          <Route path="sites" element={<SiteAccountsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="media-market" element={<MediaMarketHub />} />
          <Route path="media-market/wallet" element={<Redirect to="/media-market?tab=wallet" />} />
          <Route path="geo-loop" element={<GeoLoopPage />} />
          <Route path="account" element={<AccountProfilePage />} />

          {/* ===== 旧路径：前端重定向到新架构 ===== */}
          <Route path="/" element={<Redirect to="/workbench" />} />
          <Route path="leads" element={<Redirect to="/clients?tab=leads" />} />
          <Route path="customers" element={<Redirect to="/clients?tab=customers" />} />
          <Route path="contracts" element={<Redirect to="/clients?tab=contracts" />} />
          <Route path="reports" element={<Redirect to="/clients?tab=reports" />} />
          <Route path="commitment/management" element={<Redirect to="/clients?tab=commitments" />} />
          <Route path="keywords/pool" element={<Redirect to="/keywords?tab=pool" />} />
          <Route path="keywords/inspiration" element={<Redirect to="/keywords?tab=inspiration" />} />
          <Route path="keywords/tasks" element={<Redirect to="/keywords?tab=monitor" />} />
          <Route path="keywords/reports" element={<Redirect to="/keywords?tab=report" />} />
          <Route path="keywords/longtail" element={<Redirect to="/keywords?tab=longtail" />} />
          <Route path="diagnosis/new" element={<Redirect to="/geo-loop?tab=diagnosis" />} />
          <Route path="diagnosis/competitor-compare" element={<Redirect to="/geo-loop?tab=competitors" />} />
          <Route path="creation/home" element={<Redirect to="/creation?tab=write" />} />
          <Route path="creation/unified" element={<Redirect to="/creation?tab=write" />} />
          <Route path="creation/article" element={<Redirect to="/creation?tab=batch" />} />
          <Route path="creation/tasks" element={<Redirect to="/creation?tab=batch" />} />
          <Route path="creation/library" element={<Redirect to="/creation?tab=assets" />} />
          <Route path="creation/articles" element={<Redirect to="/creation?tab=articles" />} />
          <Route path="creation/image" element={<Redirect to="/creation?tab=write" />} />
          <Route path="creation/video" element={<Redirect to="/creation?tab=write" />} />
          <Route path="creation/my-plan" element={<Redirect to="/billing?tab=plan" />} />
          <Route path="publish/records" element={<Redirect to="/publish?tab=records" />} />
          <Route path="publish/queue" element={<Redirect to="/publish?tab=queue" />} />
          <Route path="publish/auto" element={<Redirect to="/publish?tab=auto" />} />
          <Route path="publish/ledger" element={<Redirect to="/publish?tab=ledger" />} />
          <Route path="publish/submission-channels" element={<Redirect to="/publish?tab=channels" />} />
          <Route path="publish/submission-queue" element={<Redirect to="/publish?tab=queue" />} />
          <Route path="publish/accounts" element={<Redirect to="/accounts?tab=auth" />} />
          <Route path="publish/channels" element={<Redirect to="/accounts?tab=platform" />} />
          <Route path="publish/client" element={<Redirect to="/accounts?tab=client" />} />
          <Route path="website/settings" element={<Redirect to="/sites?tab=settings" />} />
          <Route path="website/tdk" element={<Redirect to="/sites?tab=tdk" />} />
          <Route path="website/sites" element={<Redirect to="/sites?tab=list" />} />
          <Route path="publish/sites/enterprise" element={<Redirect to="/sites?tab=list&siteType=enterprise" />} />
          <Route path="publish/sites/b2b" element={<Redirect to="/sites?tab=list&siteType=b2b" />} />
          <Route path="settings/knowledge" element={<Redirect to="/sites?tab=knowledge" />} />
          <Route path="settings/account" element={<Redirect to="/account" />} />
          <Route path="settings/credits" element={<Redirect to="/billing?tab=credits" />} />
          <Route path="settings/ai-keys" element={<Redirect to="/billing?tab=models" />} />
          <Route
            path="admin/plans"
            element={<Redirect to="/billing?tab=plans" />}
          />
          <Route
            path="admin/credit"
            element={<Redirect to="/billing?tab=credit-overview" />}
          />
          <Route
            path="admin/delivery"
            element={<Redirect to="/workbench" />}
          />
        </Route>

        <Route path="*" element={<NotFound />} />
        </Routes>
        </BrandProvider>
    </AuthContextProvider>
    </QueryClientProvider>
  );
};

export default RoutesComponent;
