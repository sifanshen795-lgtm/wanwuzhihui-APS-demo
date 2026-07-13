import { NavBar, TabBar } from 'antd-mobile';
import { UnorderedListOutline, TruckOutline } from 'antd-mobile-icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="app-shell app-pad-shell">
      <NavBar onBack={() => navigate('/')}>MES 现场 PAD</NavBar>
      <div className="app-content"><Outlet /></div>
      <div className="app-tabbar-shell">
        <TabBar activeKey={location.pathname} onChange={(key) => navigate(key)}>
          <TabBar.Item key="/app/work-orders" icon={<UnorderedListOutline />} title="工单" />
          <TabBar.Item key="/app/transfer" icon={<TruckOutline />} title="转移" />
        </TabBar>
      </div>
    </div>
  );
}
