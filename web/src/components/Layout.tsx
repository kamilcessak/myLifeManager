import { ReactNode, useEffect, useState } from 'react';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import ChangelogModal from './ChangelogModal';
import MobileBottomNav from './mobile/MobileBottomNav';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isSidebarCollapsed]);

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="app-workspace">
        <AppSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <main className="app-main-area min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <MobileBottomNav />
      <ChangelogModal />
    </div>
  );
}
