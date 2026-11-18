import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { all, loadConfig, saveConfig, type Config, type Take, type Trial, type Voice } from './lib/db';
import { LESSONS, type Lesson } from './lib/curriculum';

interface Store {
  ready: boolean; takes: Take[]; lessons: Lesson[]; voices: Voice[]; trials: Trial[];
  cfg: Config; setCfg: (c: Config) => void; refresh: () => Promise<void>;
}
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState({ ready: false, takes: [] as Take[], custom: [] as Lesson[], voices: [] as Voice[], trials: [] as Trial[] });
  const [cfg, setCfgState] = useState(loadConfig);
  const refresh = useCallback(async () => {
    const [takes, custom, voices, trials] = await Promise.all([all('takes'), all('lessons'), all('voices'), all('trials')]);
    setData({ ready: true, takes, custom, voices, trials });
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const setCfg = useCallback((c: Config) => { saveConfig(c); setCfgState(c); }, []);
  const value = useMemo<Store>(() => ({
    ready: data.ready, takes: data.takes, lessons: [...LESSONS, ...data.custom], voices: data.voices, trials: data.trials, cfg, setCfg, refresh,
  }), [data, cfg, setCfg, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

export function useObjectUrl(blob?: Blob): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) { setUrl(undefined); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
