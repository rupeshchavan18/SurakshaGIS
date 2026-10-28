import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardView } from './views/DashboardView';
import { HazardMapView } from './views/HazardMapView';
import { RiskAssessmentView } from './views/RiskAssessmentView';
import { RelocationSitesView } from './views/RelocationSitesView';
import { PriorityPlanningView } from './views/PriorityPlanningView';
import { ReportsView } from './views/ReportsView';
import { DatasetIntegrationView } from './views/DatasetIntegrationView';

const RouteRenderer: React.FC = () => {
  const { currentRoute } = useApp();

  switch (currentRoute) {
    case 'dashboard':
      return <DashboardView />;
    case 'hazard-map':
      return <HazardMapView />;
    case 'risk-assessment':
      return <RiskAssessmentView />;
    case 'relocation-sites':
      return <RelocationSitesView />;
    case 'priority-planning':
      return <PriorityPlanningView />;
    case 'reports':
      return <ReportsView />;
    case 'dataset-integration':
      return <DatasetIntegrationView />;
    default:
      return <DashboardView />;
  }
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppLayout>
        <RouteRenderer />
      </AppLayout>
    </AppProvider>
  );
};

export default App;
