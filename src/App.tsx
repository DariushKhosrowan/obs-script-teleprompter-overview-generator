import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_STEPS } from './data/defaultSteps';
import type { LayoutKey, ObsSettings, StudioStep, TakeRecord } from './types/studio';
import {
  clampStepIndex,
  computeActSummaries,
  computeTotalRecordedSec,
  getFirstStepIndexOfAct,
  getNextStepIndex,
  getPrevStepIndex,
} from './utils/persian';
import { obsClient, type ObsStatusSnapshot } from './utils/obsWebSocket';
import { TopBar, type ActiveTab } from './components/TopBar';
import { TeleprompterStage } from './components/TeleprompterStage';
import { SlidePreviewCard } from './components/SlidePreviewCard';
import { StepsEditorView } from './components/StepsEditorView';
import { ObsIntegrationView } from './components/ObsIntegrationView';

const STORAGE_STEPS_KEY = 'hark_studio_steps_v1';
const STORAGE_SETTINGS_KEY = 'hark_studio_settings_v1';
const STORAGE_TAKES_KEY = 'hark_studio_takes_v1';

const DEFAULT_SETTINGS: ObsSettings = {
  wsUrl: 'ws://127.0.0.1:4455',
  wsPassword: '',
  integrationMode: 'dock_ws',
  osTarget: 'linux',
  pollIntervalMs: 150,
  clickTextToAdvance: true,
  autoStudioPreviewSync: true,
  slideMotion: false,
  fontSizePx: 40,
  mirror: false,
  autoScroll: false,
  scrollSpeed: 1.2,
};

