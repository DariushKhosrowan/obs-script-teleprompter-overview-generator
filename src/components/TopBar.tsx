import React from 'react';
import { PanelRight } from 'lucide-react';

export type ActiveTab = 'live' | 'steps' | 'obs';

interface TopBarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  dockMode: boolean;
  onToggleDockMode: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onChangeTab,
  dockMode,
  onToggleDockMode,
}) => {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'live', label: 'اجرای زنده' },
    { id: 'steps', label: 'مراحل و اسلایدها' },
    { id: 'obs', label: 'اتصال و خروجی OBS' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0D11]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-6">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onChangeTab('live');
          }}
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Hark Studio
        </a>

        <nav className="flex items-center gap-6 overflow-x-auto" aria-label="ناوبری اصلی">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded ${
                  isActive
                    ? 'text-amber-400'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-[13px] h-[2px] bg-amber-400" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onToggleDockMode}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#161A23] px-3.5 py-2 text-xs font-semibold text-slate-100 transition-colors hover:border-amber-400/50 hover:bg-[#1E2330] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <PanelRight className="h-3.5 w-3.5 text-amber-400" />
            <span>{dockMode ? 'نمای کامل استودیو' : 'نمای داک OBS'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
