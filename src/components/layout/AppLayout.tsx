import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gis-darkest text-gis-textPrimary font-sans transition-colors duration-200">
      {/* Desktop Collapsible Sidebar */}
      <Sidebar />

      {/* Mobile Slide-over Drawer */}
      <MobileNav />

      {/* Main Operational Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Operations Header */}
        <Topbar />

        {/* Dynamic Viewport Content */}
        <main className="flex-1 overflow-y-auto bg-gis-darkest/95 relative transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
};
