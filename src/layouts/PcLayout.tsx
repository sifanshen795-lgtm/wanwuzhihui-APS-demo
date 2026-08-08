import {
  AppstoreOutlined,
  BarcodeOutlined,
  BellOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MobileOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Avatar, Breadcrumb, Button, Input, Layout, Menu, Select } from 'antd';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import logoWanwuzhihui from '../assets/logo-wanwuzhihui.png';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '首页' },
  {
    key: 'master', icon: <DatabaseOutlined />, label: '基础数据', children: [
      {
        key: 'master-base',
        label: '基础资料',
        children: [
          { key: '/master/materials', label: '物料列表' },
          { key: '/master/colors', label: '色级列表' },
          { key: '/master/customers', label: '客户列表' },
          { key: '/master/units', label: '单位列表' },
          { key: '/master/dict', label: '数据字典' },
        ],
      },
      {
        key: 'master-config',
        label: '生产资料',
        children: [
          { key: '/master/config/workshops', label: '车间' },
          { key: '/master/config/lines', label: '产线' },
          { key: '/master/config/calendar', label: '生产日历表' },
          { key: '/master/config/mrp-rules', label: 'MRP 规则设置' },
          { key: '/master/config/line-product-relations', label: '产线与产品关系表' },
          { key: '/master/config/product-group-relations', label: '产品组关系表' },
          { key: '/master/config/forms', label: '生产表单' },
          { key: '/master/config/processes', label: '生产工序' },
          { key: '/master/config/crafts', label: '生产工艺' },
          { key: '/master/config/bom', label: '物料清单' },
        ],
      },
    ],
  },
  { key: '/sales-orders', icon: <FileDoneOutlined />, label: '销售订单' },
  {
    key: 'production', icon: <AppstoreOutlined />, label: '生产管理', children: [
      { key: '/production-orders', label: '生产订单' },
      { key: '/requirements', label: '用料清单' },
      { key: '/schedule', label: '计划排程' },
      { key: '/schedule-outputs', label: '排程输出' },
      { key: '/work-orders', label: '批次工单' },
      { key: '/formulas', label: '配方单' },
    ],
  },
  { key: '/records', icon: <ScheduleOutlined />, label: '生产记录' },
  {
    key: 'inventory', icon: <DatabaseOutlined />, label: '库存管理', children: [
      { key: '/inventory', label: '即时库存' },
      { key: '/inventory/reservations', label: 'MRP库存占用单' },
      { key: '/inventory/shortages', label: '缺料汇总' },
      { key: '/inventory/inbound', label: '预计入库登记' },
      { key: '/inventory/outbound', label: '预计出库登记' },
    ],
  },
  {
    key: 'line-side', icon: <DatabaseOutlined />, label: '线边仓管理', children: [
      { key: '/line-side', label: '线边仓即时库存' },
      { key: '/line-side/reservations', label: 'MRP库存占用单' },
    ],
  },
  { key: '/barcodes', icon: <BarcodeOutlined />, label: '条码管理' },
  { key: '/tanks', icon: <DatabaseOutlined />, label: '储罐档案' },
  { key: '/demo', icon: <HomeOutlined />, label: 'Demo 控制台' },
  { key: '/app', icon: <MobileOutlined />, label: 'APP/H5 端' },
];

const MIN_SIDER_WIDTH = 180;
const MAX_SIDER_WIDTH = 360;

