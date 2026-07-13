import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import 'antd-mobile/es/global';
import './styles/global.css';
import { App } from './app/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#004098',
          colorLink: '#004098',
          colorSuccess: '#00B42A',
          colorWarning: '#FF7D00',
          colorError: '#F53F3F',
          colorTextHeading: '#1D2129',
          colorText: '#4E5969',
          colorTextSecondary: '#86909C',
          colorBorder: '#DCDFE6',
          colorBorderSecondary: '#E5E6EB',
          colorBgLayout: '#F2F3F5',
          colorBgContainer: '#FFFFFF',
          colorFillAlter: '#F2F3F5',
          borderRadius: 4,
          fontSize: 14,
          controlHeight: 32,
          fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
        },
        components: {
          Button: {
            controlHeight: 32,
            controlHeightSM: 28,
            borderRadius: 4,
            paddingInline: 20,
            primaryShadow: 'none',
          },
          Table: {
            headerBg: '#F2F3F5',
            headerColor: '#1D2129',
            rowHoverBg: '#F7F8FA',
            borderColor: '#E5E6EB',
            cellPaddingBlock: 12,
            cellPaddingInline: 16,
          },
          Card: {
            borderRadiusLG: 4,
            paddingLG: 16,
            headerFontSize: 16,
          },
          Input: {
            controlHeight: 32,
            borderRadius: 4,
          },
          Select: {
            controlHeight: 32,
            borderRadius: 4,
          },
          DatePicker: {
            controlHeight: 32,
            borderRadius: 4,
          },
          InputNumber: {
            controlHeight: 32,
            borderRadius: 4,
          },
          Pagination: {
            itemActiveBg: '#004098',
          },
          Modal: {
            titleFontSize: 18,
            borderRadiusLG: 4,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
