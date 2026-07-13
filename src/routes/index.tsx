import { createHashRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { PcLayout } from '../layouts/PcLayout';
import { DeviceRunPage } from '../pages/app/DeviceRunPage';
import { FeedingPage } from '../pages/app/FeedingPage';
import { FormulaListPadPage } from '../pages/app/FormulaListPadPage';
import { FormulaRoutePadPage } from '../pages/app/FormulaRoutePadPage';
import { MaterialTransferPage } from '../pages/app/MaterialTransferPage';
import { PackagingPage } from '../pages/app/PackagingPage';
import { ProcessExecutionPadPage } from '../pages/app/ProcessExecutionPadPage';
import { QuickFeedPadPage } from '../pages/app/QuickFeedPadPage';
import { WorkOrderDetailPage } from '../pages/app/WorkOrderDetailPage';
import { WorkOrderListPage } from '../pages/app/WorkOrderListPage';
import { BarcodePage } from '../pages/pc/BarcodePage';
import { BatchWorkOrderPage } from '../pages/pc/BatchWorkOrderPage';
import { DashboardPage } from '../pages/pc/DashboardPage';
import { DemoControlPage } from '../pages/pc/DemoControlPage';
import { FormulaSheetPage } from '../pages/pc/FormulaSheetPage';
import { InventoryPage } from '../pages/pc/InventoryPage';
import { InventoryInboundPage } from '../pages/pc/InventoryInboundPage';
import { InventoryOutboundPage } from '../pages/pc/InventoryOutboundPage';
import { InventoryReservationPage } from '../pages/pc/InventoryReservationPage';
import { MaterialShortagePage } from '../pages/pc/MaterialShortagePage';
import { MaterialRequirementPage } from '../pages/pc/MaterialRequirementPage';
import { ProductionOrderPage } from '../pages/pc/ProductionOrderPage';
import { ProductionRecordPage } from '../pages/pc/ProductionRecordPage';
import { SalesOrderPage } from '../pages/pc/SalesOrderPage';
import { ScheduleOutputPage } from '../pages/pc/ScheduleOutputPage';
import { SchedulePage } from '../pages/pc/SchedulePage';
import { TankPage } from '../pages/pc/TankPage';
import { BaseMaterialPage } from '../pages/pc/master-data/BaseMaterialPage';
import { BaseMaterialColorPage } from '../pages/pc/master-data/BaseMaterialColorPage';
import { BaseMaterialCustomerPage } from '../pages/pc/master-data/BaseMaterialCustomerPage';
import { BaseMaterialUnitPage } from '../pages/pc/master-data/BaseMaterialUnitPage';
import { BaseMaterialDictionaryPage } from '../pages/pc/master-data/BaseMaterialDictionaryPage';
import { WorkshopPage } from '../pages/pc/master-data/WorkshopPage';
import { ProductionLinePage } from '../pages/pc/master-data/ProductionLinePage';
import { ProductionCalendarPage } from '../pages/pc/master-data/ProductionCalendarPage';
import { ProductionConfigPage } from '../pages/pc/master-data/ProductionConfigPage';
import { LineProductRelationPage } from '../pages/pc/master-data/LineProductRelationPage';
import { ProductGroupRelationPage } from '../pages/pc/master-data/ProductGroupRelationPage';
import { ProductionFormPage } from '../pages/pc/master-data/ProductionFormPage';
import { ProductionProcessPage } from '../pages/pc/master-data/ProductionProcessPage';
import { ProductionCraftPage } from '../pages/pc/master-data/ProductionCraftPage';
import { BomPage } from '../pages/pc/master-data/BomPage';

export const router = createHashRouter([
  {
    path: '/',
    element: <PcLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'demo', element: <DemoControlPage /> },
      { path: 'master/materials', element: <BaseMaterialPage /> },
      { path: 'master/colors', element: <BaseMaterialColorPage /> },
      { path: 'master/customers', element: <BaseMaterialCustomerPage /> },
      { path: 'master/units', element: <BaseMaterialUnitPage /> },
      { path: 'master/dict', element: <BaseMaterialDictionaryPage /> },
      { path: 'master/config/workshops', element: <WorkshopPage /> },
      { path: 'master/config/lines', element: <ProductionLinePage /> },
      { path: 'master/config/calendar', element: <ProductionCalendarPage /> },
      { path: 'master/config/mrp-rules', element: <ProductionConfigPage /> },
      { path: 'master/config/line-product-relations', element: <LineProductRelationPage /> },
      { path: 'master/config/product-group-relations', element: <ProductGroupRelationPage /> },
      { path: 'master/config/forms', element: <ProductionFormPage /> },
      { path: 'master/config/processes', element: <ProductionProcessPage /> },
      { path: 'master/config/crafts', element: <ProductionCraftPage /> },
      { path: 'master/config/bom', element: <BomPage /> },
      { path: 'sales-orders', element: <SalesOrderPage /> },
      { path: 'production-orders', element: <ProductionOrderPage /> },
      { path: 'requirements', element: <MaterialRequirementPage /> },
      { path: 'schedule', element: <SchedulePage /> },
      { path: 'schedule-outputs', element: <ScheduleOutputPage /> },
      { path: 'work-orders', element: <BatchWorkOrderPage /> },
      { path: 'formulas', element: <FormulaSheetPage /> },
      { path: 'records', element: <ProductionRecordPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'inventory/reservations', element: <InventoryReservationPage /> },
      { path: 'inventory/line-side', element: <Navigate to="/line-side" replace /> },
      { path: 'inventory/line-side/reservations', element: <Navigate to="/line-side/reservations" replace /> },
      { path: 'line-side', element: <InventoryPage title="线边仓即时库存" location="线边仓" /> },
      { path: 'line-side/reservations', element: <InventoryReservationPage title="MRP库存占用单" location="线边仓" /> },
      { path: 'inventory/shortages', element: <MaterialShortagePage /> },
      { path: 'inventory/inbound', element: <InventoryInboundPage /> },
      { path: 'inventory/outbound', element: <InventoryOutboundPage /> },
      { path: 'barcodes', element: <BarcodePage /> },
      { path: 'tanks', element: <TankPage /> },
    ],
  },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="work-orders" replace /> },
      { path: 'quick-feed', element: <QuickFeedPadPage /> },
      { path: 'formulas', element: <FormulaListPadPage /> },
      { path: 'formulas/:formulaId', element: <FormulaRoutePadPage /> },
      { path: 'formulas/:formulaId/processes/:nodeId', element: <ProcessExecutionPadPage /> },
      { path: 'work-orders', element: <WorkOrderListPage /> },
      { path: 'work-orders/:id', element: <WorkOrderDetailPage /> },
      { path: 'work-orders/:id/device', element: <DeviceRunPage /> },
      { path: 'work-orders/:id/feeding', element: <FeedingPage /> },
      { path: 'work-orders/:id/packaging', element: <PackagingPage /> },
      { path: 'transfer', element: <MaterialTransferPage /> },
    ],
  },
]);