const titleMap: Record<string, string[]> = {
  '/': ['首页'],
  '/demo': ['Demo 控制台'],
  '/master/materials': ['基础资料', '物料列表'],
  '/master/colors': ['基础资料', '色级列表'],
  '/master/config/workshops': ['生产资料', '车间'],
  '/master/config/lines': ['生产资料', '产线'],
  '/master/config/calendar': ['生产资料', '生产日历表'],
  '/master/config/mrp-rules': ['生产资料', 'MRP 规则设置'],
  '/master/config/line-product-relations': ['生产资料', '产线与产品关系表'],
  '/master/config/product-group-relations': ['生产资料', '产品组关系表'],
  '/master/config/forms': ['生产资料', '生产表单'],
  '/master/config/processes': ['生产资料', '生产工序'],
  '/master/config/crafts': ['生产资料', '生产工艺'],
  '/master/config/bom': ['生产资料', '物料清单'],
  '/sales-orders': ['销售订单'],
  '/production-orders': ['生产管理', '生产订单'],
  '/requirements': ['生产管理', '用料清单'],
  '/schedule': ['生产管理', '计划排程'],
  '/schedule-outputs': ['生产管理', '排程输出'],
  '/work-orders': ['生产管理', '批次工单'],
  '/formulas': ['生产管理', '配方单'],
  '/records': ['生产记录'],
  '/inventory': ['库存管理', '即时库存'],
  '/inventory/reservations': ['库存管理', 'MRP库存占用单'],
  '/line-side': ['线边仓管理', '线边仓即时库存'],
  '/line-side/reservations': ['线边仓管理', 'MRP库存占用单'],
  '/inventory/inbound': ['库存管理', '预计入库登记'],
  '/inventory/outbound': ['库存管理', '预计出库登记'],
  '/barcodes': ['条码管理', '条码档案'],
  '/tanks': ['条码管理', '储罐档案'],
};

export function PcLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumb = titleMap[location.pathname] ?? ['MES演示'];
  const [siderWidth, setSiderWidth] = useState(200);
  const resizeHandlersRef = useRef<{ move: (event: MouseEvent) => void; up: () => void } | null>(null);

  useEffect(() => () => {
    const handlers = resizeHandlersRef.current;
    if (handlers) {
      window.removeEventListener('mousemove', handlers.move);
      window.removeEventListener('mouseup', handlers.up);
    }
    document.body.classList.remove('erp-resizing');
  }, []);

  const handleResizeMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = siderWidth;

    if (resizeHandlersRef.current) {
      window.removeEventListener('mousemove', resizeHandlersRef.current.move);
      window.removeEventListener('mouseup', resizeHandlersRef.current.up);
      resizeHandlersRef.current = null;
    }

    const move = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(MIN_SIDER_WIDTH, Math.min(MAX_SIDER_WIDTH, startWidth + moveEvent.clientX - startX));
      setSiderWidth(nextWidth);
    };

    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      resizeHandlersRef.current = null;
      document.body.classList.remove('erp-resizing');
    };

    resizeHandlersRef.current = { move, up };
    document.body.classList.add('erp-resizing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <Layout className="erp-shell">
      <Sider width={siderWidth} theme="light" className="erp-sider">
        <div className="sider-logo">
          <img src={logoWanwuzhihui} alt="万物智汇 smart" />
        </div>
        <Menu
          mode="inline"
          className="erp-menu"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['master', 'master-base', 'master-config', 'production', 'inventory', 'line-side']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
        <div className="erp-sider-resize-handle" onMouseDown={handleResizeMouseDown} role="separator" aria-orientation="vertical" aria-label="调整侧边栏宽度" />
      </Sider>
      <Layout>
        <Header className="erp-header">
          <div className="header-left">
            <Button type="text" icon={<MenuFoldOutlined />} />
            <Breadcrumb items={breadcrumb.map((title) => ({ title }))} />
          </div>
          <div className="header-right">
            <Input className="header-search" prefix={<SearchOutlined />} placeholder="搜索   ⌘ K" />
            <Button type="text" icon={<ReloadOutlined />} />
            <Button type="text" icon={<SettingOutlined />} />
            <Button type="text" icon={<BellOutlined />} />
            <Select className="company-select" value="泉州宇极新材料科技有限公司" options={[{ value: '泉州宇极新材料科技有限公司', label: '泉州宇极新材料科技有限公司' }]} />
            <Avatar style={{ background: '#dbeafe', color: '#0f4c9a' }}>PM</Avatar>
          </div>
        </Header>
        <Content className="erp-content"><Outlet /></Content>
      </Layout>
    </Layout>
  );
}
