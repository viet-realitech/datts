import { useState } from 'react';
import { useStore } from './store';
import RecordView from './views/RecordView';
import LabView from './views/LabView';
import StudioView from './views/StudioView';
import PodcastView from './views/PodcastView';
import SettingsView from './views/SettingsView';

const TABS = [
  { id: 'record', label: 'Thu âm' },
  { id: 'lab', label: 'Thử mẫu' },
  { id: 'studio', label: 'Studio' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'settings', label: 'Dữ liệu' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export default function App() {
  const { ready } = useStore();
  const [tab, setTab] = useState<Tab>('record');
  return (
    <div className="app">
      <header className="top">
        <div className="brand"><img src="./icon.svg" alt="" width="28" height="28" />Datts</div>
        <nav role="tablist">
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>
      {!ready ? <main className="pad">Đang mở dữ liệu…</main>
        : tab === 'record' ? <RecordView />
        : tab === 'lab' ? <LabView goStudio={() => setTab('studio')} goSettings={() => setTab('settings')} />
        : tab === 'studio' ? <StudioView goLab={() => setTab('lab')} />
        : tab === 'podcast' ? <PodcastView goLab={() => setTab('lab')} goSettings={() => setTab('settings')} />
        : <SettingsView />}
    </div>
  );
}