function loadSavedSteps(): StudioStep[] {
  try {
    const raw = localStorage.getItem(STORAGE_STEPS_KEY);
    if (!raw) return DEFAULT_STEPS;
    const parsed = JSON.parse(raw) as StudioStep[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // ignore storage errors
  }
  return DEFAULT_STEPS;
}

function loadSavedSettings(): ObsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ObsSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadSavedTakes(): TakeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_TAKES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TakeRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const initialQuery = useMemo(() => new URLSearchParams(window.location.search), []);
  const [steps, setSteps] = useState<StudioStep[]>(loadSavedSteps);
  const [settings, setSettings] = useState<ObsSettings>(loadSavedSettings);
  const [takes, setTakes] = useState<TakeRecord[]>(loadSavedTakes);

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const sParam = Number(initialQuery.get('s'));
    if (Number.isFinite(sParam) && sParam >= 1) {
      return clampStepIndex(sParam - 1, DEFAULT_STEPS.length);
    }
    return 0;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [dockMode, setDockMode] = useState<boolean>(
    () => initialQuery.get('dock') === '1'
  );
  const [overrideLayout, setOverrideLayout] = useState<LayoutKey | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [slideImages, setSlideImages] = useState<Record<number, string>>({});

  const [obsStatus, setObsStatus] = useState<ObsStatusSnapshot>(() =>
    obsClient.getSnapshot()
  );
  const [localRecordingActive, setLocalRecordingActive] = useState(false);
  const [localRecStartMs, setLocalRecStartMs] = useState<number | null>(null);
  const [localRecAct, setLocalRecAct] = useState<number>(1);

  useEffect(() => {
    return obsClient.subscribe(setObsStatus);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_STEPS_KEY, JSON.stringify(steps));
    } catch {
      // ignore
    }
  }, [steps]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TAKES_KEY, JSON.stringify(takes));
    } catch {
      // ignore
    }
  }, [takes]);

  const currentStep = steps[clampStepIndex(currentIndex, steps.length)] ?? steps[0];

  const triggerObsHotkey = useCallback((hotkeyName: string) => {
    if (obsClient.getSnapshot().status === 'connected') {
      void obsClient.triggerHotkey(hotkeyName).catch(() => {});
    }
  }, []);

  const handleNext = useCallback(() => {
    setOverrideLayout(null);
    setZoomed(false);
    setCurrentIndex((prev) => getNextStepIndex(prev, steps));
    triggerObsHotkey('hs_next');
  }, [steps, triggerObsHotkey]);

  const handlePrev = useCallback(() => {
    setOverrideLayout(null);
    setZoomed(false);
    setCurrentIndex((prev) => getPrevStepIndex(prev, steps));
    triggerObsHotkey('hs_prev');
  }, [steps, triggerObsHotkey]);

  const handleJumpToActStart = useCallback(
    (act: number) => {
      const targetIdx = getFirstStepIndexOfAct(act, steps);
      setOverrideLayout(null);
      setZoomed(false);
      setCurrentIndex(targetIdx);
      if (currentStep.act === act) {
        triggerObsHotkey('hs_rec');
      }
    },
    [steps, currentStep.act, triggerObsHotkey]
  );

  const handleOverrideLayout = useCallback(
    (layout: LayoutKey) => {
      setOverrideLayout((prev) => (prev === layout ? null : layout));
      const hk =
        layout === 'SLIDE' ? 'hs_slide' : layout === 'SCAM' ? 'hs_scam' : 'hs_cam';
      triggerObsHotkey(hk);
    },
    [triggerObsHotkey]
  );

  const handleToggleZoom = useCallback(() => {
    setZoomed((prev) => {
      const next = !prev;
      triggerObsHotkey(next ? 'hs_zoom' : 'hs_zout');
      return next;
    });
  }, [triggerObsHotkey]);

  const handleToggleRecord = useCallback(() => {
    if (obsClient.getSnapshot().status === 'connected') {
      void obsClient.toggleRecord().catch(() => {});
      return;
    }
    if (!localRecordingActive) {
      setLocalRecordingActive(true);
      setLocalRecStartMs(Date.now());
      setLocalRecAct(currentStep.act);
    } else {
      const stopSec = Math.floor(Date.now() / 1000);
      const startSec = localRecStartMs
        ? Math.floor(localRecStartMs / 1000)
        : stopSec;
      const actTakesCount = takes.filter((t) => t.act === localRecAct).length;
      setTakes((prev) => [
        ...prev,
        {
          act: localRecAct,
          take: actTakesCount + 1,
          start: startSec,
          stop: Math.max(startSec + 1, stopSec),
        },
      ]);
      setLocalRecordingActive(false);
      setLocalRecStartMs(null);
    }
  }, [localRecordingActive, localRecStartMs, localRecAct, currentStep.act, takes]);

  const handleUpdateSettings = useCallback((patch: Partial<ObsSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleUploadSlides = useCallback((files: FileList) => {
    const nextMap: Record<number, string> = {};
    Array.from(files).forEach((file) => {
      const match = file.name.match(/(\d+)/);
      if (match) {
        const num = Number(match[1]);
        if (num > 0) {
          nextMap[num] = URL.createObjectURL(file);
        }
      }
    });
    if (Object.keys(nextMap).length > 0) {
      setSlideImages((prev) => ({ ...prev, ...nextMap }));
    }
  }, []);

  // Global keyboard shortcuts matching OBS & prompter.html
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'PageDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'PageUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        handleUpdateSettings({ autoScroll: !settings.autoScroll });
      } else if (e.key === 'm' || e.key === 'M') {
        handleUpdateSettings({ mirror: !settings.mirror });
      } else if (e.key === '+' || e.key === '=') {
        handleUpdateSettings({ fontSizePx: Math.min(72, settings.fontSizePx + 4) });
      } else if (e.key === '-') {
        handleUpdateSettings({ fontSizePx: Math.max(22, settings.fontSizePx - 4) });
      } else if (e.key === 'F1') {
        e.preventDefault();
        handleOverrideLayout('SLIDE');
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleOverrideLayout('SCAM');
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleOverrideLayout('CAM');
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleToggleZoom();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleJumpToActStart(currentStep.act);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleNext,
    handlePrev,
    handleUpdateSettings,
    settings.autoScroll,
    settings.fontSizePx,
    settings.mirror,
    handleOverrideLayout,
    handleToggleZoom,
    handleJumpToActStart,
    currentStep.act,
  ]);

  const actSummaries = useMemo(
    () => computeActSummaries(steps, takes),
    [steps, takes]
  );
  const totalRecordedSec = useMemo(() => computeTotalRecordedSec(takes), [takes]);

  const handleUpdateStep = (index: number, patch: Partial<StudioStep>) => {
    setSteps((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const handleAddStepAfter = (index: number) => {
    setSteps((prev) => {
      const refStep = prev[index] ?? prev[0];
      const inserted: StudioStep = {
        n: index + 2,
        act: refStep.act,
        lay: refStep.lay,
        layoutKey: refStep.layoutKey,
        slide: refStep.slide,
        time: '',
        text: 'متن مرحله جدید را اینجا بنویسید...',
      };
      const next = [...prev.slice(0, index + 1), inserted, ...prev.slice(index + 1)];
      return next.map((s, i) => ({ ...s, n: i + 1 }));
    });
  };

  const handleDeleteStep = (index: number) => {
    setSteps((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, idx) => idx !== index);
      return next.map((s, i) => ({ ...s, n: i + 1 }));
    });
    setCurrentIndex((prev) => Math.max(0, Math.min(prev, steps.length - 2)));
  };

  const handleEnableStudioPreviewPrompter = async () => {
    try {
      await obsClient.setStudioMode(true);
      await obsClient.setPreviewScene('99 تلهپرامپتر (ضبط نمیشود)');
    } catch {
      // handled by obsStatus error if disconnected
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D11] text-slate-100">
      <TopBar
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setDockMode(false);
          setActiveTab(tab);
        }}
        dockMode={dockMode}
        onToggleDockMode={() => {
          setDockMode((d) => !d);
          setActiveTab('live');
        }}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        {dockMode ? (
          <div className="mx-auto max-w-[480px]">
            <TeleprompterStage
              steps={steps}
              currentIndex={clampStepIndex(currentIndex, steps.length)}
              settings={settings}
              obsStatus={obsStatus}
              actSummaries={actSummaries}
              totalRecordedSec={totalRecordedSec}
              localRecordingActive={localRecordingActive}
              localRecStartMs={localRecStartMs}
              onNext={handleNext}
              onPrev={handlePrev}
              onJumpToStep={(idx) => setCurrentIndex(clampStepIndex(idx, steps.length))}
              onJumpToActStart={handleJumpToActStart}
              onToggleRecord={handleToggleRecord}
              onUpdateSettings={handleUpdateSettings}
              compactDock
            />
          </div>
        ) : activeTab === 'live' ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <TeleprompterStage
                steps={steps}
                currentIndex={clampStepIndex(currentIndex, steps.length)}
                settings={settings}
                obsStatus={obsStatus}
                actSummaries={actSummaries}
                totalRecordedSec={totalRecordedSec}
                localRecordingActive={localRecordingActive}
                localRecStartMs={localRecStartMs}
                onNext={handleNext}
                onPrev={handlePrev}
                onJumpToStep={(idx) => setCurrentIndex(clampStepIndex(idx, steps.length))}
                onJumpToActStart={handleJumpToActStart}
                onToggleRecord={handleToggleRecord}
                onUpdateSettings={handleUpdateSettings}
              />
            </div>

            <div className="lg:col-span-5">
              <SlidePreviewCard
                step={currentStep}
                overrideLayout={overrideLayout}
                zoomed={zoomed}
                slideImages={slideImages}
                onUploadSlides={handleUploadSlides}
                onOverrideLayout={handleOverrideLayout}
                onToggleZoom={handleToggleZoom}
                onTriggerObsHotkey={triggerObsHotkey}
                onOpenObsExport={() => setActiveTab('obs')}
              />
            </div>
          </div>
        ) : activeTab === 'steps' ? (
          <StepsEditorView
            steps={steps}
            currentIndex={clampStepIndex(currentIndex, steps.length)}
            onSelectAndPlay={(idx) => {
              setCurrentIndex(clampStepIndex(idx, steps.length));
              setActiveTab('live');
            }}
            onUpdateStep={handleUpdateStep}
            onAddStepAfter={handleAddStepAfter}
            onDeleteStep={handleDeleteStep}
            onResetDefaultSteps={() => {
              setSteps(DEFAULT_STEPS);
              setCurrentIndex(0);
            }}
          />
        ) : (
          <ObsIntegrationView
            steps={steps}
            settings={settings}
            obsStatus={obsStatus}
            onUpdateSettings={handleUpdateSettings}
            onConnectObs={() => obsClient.connect(settings.wsUrl, settings.wsPassword)}
            onDisconnectObs={() => obsClient.disconnect()}
            onEnableStudioPreviewPrompter={handleEnableStudioPreviewPrompter}
          />
        )}
      </main>
    </div>
  );
}
