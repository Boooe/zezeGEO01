import React from 'react';
import PricingTableView from './PricingTableView';

/**
 * 报价管理页（保留为兼容入口，内容已抽取到 PricingTableView）
 * 现媒体商城页内切换表格视图时直接使用 PricingTableView 组件
 */
const PricingPage: React.FC = () => {
  return <PricingTableView />;
};

export default PricingPage;
