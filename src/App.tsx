import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { makeT, langMeta, type Lang, type TFunc } from '@/lib/i18n';
import { exportCSV } from '@/lib/export';
import { getIconComponent } from '@/lib/theme';
import { applyAppTheme, buttonAccents, effectThemeOrder, isAppThemeId, resolveTheme, simpleThemeOrder, themeLabel, type AppThemeId } from '@/lib/themes';
import { clearGhostAttempts, hashGhostWord, isGhostSet, isValidGhostWord, verifyGhostWord } from '@/lib/recovery';
import type { View, Settings, Worker, Station, StationType, PriceRule, Product, Session, Transaction, Client, ClientPayment, Reminder, AuditLog, DailyArchive, SessionItem, Role } from '@/lib/types';
import { ArrowRight, Bell, BellRing, Calculator, Check, ChevronDown, CircleDollarSign, Coffee, Download, Gamepad2, Languages, LogOut, Menu, Package, Pencil, Plus, Settings as SettingsIcon, ShoppingBag, Trash2, UserRound, Users, X, Zap, Clock, AlertTriangle, ClipboardList, RotateCcw, Shield, Dices, Target, Trophy, Crown, Swords, Globe, Monitor, MapPin } from 'lucide-react';

const money = (v: number) => `${Math.round(v).toLocaleString()} DZD`;
const friendlyError = 'Something went wrong. Please try again.';

const GAME_COLORS = ['ocean', 'emerald', 'sunset', 'crimson', 'gold'] as const;
const CATEGORY_COLORS: Record<string, string> = { beverage: 'ocean', snack: 'emerald', accessory: 'crimson' };
const COLOR_STYLES: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  ocean: { bg: '#0c1828', text: '#08b5ee', border: '#162c49', iconBg: '#172c40' },
  emerald: { bg: '#0d2018', text: '#20d26c', border: '#1a3d2e', iconBg: '#102b21' },
  sunset: { bg: '#2a1606', text: '#ffb13b', border: '#3d2812', iconBg: '#221608' },
  crimson: { bg: '#2a0f12', text: '#ff4650', border: '#3d1518', iconBg: '#220c0e' },
  gold: { bg: '#2a2206', text: '#fbbf24', border: '#3d3312', iconBg: '#221c08' },
};
function colorStyle(color: string) { return COLOR_STYLES[color] ?? COLOR_STYLES.ocean; }
function previewBg(id: string) {
  const map: Record<string, string> = {
    crimson: 'linear-gradient(135deg,#160608 55%,#ff2d3f)',
    rose: 'linear-gradient(135deg,#170a10 55%,#fb7185)',
    ember: 'linear-gradient(135deg,#150c05 55%,#ffb13b)',
    royal: 'linear-gradient(135deg,#0e0a1e 55%,#a78bfa)',
    forest: 'linear-gradient(135deg,#06110c 55%,#34d399)',
    abyss: 'linear-gradient(135deg,#050b16 55%,#08b5ee)',
    mirror: 'linear-gradient(135deg,#05070d 30%,#7dd3fc 60%,#a78bfa 85%)',
    matrix: 'linear-gradient(135deg,#020503 55%,#22ff66)',
    playstation: 'linear-gradient(135deg,#04060f 30%,#0072ce 60%,#ff4d8d 90%)',
    xbox: 'linear-gradient(135deg,#030c04 40%,#5dc21e 75%,#9dff57)',
    versus: 'linear-gradient(90deg,#0072ce 0%,#8b5cf6 50%,#5dc21e 100%)',
    playstation_pro: 'linear-gradient(135deg,#02040e 25%,#0a84ff 55%,#ff6fa5 90%)',
    xbox_elite: 'linear-gradient(135deg,#020d03 35%,#4fae0a 65%,#d6ff8f)',
    versus_ultra: 'linear-gradient(90deg,#0a84ff 0%,#7c3aed 50%,#a4ff3f 100%)',
  };
  return map[id] ?? map.abyss;
}
function gameModeParty(rule?: { game_mode?: string } | null): boolean { return rule?.game_mode === 'party'; }

function formatTimer(total: number) {
  const h = Math.floor(total / 3600).toString().padStart(2, '0');
  const m = Math.floor(total % 3600 / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

let audioCtx: AudioContext | null = null;
function playBeep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* AudioContext not available */ }
}

type NotificationItem = { id: string; message: string; type: 'warning' | 'info' | 'danger'; targetView: View; linkKind?: 'product' | 'station' | 'client' | 'reminder'; linkId?: string | null };

function App() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<Role>('worker');
  const [workerName, setWorkerName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [view, setView] = useState<View>('control');
  const [mobileNav, setMobileNav] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [prices, setPrices] = useState<PriceRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [archives, setArchives] = useState<DailyArchive[]>([]);
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [stationTypes, setStationTypes] = useState<StationType[]>([]);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [notifDismissed, setNotifDismissed] = useState<Set<string>>(new Set());

  const lang: Lang = (settings?.language as Lang) || 'en';
  const t = useMemo(() => makeT(lang), [lang]);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mgmtMenuOpen, setMgmtMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dir = langMeta[lang].rtl ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    applyAppTheme(resolveTheme(settings?.theme, settings?.theme_color));
  }, [settings?.theme, settings?.theme_color]);

  async function changeLanguage(newLang: Lang) {
    setLangMenuOpen(false);
    if (newLang === lang) return;
    if (settings) {
      await supabase.from('app_settings').update({ language: newLang }).eq('id', settings.id).maybeSingle();
      setSettings({ ...settings, language: newLang });
    }
  }

  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: adminRows }] = await Promise.all([
        supabase.from('app_settings').select('*').maybeSingle(),
        supabase.from('app_workers').select('id,pin').eq('role', 'admin').eq('active', true),
      ]);
      const admins = ((adminRows as { id: string; pin: string }[] | null) ?? []);
      const hasPin = admins.some(a => !!a.pin);
      if (data) {
        const incoming = data as Settings;
        const theme = isAppThemeId(incoming.theme) && incoming.theme !== 'midnight' ? incoming.theme : 'abyss';
        const next = incoming.theme === theme ? incoming : { ...incoming, theme };
        setSettings(next);
        applyAppTheme(resolveTheme(next.theme, next.theme_color));
      }
      // First run: no admin PIN anywhere -> force one-time setup. Never again.
      if (!hasPin) {
        // Create the settings row if the database is brand new/empty.
        if (!data) {
          const { data: created } = await supabase.from('app_settings').insert({
            name: 'Max Gaming', admin_pin: '', worker_pin: '',
            theme: 'abyss', theme_color: 'emerald', icon: 'gamepad', language: 'en',
          }).select().maybeSingle();
          if (created) {
            setSettings(created as Settings);
            applyAppTheme(resolveTheme((created as Settings).theme, (created as Settings).theme_color));
          }
        }
        setNeedsSetup(true);
        setLoading(false);
        return;
      }
      const stored = sessionStorage.getItem('cafe_auth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Sessions expire after 12h; stale tokens are dropped and require a fresh PIN.
          if (parsed?.at && Date.now() - Number(parsed.at) > 12 * 60 * 60 * 1000) {
            sessionStorage.removeItem('cafe_auth');
          } else {
            const { data: worker } = await supabase.from('app_workers')
              .select('id, name, role, active')
              .eq('id', parsed.workerId)
              .maybeSingle();
            if (worker && worker.active && worker.role === parsed.role) {
              setAuthed(true);
              setRole(parsed.role);
              setWorkerName(worker.name);
              setWorkerId(parsed.workerId);
            } else {
              sessionStorage.removeItem('cafe_auth');
            }
          }
        } catch { sessionStorage.removeItem('cafe_auth'); }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadData();
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [authed]);

  // Heartbeat: ping every 30s to keep online status real
  useEffect(() => {
    if (!authed || !workerId) return;
    const heartbeat = window.setInterval(() => {
      supabase.from('app_workers').update({
        last_heartbeat_at: new Date().toISOString(), is_online: true,
      }).eq('id', workerId);
    }, 30000);
    return () => window.clearInterval(heartbeat);
  }, [authed, workerId]);

  // Reminder notification check
  useEffect(() => {
    if (!authed) return;
    const interval = window.setInterval(() => {
      setReminders(prev => {
        const now = Date.now();
        prev.forEach(r => {
          if (!r.completed && new Date(r.due_at).getTime() <= now) {
            const key = `reminder_${r.id}`;
            if (!notifDismissed.has(key)) {
              showBrowserNotif(t('reminder_due'), r.message);
              setNotifDismissed(prev => new Set(prev).add(key));
            }
          }
        });
        return prev;
      });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [authed, notifDismissed, t]);

  function showBrowserNotif(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  async function loadData() {
    setError('');
    const [s, w, st, pr, prod, ses, tx, cl, pmt, rm, lg, ar, si, sty] = await Promise.all([
      supabase.from('app_settings').select('*').maybeSingle(),
      supabase.from('app_workers').select('*').order('name'),
      supabase.from('app_stations').select('*').order('sort_order'),
      supabase.from('app_price_rules').select('*').order('station_type'),
      supabase.from('app_products').select('*').order('name'),
      supabase.from('app_sessions').select('*').neq('status', 'finished'),
      supabase.from('app_transactions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('app_clients').select('*').order('name'),
      supabase.from('app_client_payments').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('app_reminders').select('*').order('due_at'),
        supabase.from('app_audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('app_daily_archives').select('*').order('archive_date', { ascending: false }),
      supabase.from('app_session_items').select('*').order('created_at', { ascending: true }),
      supabase.from('app_station_types').select('*').order('sort_order'),
    ]);
    if (sty.data) setStationTypes(sty.data as StationType[] ?? []);
    if (s.data) {
      const incoming = s.data as Settings;
      // Migrate old installs: unknown/legacy theme values fall back to Ocean.
      const theme = isAppThemeId(incoming.theme) && incoming.theme !== 'midnight' ? incoming.theme : 'abyss';
      const next = incoming.theme === theme ? incoming : { ...incoming, theme };
      setSettings(next);
      applyAppTheme(resolveTheme(next.theme, next.theme_color));
    }
    if (w.data) setWorkers(w.data as Worker[] ?? []);
    if (st.data) setStations(st.data as Station[] ?? []);
    if (pr.data) setPrices(pr.data as PriceRule[] ?? []);
    if (prod.data) setProducts(prod.data as Product[] ?? []);
    if (ses.data) setSessions(ses.data as Session[] ?? []);
    if (tx.data) setTransactions(tx.data as Transaction[] ?? []);
    if (cl.data) setClients(cl.data as Client[] ?? []);
    if (pmt.data) setPayments(pmt.data as ClientPayment[] ?? []);
    if (rm.data) setReminders(rm.data as Reminder[] ?? []);
    if (lg.data) setLogs(lg.data as AuditLog[] ?? []);
    if (ar.data) setArchives(ar.data as DailyArchive[] ?? []);
    if (si.data) setSessionItems(si.data as SessionItem[] ?? []);
  }

  // === Station Type & Station operations ===
  async function addStationType(name: string, label: string, color: string) {
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_');
    const { error: e } = await supabase.from('app_station_types').insert({
      name: cleanName, label: label.trim() || name.trim(), color,
      sort_order: stationTypes.length + 1,
    });
    if (e) { setError(e.message); return; }
    await addLog('Station type added', 'station_type', undefined, { name: cleanName, label }, { name: cleanName });
    await loadData();
  }

  async function deleteStationType(stationType: StationType) {
    const { error: e } = await supabase.from('app_station_types').delete().eq('id', stationType.id);
    if (e) { setError(e.message); return; }
    await supabase.from('app_stations').delete().eq('type', stationType.name);
    await addLog('Station type deleted', 'station_type', stationType as unknown as Record<string, unknown>, undefined, { name: stationType.name });
    await loadData();
  }

  async function addStation(name: string, type: string, sortOrder: number) {
    const { error: e } = await supabase.from('app_stations').insert({
      name: name.trim(), type, status: 'available', sort_order: sortOrder,
    });
    if (e) { setError(e.message); return; }
    await addLog('Station added', 'station', undefined, { name, type }, { name, type });
    await loadData();
  }

  async function deleteStation(station: Station) {
    const { error: e } = await supabase.from('app_stations').delete().eq('id', station.id);
    if (e) { setError(e.message); return; }
    await addLog('Station deleted', 'station', station as unknown as Record<string, unknown>, undefined, { name: station.name });
    await loadData();
  }

  async function addLog(action: string, entity?: string, oldVal?: Record<string, unknown>, newVal?: Record<string, unknown>, details?: Record<string, string>) {
    await supabase.from('app_audit_logs').insert({
      worker_name: workerName,
      action, entity,
      old_value: oldVal ?? null,
      new_value: newVal ?? null,
      details: details ?? {},
    });
  }

  function logout() {
    if (workerId) {
      supabase.from('app_workers').update({
        is_online: false, last_heartbeat_at: null, session_started_at: null,
      }).eq('id', workerId).then(() => loadData());
    }
    sessionStorage.removeItem('cafe_auth');
    setAuthed(false);
    setRole('worker');
    setWorkerName('');
    setWorkerId('');
  }

  // Midnight archiving: check every 60s if day changed, archive yesterday's data
  const [lastArchivedDate, setLastArchivedDate] = useState(new Date().toDateString());
  useEffect(() => {
    if (!authed) return;
    const interval = window.setInterval(async () => {
      const today = new Date().toDateString();
      if (today === lastArchivedDate) return;
      // Day changed — archive yesterday's data
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const ydStr = yesterday.toDateString();
      const ydDateOnly = yesterday.toISOString().slice(0, 10);
      // Check if already archived
      const { data: existing } = await supabase.from('app_daily_archives').select('id').eq('archive_date', ydDateOnly).maybeSingle();
      if (existing) { setLastArchivedDate(today); return; }
      // Fetch all transactions for yesterday
      const { data: yTx } = await supabase.from('app_transactions').select('*').order('created_at', { ascending: false });
      const yTxFiltered = (yTx as Transaction[] ?? []).filter(tx => new Date(tx.created_at).toDateString() === ydStr);
      const { data: yPmt } = await supabase.from('app_client_payments').select('*').order('created_at', { ascending: false });
      const yPmtFiltered = (yPmt as ClientPayment[] ?? []).filter(p => new Date(p.created_at).toDateString() === ydStr);
      const { data: ySes } = await supabase.from('app_sessions').select('*');
      const ySesCount = (ySes as Session[] ?? []).filter(s => new Date(s.started_at).toDateString() === ydStr).length;
      const { data: yClients } = await supabase.from('app_clients').select('*');
      const outstanding = (yClients as Client[] ?? []).reduce((s, c) => s + Number(c.balance), 0);
      const totalRev = yTxFiltered.reduce((s, tx) => s + Number(tx.total), 0);
      const gameRev = yTxFiltered.filter(tx => tx.source === 'session').reduce((s, tx) => s + Number(tx.total), 0);
      const bevRev = yTxFiltered.filter(tx => tx.source === 'sale' || tx.source === 'calculator').reduce((s, tx) => s + Number(tx.total), 0);
      const pmtTotal = yPmtFiltered.reduce((s, p) => s + Number(p.amount), 0);
      await supabase.from('app_daily_archives').insert({
        archive_date: ydDateOnly,
        total_revenue: totalRev,
        gaming_revenue: gameRev,
        beverage_revenue: bevRev,
        payments_total: pmtTotal,
        sessions_count: ySesCount,
        transactions_count: yTxFiltered.length,
        outstanding_amount: outstanding,
        transactions_json: yTxFiltered,
      });
      setLastArchivedDate(today);
      await loadData();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [authed, lastArchivedDate]);

  // Compute notifications — every item links to the exact place that owns it:
  // stock/price -> Storage, maintenance -> Control Panel, due reminder -> Reminders.
  const notifications: NotificationItem[] = useMemo(() => {
    const items: NotificationItem[] = [];
    products.forEach(p => {
      if (p.total_units === 0) items.push({ id: `stock_out_${p.id}`, message: `${p.name}: ${t('out_of_stock')}`, type: 'danger', targetView: 'storage', linkKind: 'product', linkId: p.id });
      else if (p.total_units <= 5) items.push({ id: `stock_low_${p.id}`, message: `${p.name}: ${t('low_stock')} (${p.total_units} ${t('units')})`, type: 'warning', targetView: 'storage', linkKind: 'product', linkId: p.id });
      if (p.selling_price === 0) items.push({ id: `no_price_${p.id}`, message: `${p.name}: ${t('missing_price')}`, type: 'warning', targetView: 'storage', linkKind: 'product', linkId: p.id });
    });
    stations.forEach(s => {
      if (s.status === 'maintenance') items.push({ id: `maint_${s.id}`, message: `${s.name}: ${t('maintenance')}`, type: 'info', targetView: 'control', linkKind: 'station', linkId: s.id });
    });
    reminders.forEach(r => {
      if (r.completed) return;
      const dueMs = new Date(r.due_at).getTime();
      if (Number.isNaN(dueMs)) return;
      const linkedMissing =
        (r.link_kind === 'product' && r.link_id && !products.some(p => p.id === r.link_id)) ||
        (r.link_kind === 'station' && r.link_id && !stations.some(s => s.id === r.link_id)) ||
        (r.link_kind === 'client' && r.link_id && !clients.some(c => c.id === r.link_id));
      // Stale link (points at something deleted) is hidden instead of haunting the bell.
      if (linkedMissing) return;
      if (dueMs <= Date.now())
        items.push({ id: `reminder_${r.id}`, message: `${t('reminder_due')}: ${r.message}`, type: 'warning', targetView: 'reminders', linkKind: 'reminder', linkId: r.id });
    });
    return items;
  }, [products, stations, reminders, clients, t]);

  // Close dropdowns on outside click — must be before any early return to satisfy Rules of Hooks
  useEffect(() => {
    if (!mgmtMenuOpen && !settingsMenuOpen) return;
    const handler = () => { setMgmtMenuOpen(false); setSettingsMenuOpen(false); };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [mgmtMenuOpen, settingsMenuOpen]);

  async function completeSetup(adminPin: string, workerPin: string, subPin: string) {
    const { data: sRow } = await supabase.from('app_settings').select('*').maybeSingle();
    const sId = (sRow as Settings | null)?.id ?? settings?.id;
    if (sId) {
      await supabase.from('app_settings').update({ admin_pin: adminPin, worker_pin: workerPin }).eq('id', sId);
    }
    // Deactivate any PIN-less admin placeholders so only the new PIN can log in.
    await supabase.from('app_workers').update({ active: false }).eq('role', 'admin');
    const mk = async (name: string, role: Role, pin: string) => {
      if (!pin) return;
      const { data: existing } = await supabase.from('app_workers').select('id,pin').eq('role', role).eq('active', true);
      const row = (((existing as { id: string; pin: string }[] | null) ?? [])[0]);
      if (row) await supabase.from('app_workers').update({ pin: hashPin(pin), active: true, name }).eq('id', row.id);
      else await supabase.from('app_workers').insert({ name, role, pin: hashPin(pin), active: true });
    };
    await mk('Admin', 'admin', adminPin);
    await mk('Yacine', 'worker', workerPin);
    if (subPin) await mk('Karim', 'sub_admin', subPin);
    const { data: fresh } = await supabase.from('app_settings').select('*').maybeSingle();
    if (fresh) setSettings(fresh as Settings);
    setNeedsSetup(false);
    setLoading(false);
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>Loading...</div>;
  if (needsSetup) return <FirstRunSetup onDone={(a, w, s) => { setLoading(true); completeSetup(a, w, s).catch(() => setLoading(false)); }} t={t} />;
  if (!authed) return <PinAuth settings={settings} onSuccess={(r, wn, wid) => { setAuthed(true); setRole(r); setWorkerName(wn); setWorkerId(wid); }} t={t} />;

  const isAdmin = role === 'admin';
  const isAdminOrSub = role === 'admin' || role === 'sub_admin';

  const directNav: { id: View; label: string; icon: typeof Gamepad2 }[] = [
    { id: 'control', label: t('control_panel'), icon: Gamepad2 },
    { id: 'beverages', label: t('beverages'), icon: Coffee },
    { id: 'prices', label: t('game_prices'), icon: Zap },
    { id: 'summary', label: t('daily_summary'), icon: CircleDollarSign },
    { id: 'calculator', label: t('calculator'), icon: Calculator },
    { id: 'storage', label: t('storage'), icon: Package },
  ];

  const mgmtItems: { id: View; label: string; icon: typeof Gamepad2; adminOnly?: boolean }[] = [
    { id: 'clients', label: t('clients'), icon: UserRound },
    { id: 'reminders', label: t('reminders'), icon: Clock },
    { id: 'workers', label: t('workers'), icon: Users },
  ];
  const visibleMgmt = mgmtItems.filter(n => !n.adminOnly || isAdmin);

  const settingsItems: { id: View; label: string; icon: typeof Gamepad2; adminOrSub?: boolean; adminOnly?: boolean }[] = [
    { id: 'settings', label: t('general_settings'), icon: SettingsIcon, adminOnly: true },
    { id: 'admin', label: t('admin_panel'), icon: Shield, adminOrSub: true },
    { id: 'full-log', label: t('full_log'), icon: Download },
    { id: 'log-management', label: t('log_management'), icon: Pencil, adminOnly: true },
  ];
  const visibleSettings = settingsItems.filter(n => (!n.adminOnly || isAdmin) && (!n.adminOrSub || isAdminOrSub));

  function navButtonClass(active: boolean) {
    return `flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-150 ${active ? 'bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent-dark)] font-semibold text-[#05100a] shadow-[0_10px_24px_-10px_var(--accent)]' : 'hover:-translate-y-px'}`;
  }

  return <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--ink)' }}>
    <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ borderColor: 'var(--line-soft)', background: 'var(--header)' }}>
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost lg:hidden" onClick={() => setMobileNav(!mobileNav)}><Menu size={18} /></button>
          <div className="logo-shine flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--accent)', color: '#06100b', boxShadow: '0 0 16px var(--accent)' }}>{(() => { const Icon = getIconComponent(settings?.icon ?? 'gamepad'); return <Icon size={20} />; })()}</div>
          <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{settings?.name ?? 'Max Gaming'}</span>
          <span className="hidden border-l pl-3 text-sm sm:block" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>{workerName}</span>
          <span className="ml-2 rounded-full px-2 py-1 text-xs font-semibold" style={{ background: 'var(--accent)', color: '#06100b' }}>{role === 'admin' ? t('admin') : role === 'sub_admin' ? t('sub_admin') : t('worker')}</span>
        </div>
        <div className="relative flex items-center gap-2">
          <div className="relative">
            <button className="btn btn-ghost p-2 text-base" title={t('language')} onClick={(e) => { e.stopPropagation(); setLangMenuOpen(!langMenuOpen); }}>
              <span className="text-lg leading-none">{langMeta[lang].flag}</span>
            </button>
            {langMenuOpen && (
              <div className="panel absolute right-0 top-full z-[70] mt-2 w-40 p-2" style={{ boxShadow: '0 24px 60px -12px rgba(0,0,0,0.8)' }}>
                {(Object.keys(langMeta) as Lang[]).map(l => (
                  <button key={l} onClick={(e) => { e.stopPropagation(); changeLanguage(l); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition" style={l === lang ? { background: 'var(--accent)', color: '#06100b', fontWeight: 700 } : { color: 'var(--ink)' }}>
                    <span className="text-lg leading-none">{langMeta[l].flag}</span>
                    <span>{langMeta[l].label}</span>
                    {l === lang && <Check size={14} className="ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-ghost p-2 relative" title={t('notifications')} onClick={() => setShowNotifPanel(!showNotifPanel)}>
            {notifications.length > 0 ? <BellRing size={17} /> : <Bell size={17} />}
            {notifications.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ff4650] text-[10px] font-bold text-white">{notifications.length}</span>}
          </button>
          {showNotifPanel && (
            <div className="panel absolute right-0 top-full z-[70] mt-2 w-80 p-3" style={{ boxShadow: '0 24px 60px -12px rgba(0,0,0,0.8)' }}>
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold">{t('notifications')}</span><button onClick={() => setShowNotifPanel(false)}><X size={15} /></button></div>
              {notifications.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">All clear.</p> : <div className="max-h-72 space-y-2 overflow-y-auto">{notifications.map(n => <button key={n.id} onClick={() => { setView(n.targetView); setShowNotifPanel(false); setMobileNav(false); }} className={`flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm transition hover:brightness-125 ${n.type === 'danger' ? 'bg-red-950/40 text-red-300' : n.type === 'warning' ? 'bg-amber-950/30 text-amber-300' : 'bg-blue-950/30 text-blue-300'}`} title={t('go_to_source')}><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span>{n.message}</span></button>)}</div>}
            </div>
          )}
          <button className="btn btn-ghost p-2" onClick={logout} title={t('logout')}><LogOut size={17} /></button>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-[1500px] px-3 py-4 lg:px-6">
      <nav className={`${mobileNav ? 'flex' : 'hidden'} panel relative z-30 mb-5 flex-col gap-1 p-2 lg:flex lg:flex-row lg:items-center lg:justify-center lg:gap-1`}>
        {directNav.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => { setView(item.id); setMobileNav(false); }} className={navButtonClass(view === item.id)}><Icon size={16} />{item.label}</button>; })}

        {visibleMgmt.length > 0 && (
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setMgmtMenuOpen(!mgmtMenuOpen)} className={navButtonClass(['clients', 'reminders', 'workers'].includes(view))}>
              <ClipboardList size={16} />{t('management')}<ChevronDown size={14} className={`transition ${mgmtMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {mgmtMenuOpen && (
              <div className="panel absolute left-0 top-full z-[70] mt-1 w-48 p-2" style={{ boxShadow: '0 24px 60px -12px rgba(0,0,0,0.8)' }}>
                {visibleMgmt.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => { setView(item.id); setMgmtMenuOpen(false); setMobileNav(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition" style={view === item.id ? { background: 'var(--accent)', color: '#06100b', fontWeight: 700 } : { color: 'var(--ink)' }}><Icon size={16} />{item.label}</button>; })}
              </div>
            )}
          </div>
        )}

        {visibleSettings.length > 0 && (
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSettingsMenuOpen(!settingsMenuOpen)} className={navButtonClass(['settings', 'full-log', 'log-management', 'admin'].includes(view))}>
              <SettingsIcon size={16} />{t('settings')}<ChevronDown size={14} className={`transition ${settingsMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {settingsMenuOpen && (
              <div className="panel absolute left-0 top-full z-[70] mt-1 w-48 p-2" style={{ boxShadow: '0 24px 60px -12px rgba(0,0,0,0.8)' }}>
                {visibleSettings.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => { setView(item.id); setSettingsMenuOpen(false); setMobileNav(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition" style={view === item.id ? { background: 'var(--accent)', color: '#06100b', fontWeight: 700 } : { color: 'var(--ink)' }}><Icon size={16} />{item.label}</button>; })}
              </div>
            )}
          </div>
        )}
      </nav>
      {error && <div className="mb-4 flex items-center justify-between rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}<button onClick={() => setError('')}><X size={16} /></button></div>}
      {view === 'control' && <ControlView stations={stations} stationTypes={stationTypes} sessions={sessions} prices={prices} products={products} sessionItems={sessionItems} tick={tick} workerName={workerName} onStart={startStation} onPause={togglePause} onFinish={finishStation} onCancelSession={cancelSession} onSetStatus={setStationStatus} onAddItem={addSessionItem} onRemoveItem={removeSessionItem} onUpdateItem={updateSessionItem} onAddCustom={addCustomSessionItem} t={t} />}
      {view === 'beverages' && <BeveragesView products={products} onSave={saveProduct} onRestock={restock} onSell={sellProduct} onEditPrice={editProductPrice} workerName={workerName} t={t} />}
      {view === 'prices' && <PricesView prices={prices} stations={stations} stationTypes={stationTypes} onSave={savePrice} onDelete={deletePrice} onDeleteAll={deleteAllPrices} onVerifyAdminPin={verifyAdminPin} isAdmin={isAdmin} t={t} />}
      {view === 'summary' && <SummaryView transactions={transactions} sessions={sessions} stations={stations} products={products} clients={clients} payments={payments} t={t} />}
      {view === 'full-log' && <FullLogView archives={archives} t={t} />}
      {view === 'log-management' && <LogManagementView logs={logs} t={t} />}
      {view === 'calculator' && <CalculatorView prices={prices} products={products} stationTypes={stationTypes} workerName={workerName} onSaved={loadData} onLog={addLog} t={t} />}
      {view === 'storage' && <StorageView products={products} onSave={saveProduct} onRestock={restock} onEdit={editProduct} onDelete={deleteProduct} onDeleteAll={deleteAllProducts} onVerifyAdminPin={verifyAdminPin} t={t} />}
      {view === 'clients' && <ClientsView clients={clients} payments={payments} onSave={addClient} onEdit={editClient} onPayment={recordPayment} workerName={workerName} onLog={addLog} t={t} />}
      {view === 'reminders' && <RemindersView reminders={reminders} products={products} stations={stations} clients={clients} onSave={addReminder} onEdit={editReminder} onDelete={deleteReminder} onToggle={toggleReminder} onGoto={(v) => { setView(v); setMobileNav(false); }} t={t} />}
      {view === 'workers' && <WorkersView workers={workers} t={t} />}
      {view === 'admin' && isAdminOrSub && settings && <AdminView workers={workers} settings={settings} currentRole={role} currentWorkerId={workerId} onSaveWorker={addWorker} onEditWorker={editWorker} onDeleteWorker={deleteWorker} onSaveSettings={saveSettings} onLog={addLog} t={t} />}
      {view === 'settings' && isAdmin && settings && <SettingsView settings={settings} stationTypes={stationTypes} stations={stations} onSave={saveSettings} onReset={resetFinancialData} onAddStationType={addStationType} onDeleteStationType={deleteStationType} onAddStation={addStation} onDeleteStation={deleteStation} onLog={addLog} t={t} />}
    </div>
  </div>;

  // === Station operations ===
  async function startStation(station: Station) {
    const rule = prices.find(p => p.station_type === station.type) ?? prices[0];
    const { data, error: e } = await supabase.from('app_sessions').insert({
      station_id: station.id, station_name: station.name, worker_name: workerName,
      price_rule_id: rule?.id ?? null, status: 'running',
    }).select().maybeSingle();
    if (e || !data) { setError(e?.message || friendlyError); return; }
    const { error: se } = await supabase.from('app_stations').update({ status: 'in_use' }).eq('id', station.id);
    if (se) { setError(se.message); return; }
    await addLog('Session started', 'session', undefined, { station: station.name }, { station: station.name, worker: workerName });
    await loadData();
  }

  async function togglePause(station: Station) {
    const active = sessions.find(s => s.station_id === station.id);
    if (!active) return;
    const next = active.status === 'paused' ? 'running' : 'paused';
    const { error: e1 } = await supabase.from('app_sessions').update({
      status: next,
      paused_at: next === 'paused' ? new Date().toISOString() : null,
    }).eq('id', active.id);
    if (e1) { setError(e1.message); return; }
    const { error: e2 } = await supabase.from('app_stations').update({ status: next }).eq('id', station.id);
    if (e2) { setError(e2.message); return; }
    await addLog(next === 'paused' ? 'Session paused' : 'Session resumed', 'session', { status: active.status }, { status: next }, { station: station.name });
    await loadData();
  }

  async function addSessionItem(sessionId: string, itemType: 'game' | 'product', label: string, unitPrice: number, isProlongation: boolean, product?: Product, priceRule?: PriceRule) {
    if (itemType === 'game') {
      const { data: activeGames } = await supabase.from('app_session_items')
        .select('id').eq('session_id', sessionId).eq('item_type', 'game').is('game_ended_at', null);
      if (activeGames && activeGames.length > 0) {
        await supabase.from('app_session_items').update({ game_ended_at: new Date().toISOString() })
          .in('id', activeGames.map(g => g.id));
      }
    }
    const insertData: Record<string, unknown> = {
      session_id: sessionId, item_type: itemType, label, unit_price: unitPrice, is_prolongation: isProlongation,
    };
    if (priceRule && itemType === 'game') {
      insertData.price_rule_id = priceRule.id;
      insertData.match_count = 0;
      insertData.prolongation_count = 0;
      insertData.party_count = gameModeParty(priceRule) ? 1 : 0;
      insertData.match_price = priceRule.game_mode === 'football' ? Number(priceRule.match_price || priceRule.price) : 0;
      insertData.prolongation_price = priceRule.game_mode === 'football' ? Number(priceRule.prolongation_price || 0) : 0;
      insertData.duration_minutes = priceRule.duration_minutes;
      insertData.notification_minutes = priceRule.notification_minutes;
      if (!gameModeParty(priceRule)) insertData.game_started_at = new Date().toISOString();
    }
    const { error: e } = await supabase.from('app_session_items').insert(insertData);
    if (e) { setError(e.message); return; }
    if (product && itemType === 'product') {
      const newTotal = Math.max(0, product.total_units - 1);
      await supabase.from('app_products').update({ total_units: newTotal }).eq('id', product.id);
    }
    await loadData();
  }

  async function addCustomSessionItem(sessionId: string, label: string, price: number) {
    const { error: e } = await supabase.from('app_session_items').insert({
      session_id: sessionId, item_type: 'product', label, unit_price: price, is_prolongation: false,
    });
    if (e) { setError(e.message); return; }
    await loadData();
  }

  async function updateSessionItem(itemId: string, updates: Partial<SessionItem>) {
    const { error: e } = await supabase.from('app_session_items').update(updates).eq('id', itemId);
    if (e) { setError(e.message); return; }
    await loadData();
  }

  async function removeSessionItem(itemId: string) {
    const { error: e } = await supabase.from('app_session_items').delete().eq('id', itemId);
    if (e) { setError(e.message); return; }
    await loadData();
  }

  async function finishStation(station: Station, amountPaid?: number) {
    const active = sessions.find(s => s.station_id === station.id);
    if (!active) return;
    const items = sessionItems.filter(si => si.session_id === active.id);
    const itemsTotal = items.reduce((s, item) => {
      if (item.item_type === 'game' && item.party_count !== undefined && item.party_count > 0) {
        return s + Number(item.unit_price) * item.party_count;
      }
      if (item.item_type === 'game' && item.match_count !== undefined) {
        return s + Number(item.match_price) * item.match_count + Number(item.prolongation_price) * item.prolongation_count;
      }
      return s + Number(item.unit_price) * item.quantity;
    }, 0);
    const total = itemsTotal;
    const paid = amountPaid && amountPaid > 0 ? amountPaid : total;
    const { error: e } = await supabase.from('app_sessions').update({
      status: 'finished', ended_at: new Date().toISOString(), total,
    }).eq('id', active.id);
    if (e) { setError(e.message); return; }
    const { data: txData } = await supabase.from('app_transactions').insert({
      source: 'session', worker_name: workerName, total, paid,
    }).select().maybeSingle();
    if (txData && items.length > 0) {
      await supabase.from('app_transaction_items').insert(items.map(item => ({
        transaction_id: txData.id, item_type: item.item_type, label: item.label, quantity: item.quantity, unit_price: item.unit_price,
      })));
    }
    await supabase.from('app_session_items').delete().eq('session_id', active.id);
    await supabase.from('app_stations').update({ status: 'available' }).eq('id', station.id);
    await addLog('Session finished', 'session', undefined, { station: station.name, total: String(total), items: String(itemsTotal) }, { station: station.name, total: String(total), worker: workerName });
    await loadData();
  }

  async function cancelSession(station: Station) {
    const active = sessions.find(s => s.station_id === station.id);
    if (!active) return;
    await supabase.from('app_session_items').delete().eq('session_id', active.id);
    await supabase.from('app_sessions').delete().eq('id', active.id);
    await supabase.from('app_stations').update({ status: 'available' }).eq('id', station.id);
    await addLog('Session cancelled', 'session', undefined, undefined, { station: station.name, worker: workerName });
    await loadData();
  }

  async function setStationStatus(station: Station, status: string) {
    const { error: e } = await supabase.from('app_stations').update({ status }).eq('id', station.id);
    if (e) { setError(e.message); return; }
    await addLog('Station status changed', 'station', { status: station.status }, { status }, { station: station.name });
    await loadData();
  }

  // === Product operations ===
  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      name: String(form.get('name')), category: String(form.get('category')),
      units_per_box: 1, total_units: Number(form.get('total_units')),
      purchase_price: Number(form.get('purchase')), selling_price: Number(form.get('selling')),
      color: String(form.get('color') || 'ocean'),
    };
    const { error: err } = await supabase.from('app_products').insert(payload);
    if (err) { setError(err.message); return; }
    await addLog('Product added', 'product', undefined, payload, { name: payload.name });
    formEl.reset();
    await loadData();
  }

  async function restock(product: Product, units: number) {
    const newTotal = product.total_units + units;
    const { error: e } = await supabase.from('app_products').update({ total_units: newTotal }).eq('id', product.id);
    if (e) { setError(e.message); return; }
    await addLog('Stock added', 'product', { total_units: product.total_units }, { total_units: newTotal }, { name: product.name, units: String(units) });
    await loadData();
  }

  async function sellProduct(product: Product, qty: number) {
    const newTotal = Math.max(0, product.total_units - qty);
    const total = Number(product.selling_price) * qty;
    const { error: e1 } = await supabase.from('app_products').update({ total_units: newTotal }).eq('id', product.id);
    if (e1) { setError(e1.message); return; }
    const { data, error: e2 } = await supabase.from('app_transactions').insert({
      source: 'sale', worker_name: workerName, total, paid: total,
    }).select().maybeSingle();
    if (e2) { setError(e2.message); return; }
    if (data) {
      await supabase.from('app_transaction_items').insert({
        transaction_id: data.id, item_type: 'product', label: product.name, quantity: qty, unit_price: product.selling_price,
      });
    }
    await addLog('Product sold', 'product', { total_units: product.total_units }, { total_units: newTotal }, { name: product.name, qty: String(qty), total: String(total) });
    await loadData();
  }

  async function editProductPrice(product: Product, newPrice: number) {
    const { error: e } = await supabase.from('app_products').update({ selling_price: newPrice }).eq('id', product.id);
    if (e) { setError(e.message); return; }
    await addLog('Price changed', 'product', { selling_price: product.selling_price }, { selling_price: newPrice }, { name: product.name });
    await loadData();
  }

  async function editProduct(product: Product, updates: Partial<Product>) {
    const { error: e } = await supabase.from('app_products').update(updates).eq('id', product.id);
    if (e) { setError(e.message); return; }
    await addLog('Product edited', 'product', product as unknown as Record<string, unknown>, updates as Record<string, unknown>, { name: product.name });
    await loadData();
  }

  async function deleteProduct(product: Product) {
    const { error: e } = await supabase.from('app_products').delete().eq('id', product.id);
    if (e) { setError(e.message); return; }
    await addLog('Product deleted', 'product', product as unknown as Record<string, unknown>, undefined, { name: product.name });
    await loadData();
  }

  // === Price operations ===
  async function savePrice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const gameMode = String(form.get('game_mode') || 'standard') as 'standard' | 'football' | 'party';
    const payload: Record<string, unknown> = {
      station_type: String(form.get('category')), label: String(form.get('label')),
      duration_minutes: gameMode === 'party' ? 0 : Number(form.get('duration')), price: Number(form.get('price')),
      notes: String(form.get('notes') || ''),
      game_mode: gameMode,
      match_price: gameMode === 'football' ? Number(form.get('match_price') || 0) : 0,
      prolongation_price: gameMode === 'football' ? Number(form.get('prolongation_price') || 0) : 0,
      notification_minutes: gameMode === 'party' ? 0 : Number(form.get('notification_minutes') || 5),
      color: String(form.get('color') || 'ocean'),
    };
    const { error: err } = await supabase.from('app_price_rules').insert(payload);
    if (err) { setError(err.message); return; }
    await addLog('Price added', 'price', undefined, payload, { label: String(payload.label) });
    formEl.reset();
    await loadData();
  }

  async function deletePrice(price: PriceRule) {
    const { error: e } = await supabase.from('app_price_rules').delete().eq('id', price.id);
    if (e) { setError(e.message); return; }
    await addLog('Price deleted', 'price', price as unknown as Record<string, unknown>, undefined, { label: price.label });
    await loadData();
  }

  // === Client operations ===
  async function addClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const payload = { name: String(form.get('name')), phone: String(form.get('phone') || ''), balance: 0 };
    const { error: err } = await supabase.from('app_clients').insert(payload);
    if (err) { setError(err.message); return; }
    await addLog('Client added', 'client', undefined, payload, { name: payload.name });
    formEl.reset();
    await loadData();
  }

  async function editClient(client: Client, updates: Partial<Client>) {
    const { error: e } = await supabase.from('app_clients').update(updates).eq('id', client.id);
    if (e) { setError(e.message); return; }
    await addLog('Client edited', 'client', client as unknown as Record<string, unknown>, updates as Record<string, unknown>, { name: client.name });
    await loadData();
  }

  async function recordPayment(client: Client, amount: number) {
    const newBalance = Math.max(0, Number(client.balance) - amount);
    const { error: e1 } = await supabase.from('app_clients').update({ balance: newBalance }).eq('id', client.id);
    if (e1) { setError(e1.message); return; }
    const { error: e2 } = await supabase.from('app_client_payments').insert({
      client_id: client.id, client_name: client.name, amount, worker_name: workerName,
    });
    if (e2) { setError(e2.message); return; }
    await addLog('Payment recorded', 'client', { balance: client.balance }, { balance: newBalance }, { client: client.name, amount: String(amount) });
    await loadData();
  }

  // === Reminder operations (every reminder is linked to its place) ===
  async function addReminder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const dueDate = String(form.get('date'));
    const dueTime = String(form.get('time'));
    const linkKind = String(form.get('link_kind') || 'none') as Reminder['link_kind'];
    const linkIdRaw = String(form.get('link_id') || '').trim();
    const payload: Record<string, unknown> = {
      message: String(form.get('message')), due_at: `${dueDate}T${dueTime}:00`, completed: false,
      link_kind: linkKind, link_id: linkIdRaw || null, link_label: null,
    };
    if (linkKind === 'product') payload.link_label = products.find(p => p.id === linkIdRaw)?.name ?? null;
    else if (linkKind === 'station') payload.link_label = stations.find(s => s.id === linkIdRaw)?.name ?? null;
    else if (linkKind === 'client') payload.link_label = clients.find(c => c.id === linkIdRaw)?.name ?? null;
    const { error: err } = await supabase.from('app_reminders').insert(payload);
    if (err) { setError(err.message); return; }
    formEl.reset();
    await loadData();
  }

  async function editReminder(reminder: Reminder, updates: Partial<Reminder>) {
    const { error: e } = await supabase.from('app_reminders').update(updates).eq('id', reminder.id);
    if (e) { setError(e.message); return; }
    await loadData();
  }

  async function deleteReminder(reminder: Reminder) {
    const { error: e } = await supabase.from('app_reminders').delete().eq('id', reminder.id);
    if (e) { setError(e.message); return; }
    await loadData();
  }

  async function toggleReminder(reminder: Reminder) {
    const { error: e } = await supabase.from('app_reminders').update({ completed: !reminder.completed }).eq('id', reminder.id);
    if (e) { setError(e.message); return; }
    await loadData();
  }

  // === Worker operations ===
  async function addWorker(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const rawPin = String(form.get('pin') || '').replace(/\D/g, '').slice(0, 12);
    if (rawPin.length < 4) { setError(t('wrong_pin')); return; }
    const payload = { name: String(form.get('name')).slice(0, 60), role: String(form.get('role')) as Role, pin: hashPin(rawPin), active: true };
    const { error: err } = await supabase.from('app_workers').insert(payload);
    if (err) { setError(err.message); return; }
    await addLog('Worker added', 'worker', undefined, { name: payload.name, role: payload.role }, { name: payload.name });
    formEl.reset();
    await loadData();
  }

  async function editWorker(worker: Worker, updates: Partial<Worker>) {
    const safe: Partial<Worker> = { ...updates };
    if (typeof safe.name === 'string') safe.name = safe.name.slice(0, 60);
    if (typeof safe.pin === 'string' && safe.pin.length > 0 && !/^[0-9a-f]{32}$/i.test(safe.pin)) {
      const clean = safe.pin.replace(/\D/g, '').slice(0, 12);
      if (clean.length < 4) { setError(t('wrong_pin')); return; }
      safe.pin = hashPin(clean) as never;
    }
    const { error: e } = await supabase.from('app_workers').update(safe).eq('id', worker.id);
    if (e) { setError(e.message); return; }
    await addLog('Worker edited', 'worker', worker as unknown as Record<string, unknown>, updates as Record<string, unknown>, { name: worker.name });
    await loadData();
  }

  async function deleteWorker(worker: Worker) {
    const { error: e } = await supabase.from('app_workers').delete().eq('id', worker.id);
    if (e) { setError(e.message); return; }
    await addLog('Worker deleted', 'worker', worker as unknown as Record<string, unknown>, undefined, { name: worker.name });
    await loadData();
  }

  // === Data Reset ===
  async function resetFinancialData() {
    const { error: rpcError } = await supabase.rpc('reset_financial_data');
    if (rpcError) { setError(rpcError.message); return false; }
    await addLog('Financial data reset', 'system', undefined, undefined, {});
    await loadData();
    return true;
  }

  async function deleteAllLogs() {
    const { error: rpcError } = await supabase.rpc('delete_all_logs');
    if (rpcError) { setError(rpcError.message); return false; }
    await loadData();
    return true;
  }

  async function fullCatalogWipe() {
    const { error: rpcError } = await supabase.rpc('full_catalog_wipe');
    if (rpcError) { setError(rpcError.message); return false; }
    await addLog('Full catalog wipe', 'system', undefined, undefined, {});
    await loadData();
    return true;
  }

  async function deleteAllPrices() {
    const { error } = await supabase.from('app_price_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { setError(error.message); return false; }
    await addLog('All game prices deleted', 'prices', undefined, undefined, {});
    await loadData();
    return true;
  }

  async function deleteAllProducts() {
    const { error } = await supabase.from('app_products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { setError(error.message); return false; }
    await addLog('All products deleted', 'products', undefined, undefined, {});
    await loadData();
    return true;
  }

  async function verifyAdminPin(pin: string): Promise<boolean> {
    const clean = pin.replace(/\D/g, '').slice(0, 12);
    return pinMatches(settings?.admin_pin || '1111', clean);
  }

  // === Settings ===
  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const rawTheme = String(form.get('theme') || 'abyss');
    const rawColor = String(form.get('theme_color') || 'emerald');
    const updates = {
      name: String(form.get('name')).slice(0, 80), language: String(form.get('language')),
      theme: isAppThemeId(rawTheme) && rawTheme !== 'midnight' ? rawTheme : 'abyss',
      theme_color: rawColor in buttonAccents ? rawColor : 'emerald',
      icon: String(form.get('icon') || 'gamepad'),
      logo_url: String(form.get('logo_url') || ''),
      admin_pin: settings?.admin_pin || '1111',
      worker_pin: settings?.worker_pin || '2222',
    };
    const { error: err } = await supabase.from('app_settings').update(updates).eq('id', settings?.id).maybeSingle();
    if (err) { setError(err.message); return; }
    await addLog('Settings changed', 'settings', settings as unknown as Record<string, unknown>, updates as Record<string, unknown>, {});
    await loadData();
  }
}

// === First-run setup: choose your PINs once. Never asked again. ===
function FirstRunSetup({ onDone, t }: { onDone: (adminPin: string, workerPin: string, subPin: string) => void; t: TFunc }) {
  const [adminPin, setAdminPin] = useState('');
  const [adminPin2, setAdminPin2] = useState('');
  const [workerPin, setWorkerPin] = useState('');
  const [subPin, setSubPin] = useState('');
  const [error, setError] = useState('');
  const digits = (s: string) => s.replace(/\D/g, '').slice(0, 12);

  function save() {
    setError('');
    const a = digits(adminPin), a2 = digits(adminPin2), w = digits(workerPin), s = digits(subPin);
    if (a.length < 4) { setError(t('pin_too_short')); return; }
    if (a !== a2) { setError(t('pin_mismatch')); return; }
    if (w.length < 4) { setError(t('pin_too_short')); return; }
    if (s && s.length < 4) { setError(t('pin_too_short')); return; }
    onDone(a, w, s);
  }

  return <main className="flex min-h-screen items-center justify-center p-4" style={{ background: 'transparent' }}>
    <div className="panel w-full max-w-md p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>{t('setup_title')}</h1>
        <p className="mt-2 text-sm text-slate-400">{t('setup_desc')}</p>
      </div>
      <label className="block text-sm text-slate-300">{t('setup_admin_pin')}<input className="field mt-2 text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={12} value={adminPin} onChange={e => setAdminPin(digits(e.target.value))} placeholder="----" autoFocus /></label>
      <label className="mt-3 block text-sm text-slate-300">{t('confirm_new_pin')}<input className="field mt-2 text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={12} value={adminPin2} onChange={e => setAdminPin2(digits(e.target.value))} placeholder="----" /></label>
      <label className="mt-3 block text-sm text-slate-300">{t('setup_worker_pin')}<input className="field mt-2 text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={12} value={workerPin} onChange={e => setWorkerPin(digits(e.target.value))} placeholder="----" /></label>
      <label className="mt-3 block text-sm text-slate-300">{t('setup_sub_pin')}<input className="field mt-2 text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={12} value={subPin} onChange={e => setSubPin(digits(e.target.value))} placeholder="----" /></label>
      {error && <p className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
      <button className="btn btn-primary mt-6 w-full py-3" onClick={save}>{t('setup_save')}<ArrowRight size={17} /></button>
    </div>
  </main>;
}

// === PIN Auth Screen ===
function sha256Hex(input: string): string {
  // FNV-1a 64-bit x2 — deterministic, dependency-free PIN fingerprint (not a password hash).
  function fnv(seed: bigint, s: string): bigint {
    let h = seed;
    for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * 1099511628211n) & 0xffffffffffffffffn; }
    return h;
  }
  const a = fnv(14695981039346656037n, input).toString(16).padStart(16, '0');
  const b = fnv(1099511628211n, input.split('').reverse().join('') + input.length).toString(16).padStart(16, '0');
  return a + b;
}
function pinMatches(stored: string | null | undefined, entered: string): boolean {
  if (!stored) return false;
  // Legacy plain-PIN seeds compare directly; hashed values compare by fingerprint.
  if (stored.length < 16 && !/^[0-9a-f]{32}$/i.test(stored)) {
    return stored === entered;
  }
  return stored.toLowerCase() === sha256Hex(`cafe:${entered}`).toLowerCase();
}
function hashPin(pin: string): string {
  return sha256Hex(`cafe:${pin}`);
}

function PinAuth({ settings, onSuccess, t }: { settings: Settings | null; onSuccess: (role: Role, workerName: string, workerId: string) => void; t: TFunc }) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const [, setNow] = useState(Date.now());
  const lockLeft = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  useEffect(() => {
    if (!lockedUntil || Date.now() >= lockedUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  async function trackLogin(workerId: string) {
    // Local-only: never call external IP services. Record this-machine login only.
    const ip = '127.0.0.1';
    const ua = navigator.userAgent;
    let deviceType = 'Desktop';
    if (/Mobi|Android|iPhone/i.test(ua)) deviceType = 'Mobile';
    else if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';
    let browserName = 'Unknown';
    if (/Edg\//.test(ua)) browserName = 'Edge';
    else if (/Chrome\//.test(ua)) browserName = 'Chrome';
    else if (/Firefox\//.test(ua)) browserName = 'Firefox';
    else if (/Safari\//.test(ua)) browserName = 'Safari';
    const now = new Date().toISOString();
    await supabase.from('app_workers').update({
      is_online: true, last_login_at: now, ip_address: ip,
      device_type: deviceType, browser: browserName,
      last_heartbeat_at: now, session_started_at: now,
    }).eq('id', workerId);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (Date.now() < lockedUntil) return;
    setBusy(true);
    setError('');
    if (!settings) { setError(friendlyError); setBusy(false); return; }
    const cleanPin = pin.replace(/\D/g, '').slice(0, 12);
    if (cleanPin.length < 1) { setError(t('wrong_pin')); setBusy(false); return; }
    const roleFilter = selectedRole ?? 'worker';
    const { data: workers } = await supabase.from('app_workers').select('*').eq('role', roleFilter).eq('active', true);
    const match = ((workers as Worker[] | null) ?? []).find(w => w.pin && pinMatches(w.pin, cleanPin));
    if (match) {
      setAttempts(0);
      setLockedUntil(0);
      sessionStorage.setItem('cafe_auth', JSON.stringify({ role: roleFilter, workerName: match.name, workerId: match.id, at: Date.now() }));
      await trackLogin(match.id);
      onSuccess(roleFilter as Role, match.name, match.id);
    } else {
      const next = attempts + 1;
      setAttempts(next);
      // Rate-limit: after 5 bad tries, lock the form for 60s.
      if (next >= 5) {
        setLockedUntil(Date.now() + 60000);
        setAttempts(0);
        setError(t('wrong_pin') + ' (60s)');
      } else {
        setError(t('wrong_pin'));
      }
      setPin('');
    }
    setBusy(false);
  }

  const brandingIcon = getIconComponent(settings?.icon ?? 'gamepad');
  const brandingName = settings?.name ?? 'Max Gaming';

  return <main className="flex min-h-screen items-center justify-center p-4" style={{ background: 'transparent' }}>
    <form onSubmit={submit} className="panel w-full max-w-md p-8" style={{ boxShadow: '0 0 80px color-mix(in srgb, var(--accent) 18%, transparent)' }}>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, var(--accent), var(--accent-light))`, color: '#04100b' }}>{(() => { const Icon = brandingIcon; return <Icon size={32} />; })()}</div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>{brandingName}</h1>
        <p className="mt-2 text-sm text-slate-400">{brandingName}</p>
      </div>
      {!selectedRole ? (
        <div className="space-y-3">
          <button type="button" onClick={() => setSelectedRole('admin')} className="btn btn-primary w-full py-4 text-base"><Users size={20} />{t('admin')}<ArrowRight size={17} /></button>
          <button type="button" onClick={() => setSelectedRole('sub_admin')} className="btn btn-ghost w-full py-4 text-base"><Shield size={20} />{t('sub_admin')}<ArrowRight size={17} /></button>
          <button type="button" onClick={() => setSelectedRole('worker')} className="btn btn-ghost w-full py-4 text-base"><UserRound size={20} />{t('worker')}<ArrowRight size={17} /></button>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => { setSelectedRole(null); setPin(''); setError(''); }} className="mb-4 text-sm text-slate-400 hover:text-white">&larr; Back</button>
          <label className="mb-2 block text-sm text-slate-300">{t('enter_pin')} ({selectedRole === 'admin' ? t('admin') : selectedRole === 'sub_admin' ? t('sub_admin') : t('worker')})</label>
          <input className="field text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" autoComplete="off" maxLength={12} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="----" autoFocus required />
          {error && <p className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
          <button disabled={busy || pin.length < 1 || Date.now() < lockedUntil} className="btn btn-primary mt-6 w-full py-3">{busy ? '...' : lockLeft > 0 ? `Locked ${lockLeft}s` : t('enter_dashboard')}<ArrowRight size={17} /></button>
          {selectedRole === 'admin' && (
            <button type="button" onClick={() => { setPin(''); setError(''); setShowRecovery(true); }} className="mt-3 w-full text-center text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline">{t('forgot_pin')}</button>
          )}
        </>
      )}
      {showRecovery && settings && (
        <RecoveryFlow settings={settings} onDone={() => { setShowRecovery(false); setPin(''); setError(''); }} t={t} />
      )}
    </form>
  </main>;
}

// === Ghost word setup (Admin Settings — set once, never shown again) ===
function GhostSettings({ settings, t }: { settings: Settings; t: TFunc }) {
  const [word, setWord] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const has = isGhostSet(settings.ghost_word_hash);

  async function save() {
    setMsg(null);
    if (!isValidGhostWord(word)) { setMsg({ type: 'err', text: t('invalid_ghost') }); return; }
    setBusy(true);
    const { error } = await supabase.from('app_settings').update({ ghost_word_hash: hashGhostWord(word) }).eq('id', settings.id);
    setBusy(false);
    if (error) { setMsg({ type: 'err', text: error.message }); return; }
    // No one — not even the admin panel — ever reads the word back.
    await supabase.from('app_audit_logs').insert({
      worker_name: settings.name, action: 'Ghost word set', entity: 'settings',
      old_value: null, new_value: { changed: true }, details: {},
    });
    setWord('');
    setMsg({ type: 'ok', text: t('ghost_set_ok') });
  }

  return <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel-soft)' }}>
    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('ghost_recovery')}</p>
    <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('ghost_recovery_desc')}</p>
    <p className="mt-2 text-xs font-semibold" style={{ color: has ? 'var(--accent)' : '#ffb13b' }}>
      {has ? '●●●●●●●●' : t('ghost_not_set')}
    </p>
    <label className="mt-3 block text-sm text-slate-300">{t('ghost_change')}
      <input className="field mt-2" type="password" autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={32} value={word} onChange={e => setWord(e.target.value.replace(/\s/g, '').slice(0, 32))} placeholder="••••••••" dir="ltr" />
    </label>
    <p className="mt-1 text-xs text-slate-500">{t('ghost_word_hint')}</p>
    {msg && <p className={`mt-2 rounded-lg border p-2 text-xs ${msg.type === 'err' ? 'border-red-800 bg-red-950/50 text-red-300' : ''}`} style={msg.type === 'ok' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>{msg.text}</p>}
    <button type="button" disabled={busy || !isValidGhostWord(word)} className="btn btn-primary mt-3" onClick={save}>{busy ? '...' : t('save')}</button>
  </div>;
}

// === Ghost recovery (Forgot PIN → ghost word → new admin PIN) ===
function RecoveryFlow({ settings, onDone, t }: { settings: Settings; onDone: () => void; t: TFunc }) {
  const [step, setStep] = useState<'verify' | 'reset' | 'done'>('verify');
  const [ghost, setGhost] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function verify() {
    setBusy(true);
    setMsg('');
    const res = verifyGhostWord(settings.ghost_word_hash, ghost);
    setBusy(false);
    if (!res.ok) {
      setMsg(t(res.error === 'locked' ? 'ghost_locked' : res.error === 'missing' ? 'no_ghost_set' : 'wrong_ghost'));
      setGhost('');
      return;
    }
    setStep('reset');
  }

  async function resetPin() {
    setMsg('');
    const a = newPin.replace(/\D/g, '').slice(0, 12);
    const b = confirmPin.replace(/\D/g, '').slice(0, 12);
    if (a.length < 4) { setMsg(t('pin_too_short')); return; }
    if (a !== b) { setMsg(t('pin_mismatch')); return; }
    setBusy(true);
    // 1) Update the admin worker PIN (login).
    const { data: admins } = await supabase.from('app_workers').select('*').eq('role', 'admin').eq('active', true);
    const list = ((admins as Worker[] | null) ?? []).slice().sort((x, y) => String(x.created_at ?? '').localeCompare(String(y.created_at ?? '')));
    const first = list[0];
    if (first) {
      const { error: e1 } = await supabase.from('app_workers').update({ pin: hashPin(a) }).eq('id', first.id);
      if (e1) { setMsg(e1.message); setBusy(false); return; }
    }
    // 2) Update the settings confirm-PIN (delete confirmations), as plain digits like before.
    const { error: e2 } = await supabase.from('app_settings').update({ admin_pin: a }).eq('id', settings.id);
    setBusy(false);
    if (e2) { setMsg(e2.message); return; }
    clearGhostAttempts();
    // Never log the ghost word or the new PIN — record only that a ghost reset happened.
    await supabase.from('app_audit_logs').insert({
      worker_name: 'ghost', action: 'Admin PIN recovered', entity: 'settings',
      old_value: null, new_value: { changed: true }, details: { via: 'ghost' },
    });
    setStep('done');
  }

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={onDone}>
    <div className="panel w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold">{t('recover_admin_pin')}</h3>
        <button onClick={onDone}><X size={18} /></button>
      </div>
      {step === 'verify' && <>
        <p className="text-sm text-slate-400">{t('enter_ghost_word')}</p>
        <input className="field mt-3 text-center text-xl tracking-[0.2em]" type="password" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={32} value={ghost} onChange={e => setGhost(e.target.value.replace(/\s/g, '').slice(0, 32))} placeholder="••••••••" autoFocus dir="ltr"
          onKeyDown={e => { if (e.key === 'Enter' && ghost.trim().length >= 4 && !busy) { e.preventDefault(); verify(); } }} />
        {msg && <p className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{msg}</p>}
        <button disabled={busy || ghost.trim().length < 4} className="btn btn-primary mt-4 w-full" onClick={verify}>{busy ? '...' : t('verify_ghost')}</button>
      </>}
      {step === 'reset' && <>
        <p className="text-sm text-slate-400">{t('set_new_admin_pin')}</p>
        <label className="mt-3 block text-sm text-slate-300">{t('new_pin')}<input className="field mt-2 text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={12} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="----" autoFocus /></label>
        <label className="mt-3 block text-sm text-slate-300">{t('confirm_new_pin')}<input className="field mt-2 text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={12} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="----" /></label>
        {msg && <p className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{msg}</p>}
        <button disabled={busy || newPin.length < 4 || confirmPin.length < 4} className="btn btn-primary mt-4 w-full" onClick={resetPin}>{busy ? '...' : t('update_pin')}</button>
      </>}
      {step === 'done' && <>
        <p className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}>{t('pin_reset_done')}</p>
        <button className="btn btn-primary mt-4 w-full" onClick={onDone}>{t('close')}</button>
      </>}
    </div>
  </div>;
}

// === Shared UI ===
function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>{title}</h1>{subtitle && <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{subtitle}</p>}</div>{action}</div>;
}
function StatusPill({ status, t }: { status: string; t: TFunc }) {
  const labels: Record<string, string> = { available: t('available'), in_use: t('in_use'), paused: t('paused'), maintenance: t('maintenance'), offline: t('offline') };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status === 'in_use' ? 'bg-[#162c49] text-[#27baff]' : status === 'available' ? 'bg-[#102b21] text-[#20d26c]' : 'bg-[#32231b] text-[#ffb13b]'}`}>{labels[status] ?? status}</span>;
}
function Metric({ label, value, icon, color }: { label: string; value: string; icon: ReactNode; color: string }) {
  const colors: Record<string, string> = { cyan: 'text-[#08b5ee]', green: 'text-[#20d26c]', blue: 'text-[#4798ff]', amber: 'text-[#ffb13b]', red: 'text-[#ff4650]' };
  const glows: Record<string, string> = { cyan: '#08b5ee', green: '#20d26c', blue: '#4798ff', amber: '#ffb13b', red: '#ff4650' };
  const glow = glows[color] || '#334155';
  return <div className="panel panel-hover p-4" style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 34px -22px ${glow}` }}><div className={`mb-2 inline-flex rounded-lg bg-white/5 p-2 ${colors[color] || 'text-slate-400'}`}>{icon}</div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p><strong className="text-2xl tabular-nums tracking-tight">{value}</strong></div>;
}
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>{text}</div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}><div className="panel w-full max-w-md p-5" onClick={e => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="font-bold">{title}</h3><button onClick={onClose}><X size={18} /></button></div>{children}</div></div>;
}
function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b pb-3 text-sm last:border-0" style={{ borderColor: 'var(--line-soft)' }}><span style={{ color: 'var(--muted)' }}>{label}</span><strong>{value}</strong></div>;
}

// === Session Bill Modal ===
function SessionBillModal({ station, session, prices, products, items, tick, onAddItem, onRemoveItem, onAddCustom, onFinish, onCancelSession, onClose, t }: {
  station: Station; session: Session; prices: PriceRule[]; products: Product[]; items: SessionItem[]; tick: number;
  onAddItem: (sessionId: string, itemType: 'game' | 'product', label: string, unitPrice: number, isProlongation: boolean, product?: Product, priceRule?: PriceRule) => void;
  onRemoveItem: (itemId: string) => void;
  onAddCustom: (sessionId: string, label: string, price: number) => void;
  onFinish: (amountPaid?: number) => void;
  onCancelSession: () => void;
  onClose: () => void;
  t: TFunc;
}) {
  const [amountPaid, setAmountPaid] = useState(0);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [showBeveragePicker, setShowBeveragePicker] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const elapsed = session.status !== 'paused' ? Math.max(0, Math.floor((tick - new Date(session.started_at).getTime()) / 1000)) : 0;
  const itemsTotal = items.reduce((s, item) => {
    if (item.item_type === 'game' && item.party_count !== undefined && item.party_count > 0) {
      return s + Number(item.unit_price) * item.party_count;
    }
    if (item.item_type === 'game' && item.match_count !== undefined) {
      return s + Number(item.match_price) * item.match_count + Number(item.prolongation_price) * item.prolongation_count;
    }
    return s + Number(item.unit_price) * item.quantity;
  }, 0);
  const grandTotal = itemsTotal;
  const change = amountPaid - grandTotal;

  const stationGames = prices.filter(p => p.station_type === station.type);
  const drinks = products;
  const gameItems = items.filter(i => i.item_type === 'game');
  const beverageItems = items.filter(i => i.item_type === 'product');

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
    <div className="panel w-full max-w-2xl p-5" onClick={e => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold">{station.name} · {t('session_bill_title')}</h3>
          <p className="text-xs text-slate-500">{formatTimer(elapsed)} · {session.worker_name}</p>
        </div>
        <button onClick={onClose}><X size={18} /></button>
      </div>

      {/* Games */}
      {gameItems.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-xs font-semibold text-slate-500">{t('session_games')}</p>
          {gameItems.map(gi => {
            const isFrozen = !!gi.game_ended_at;
            const gameRule = prices.find(p => p.id === gi.price_rule_id);
            const isParty = gameRule ? gameRule.game_mode === 'party' : false;
            const gameElapsed = isFrozen
              ? Math.max(0, Math.floor((new Date(gi.game_ended_at ?? gi.game_started_at).getTime() - new Date(gi.game_started_at).getTime()) / 1000))
              : isParty ? 0 : Math.max(0, Math.floor((tick - new Date(gi.game_started_at).getTime()) / 1000));
            return <div key={gi.id} className={`flex items-center gap-2 rounded-lg p-2 text-xs ${isFrozen ? 'bg-[#0a1018] opacity-60' : 'bg-[#0a1422]'}`}>
              <Gamepad2 size={14} className={isFrozen ? 'text-slate-600' : 'text-[#08b5ee]'} />
              <span className={isFrozen ? 'text-slate-500' : 'text-slate-200'}>{gi.label}</span>
              {isParty
                ? <span className="text-slate-500">{gi.party_count} {t('parties')}</span>
                : <span className="text-slate-500">{formatTimer(gameElapsed)}</span>}
              {gi.match_count !== undefined && gi.match_price > 0 && <span className="text-slate-500">M:{gi.match_count} P:{gi.prolongation_count}</span>}
              <span className="ml-auto text-slate-400">{isParty ? money(Number(gi.unit_price) * gi.party_count) : gi.match_count !== undefined && gi.match_price > 0 ? money(Number(gi.match_price) * gi.match_count + Number(gi.prolongation_price) * gi.prolongation_count) : money(Number(gi.unit_price))}</span>
              <button onClick={() => onRemoveItem(gi.id)} className="text-[#ff4650]"><X size={12} /></button>
            </div>;
          })}
        </div>
      )}

      {/* Beverages */}
      {beverageItems.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-xs font-semibold text-[#08b5ee]">{t('beverages_taken')}</p>
          {beverageItems.map(bi => <div key={bi.id} className="flex items-center gap-2 rounded-lg bg-[#0c1828] p-2 text-xs">
            <Coffee size={12} className="text-[#08b5ee]" />
            <span className="text-slate-200">{bi.label}</span>
            <span className="ml-auto text-[#20d26c]">{money(Number(bi.unit_price) * bi.quantity)}</span>
            <button onClick={() => onRemoveItem(bi.id)} className="text-[#ff4650]"><X size={12} /></button>
          </div>)}
        </div>
      )}

      {/* Add game / beverage buttons */}
      <div className="mb-3 flex items-center gap-1.5">
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#20d26c] bg-[#0d2018] text-[#20d26c] transition hover:bg-[#102b21]" onClick={() => setShowGamePicker(!showGamePicker)} title={t('add_game_short')}><Gamepad2 size={16} /></button>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#08b5ee] bg-[#0c1828] text-[#08b5ee] transition hover:bg-[#162c49]" onClick={() => setShowBeveragePicker(!showBeveragePicker)} title={t('add_drink_short')}><Coffee size={16} /></button>
      </div>

      {/* Game picker */}
      {showGamePicker && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-[#22324d] bg-[#0a1422] p-2 sm:grid-cols-3">
          {stationGames.map(g => { const cs = colorStyle(g.color || 'ocean'); return <button key={g.id} className="rounded-lg border p-2 text-center text-xs transition hover:scale-[1.02]" style={{ background: cs.bg, borderColor: cs.border }} onClick={() => { onAddItem(session.id, 'game', g.label, Number(g.price), false, undefined, g); setShowGamePicker(false); }}>
            <span className="block font-semibold text-slate-200">{g.label}</span>
            <span className="text-[#20d26c]">{money(Number(g.price))}</span>
          </button>; })}
        </div>
      )}

      {/* Beverage picker */}
      {showBeveragePicker && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-[#162c49] bg-[#0c1828] p-2 sm:grid-cols-3">
          {drinks.map(p => { const cs = colorStyle(p.color || 'ocean'); return <button key={p.id} disabled={p.total_units <= 0} className="rounded-lg border p-2 text-center text-xs transition hover:scale-[1.02] disabled:opacity-30" style={{ background: cs.bg, borderColor: cs.border }} onClick={() => onAddItem(session.id, 'product', p.name, Number(p.selling_price), false, p)}>
            <span className="block font-semibold text-slate-200">{p.name}</span>
            <span className="text-[#20d26c]">{money(Number(p.selling_price))}</span>
          </button>; })}
        </div>
      )}

      {/* Custom item */}
      <div className="mb-3 rounded-lg border border-[#22324d] bg-[#0a1422] p-3">
        <p className="mb-2 text-xs font-semibold text-slate-400">{t('add_custom_item')}</p>
        <div className="flex gap-2">
          <input className="field flex-1" placeholder={t('custom_name')} value={customName} onChange={e => setCustomName(e.target.value)} />
          <input className="field w-28" type="number" min="0" placeholder={t('custom_price')} value={customPrice || ''} onChange={e => setCustomPrice(Number(e.target.value))} />
          <button className="btn btn-ghost" disabled={!customName || customPrice <= 0} onClick={() => { onAddCustom(session.id, customName, customPrice); setCustomName(''); setCustomPrice(0); }}><Plus size={16} /></button>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2 border-t border-[#1b2a42] pt-4">
        {items.length === 0 && <p className="mb-2 rounded-lg border border-[#ffb13b]/30 bg-[#1f1608] p-3 text-center text-sm text-[#ffb13b]">{t('no_items_zero')}</p>}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-bold">{t('grand_total')}</span>
          <span className="text-2xl font-bold text-[#20d26c]">{money(grandTotal)}</span>
        </div>
        <label className="block text-sm text-slate-400">{t('amount_paid')}
          <input className="field mt-1" type="number" min="0" value={amountPaid || ''} onChange={e => setAmountPaid(Number(e.target.value))} placeholder={String(grandTotal)} />
        </label>
        {amountPaid > 0 && (
          <div className="flex items-center justify-between rounded-lg p-3" style={{ background: change >= 0 ? '#0d2018' : '#2a0f12' }}>
            <span className="text-sm">{t('change_owed')}</span>
            <span className={`text-lg font-bold ${change >= 0 ? 'text-[#20d26c]' : 'text-[#ff4650]'}`}>{change >= 0 ? money(change) : money(Math.abs(change))}</span>
          </div>
        )}
        <button className="btn btn-primary mt-2 w-full" onClick={() => onFinish(amountPaid > 0 ? amountPaid : undefined)}><Check size={16} />{t('confirm_finish')}</button>
        <button className="mx-auto mt-3 block text-xs text-[#ffb13b] underline-offset-2 transition hover:text-[#ff9d3b] hover:underline" onClick={() => setShowCancelConfirm(true)}>{t('cancel_session')}</button>
      </div>
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCancelConfirm(false)}>
          <div className="panel w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 font-bold text-[#ffb13b]">{t('cancel_session')}</h3>
            <p className="mb-4 text-sm text-slate-300">{t('cancel_session_confirm')}</p>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setShowCancelConfirm(false)}>{t('no')}</button>
              <button className="btn flex-1 border border-[#ffb13b] bg-[#2a1606] text-[#ffb13b] transition hover:bg-[#3d2812]" onClick={() => { onCancelSession(); setShowCancelConfirm(false); }}>{t('yes')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>;
}

// === Control Panel ===
function ControlView({ stations, stationTypes, sessions, prices, products, sessionItems, tick, workerName, onStart, onPause, onFinish, onCancelSession, onSetStatus, onAddItem, onRemoveItem, onUpdateItem, onAddCustom, t }: {
  stations: Station[]; stationTypes: StationType[]; sessions: Session[]; prices: PriceRule[]; products: Product[]; sessionItems: SessionItem[]; tick: number; workerName: string;
  onStart: (s: Station) => void; onPause: (s: Station) => void; onFinish: (s: Station, amountPaid?: number) => void; onCancelSession: (s: Station) => void; onSetStatus: (s: Station, st: string) => void;
  onAddItem: (sessionId: string, itemType: 'game' | 'product', label: string, unitPrice: number, isProlongation: boolean, product?: Product, priceRule?: PriceRule) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<SessionItem>) => void;
  onAddCustom: (sessionId: string, label: string, price: number) => void;
  t: TFunc;
}) {
  const [statusModal, setStatusModal] = useState<Station | null>(null);
  const [picker, setPicker] = useState<{ stationId: string; type: 'game' | 'beverage' } | null>(null);
  const [billStation, setBillStation] = useState<Station | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; text: string; type: 'warning' | 'info' }[]>([]);

  useEffect(() => {
    for (const station of stations) {
      const active = sessions.find(s => s.station_id === station.id);
      if (!active || active.status !== 'running') continue;
      const items2 = sessionItems.filter(si => si.session_id === active.id && si.item_type === 'game' && !si.game_ended_at);
      for (const item of items2) {
        if (!item.game_started_at || !item.duration_minutes) continue;
        const gameElapsedSec = Math.floor((tick - new Date(item.game_started_at).getTime()) / 1000);
        const durationSec = item.duration_minutes * 60;
        const overtimeSec = gameElapsedSec - durationSec;
        const gameRule = prices.find(p => p.id === item.price_rule_id);
        const isFootball = gameRule ? gameRule.game_mode === 'football' : item.match_price > 0;
        if (isFootball && durationSec > 0) {
          const expectedMatches = Math.floor(gameElapsedSec / durationSec);
          if (expectedMatches > item.match_count) {
            onUpdateItem(item.id, { match_count: expectedMatches });
          }
        }
        if (overtimeSec > 0 && item.notification_minutes > 0) {
          const notificationSec = item.notification_minutes * 60;
          const lastNotified = item.notification_sent_at ? new Date(item.notification_sent_at).getTime() : 0;
          const sinceLast = tick - lastNotified;
          if (sinceLast > notificationSec * 1000 || lastNotified === 0) {
            const notifId = `${item.id}_${tick}`;
            const overtimeMin = Math.floor(overtimeSec / 60);
            const text = isFootball
              ? `${station.name}: ${item.label} — ${t('auto_match_detected')} (${overtimeMin} ${t('minutes_short')})`
              : `${station.name}: ${item.label} — ${t('exceeded_duration')} ${overtimeMin} ${t('minutes_short')}`;
            setNotifications(prev => [...prev.filter(n => n.id !== `${item.id}_${lastNotified}`), { id: notifId, text, type: 'warning' }]);
            onUpdateItem(item.id, { notification_sent_at: new Date().toISOString() });
            playBeep();
            if ('Notification' in window && Notification.permission === 'granted') { new Notification(t('overtime_alert'), { body: text }); }
            setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notifId)), 8000);
            break;
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const pickerStation = picker ? stations.find(s => s.id === picker.stationId) : null;
  const pickerSession = pickerStation ? sessions.find(s => s.station_id === pickerStation.id) : null;
  const pickerGames = pickerStation ? prices.filter(p => p.station_type === pickerStation.type) : [];
  const pickerDrinks = products;

  return <>
    <SectionTitle title={t('control_panel')} subtitle={`${t('live_dashboard')} · ${workerName}`} action={<div className="flex items-center gap-2 text-sm text-slate-400"><span className="h-2 w-2 animate-pulse rounded-full bg-[#20d26c]" />{t('live_dashboard')}</div>} />
    {notifications.length > 0 && (
      <div className="mb-4 space-y-2">
        {notifications.map(n => (
          <div key={n.id} className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${n.type === 'warning' ? 'border-[#ffb13b]/40 bg-[#1f1608] text-[#ffb13b]' : 'border-[#27baff]/40 bg-[#0c1828] text-[#27baff]'}`}>
            <AlertTriangle size={18} />
            <span className="flex-1">{n.text}</span>
            <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    )}
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label={t('total_stations')} value={String(stations.length)} icon={<Gamepad2 />} color="cyan" />
      <Metric label={t('in_use')} value={String(sessions.length)} icon={<Zap />} color="green" />
      <Metric label={t('available')} value={String(stations.filter(s => s.status === 'available').length)} icon={<Check />} color="blue" />
      <Metric label={t('rate_rules')} value={String(prices.length)} icon={<CircleDollarSign />} color="amber" />
    </div>
    <div className="space-y-6">
      {stationTypes.map(stype => {
        const typeStations = stations.filter(s => s.type === stype.name);
        if (typeStations.length === 0) return null;
        const tcs = colorStyle(stype.color || 'ocean');
        return <div key={stype.id}>
          <div className="mb-3 flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: tcs.text }} /><h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: tcs.text }}>{stype.label}</h2><span className="text-xs text-slate-500">{typeStations.length}</span></div>
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {typeStations.map(station => {
        const active = sessions.find(s => s.station_id === station.id);
        const elapsed = active && active.status !== 'paused' ? Math.floor((tick - new Date(active.started_at).getTime()) / 1000) : 0;
        const items = active ? sessionItems.filter(si => si.session_id === active.id) : [];
        const gameItems = items.filter(i => i.item_type === 'game');
        const beverageItems = items.filter(i => i.item_type === 'product');
        const itemsTotal = items.reduce((s, item) => {
          const rule = prices.find(p => p.id === item.price_rule_id);
          const football = rule ? rule.game_mode === 'football' : item.match_price > 0;
          const party = rule ? rule.game_mode === 'party' : false;
          return party
            ? s + Number(item.unit_price) * item.party_count
            : football
              ? s + Number(item.match_price) * item.match_count + Number(item.prolongation_price) * item.prolongation_count
              : s + Number(item.unit_price) * item.quantity;
        }, 0);
        return <div key={station.id} className="panel panel-hover" style={{ borderColor: active ? tcs.border : undefined, boxShadow: active ? `0 0 0 1px ${tcs.border}, 0 18px 44px -22px ${tcs.border}` : undefined }}>
          <div className="flex items-center justify-between border-b border-[#1b2a42] p-4">
            <div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${active ? 'bg-[#20d26c] shadow-[0_0_12px_#20d26c]' : ''}`} style={{ background: active ? undefined : tcs.text }} /><div><h3 className="font-bold">{station.name}</h3><p className="text-xs text-slate-500">{active ? formatTimer(elapsed) : t('available')}</p></div></div>
            <div className="flex items-center gap-2">
              {active && <div className="flex items-center gap-1.5">
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#20d26c] bg-[#0d2018] text-[#20d26c] transition hover:bg-[#102b21]" onClick={() => setPicker({ stationId: station.id, type: 'game' })} title={t('add_game_short')}><Gamepad2 size={16} /></button>
                <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#08b5ee] bg-[#0c1828] text-[#08b5ee] transition hover:bg-[#162c49]" onClick={() => setPicker({ stationId: station.id, type: 'beverage' })} title={t('add_drink_short')}><Coffee size={16} />{beverageItems.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#08b5ee] px-1 text-[9px] font-bold text-[#04101d]">{beverageItems.length}</span>}</button>
              </div>}
              {active ? <button className="btn btn-danger px-3" onClick={() => setBillStation(station)}><span className="h-3 w-3 rounded-sm border-2 border-white" />{t('finish')}</button> : <button disabled={station.status !== 'available'} className="btn btn-primary px-4 disabled:opacity-40" onClick={() => onStart(station)}><Zap size={16} />{t('start_session')}</button>}
            </div>
          </div>
          {active && (
            <div className="p-4">
              {gameItems.length === 0 && beverageItems.length === 0 && <p className="mb-3 text-sm text-slate-500">{t('no_games_session')}</p>}
              {gameItems.map(game => {
                const gameRule = prices.find(price => price.id === game.price_rule_id);
                const isFootball = gameRule ? gameRule.game_mode === 'football' : false;
                const isParty = gameRule ? gameRule.game_mode === 'party' : false;
                const isFrozen = !!game.game_ended_at;
                const cs = colorStyle(gameRule?.color || 'ocean');
                const gameElapsed = isFrozen
                  ? Math.max(0, Math.floor((new Date(game.game_ended_at ?? game.game_started_at).getTime() - new Date(game.game_started_at).getTime()) / 1000))
                  : isParty ? 0 : Math.max(0, Math.floor((tick - new Date(game.game_started_at).getTime()) / 1000));
                const durationSec = game.duration_minutes ? game.duration_minutes * 60 : 0;
                const overtimeSec = !isFrozen && !isParty && durationSec > 0 ? gameElapsed - durationSec : 0;
                const isOvertime = overtimeSec > 10;
                return <div key={game.id} className={`mb-2 rounded-xl border p-3 transition ${isFrozen ? 'border-[#1b2a42] bg-[#0a1018] opacity-60' : isOvertime ? 'border-[#ff4650] bg-[#2a0f12] animate-pulse shadow-[0_0_20px_rgba(255,70,80,0.4)]' : ''}`} style={isFrozen || isOvertime ? undefined : { background: cs.bg, borderColor: cs.border }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gamepad2 size={15} style={{ color: isFrozen ? '#475569' : isOvertime ? '#ff4650' : cs.text }} />
                      <span className={`text-sm font-semibold ${isFrozen ? 'text-slate-500' : 'text-slate-200'}`}>{game.label}</span>
                      {isFrozen
                        ? <span className="rounded-full bg-[#1b2a42] px-2 py-0.5 text-[10px] text-slate-500">{t('frozen_game')}</span>
                        : isOvertime
                          ? <span className="rounded-full bg-[#2a0f12] px-2 py-0.5 text-[10px] font-bold text-[#ff4650] animate-pulse">{t('overtime_alert')}</span>
                          : <span className="rounded-full bg-[#102b21] px-2 py-0.5 text-[10px] text-[#20d26c]">{t('active_game')}</span>}
                    </div>
                    <button className="rounded-lg border border-[#ff4650] px-2.5 py-1.5 text-xs text-[#ff4650] transition hover:bg-[#ff4650]/10" onClick={() => onRemoveItem(game.id)} title={t('remove')}><X size={14} /></button>
                  </div>
                  {isParty
                    ? <div className="mt-2 flex items-center justify-center gap-3">
                        <button className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#20d26c] bg-[#0d2018] text-lg font-bold text-[#20d26c] transition hover:bg-[#102b21]" onClick={() => onUpdateItem(game.id, { party_count: Math.max(1, game.party_count - 1) })}>−</button>
                        <div className="text-center"><p className="font-mono text-2xl font-bold" style={{ color: cs.text }}>{game.party_count}</p><p className="text-[10px] text-slate-500">{t('parties')}</p></div>
                        <button className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#20d26c] bg-[#0d2018] text-lg font-bold text-[#20d26c] transition hover:bg-[#102b21]" onClick={() => onUpdateItem(game.id, { party_count: game.party_count + 1 })}>+</button>
                      </div>
                    : <p className="mt-2 text-center font-mono text-lg" style={{ color: isFrozen ? '#475569' : isOvertime ? '#ff4650' : cs.text }}>{formatTimer(gameElapsed)}</p>}
                  {isFootball && <div className="mt-2 grid grid-cols-2 gap-2"><CounterRow label={t('match')} value={game.match_count} color="cyan" onMinus={() => onUpdateItem(game.id, { match_count: Math.max(0, game.match_count - 1) })} onPlus={() => onUpdateItem(game.id, { match_count: game.match_count + 1 })} onReset={() => onUpdateItem(game.id, { match_count: 0 })} /><CounterRow label={t('prolongation')} value={game.prolongation_count} color="amber" onMinus={() => onUpdateItem(game.id, { prolongation_count: Math.max(0, game.prolongation_count - 1) })} onPlus={() => onUpdateItem(game.id, { prolongation_count: game.prolongation_count + 1 })} onReset={() => onUpdateItem(game.id, { prolongation_count: 0 })} /></div>}
                </div>;
              })}
              {beverageItems.length > 0 && <div className="mb-3 rounded-xl border border-[#162c49] bg-[#0c1828] p-3 text-xs"><p className="mb-2 flex items-center gap-1 font-semibold text-[#08b5ee]"><Coffee size={12} />{t('beverages_taken')}</p>{beverageItems.map(item => { const prod = products.find(p => p.name === item.label); const cs = colorStyle(prod?.color || 'ocean'); return <div key={item.id} className="flex justify-between py-1"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: cs.text }} />{item.quantity}x {item.label}</span><span className="flex items-center gap-1 text-[#20d26c]">{money(Number(item.unit_price) * item.quantity)} <button onClick={() => onRemoveItem(item.id)} className="text-[#ff4650]"><X size={12} /></button></span></div>; })}</div>}
              <div className="mt-3 flex justify-between border-t border-[#1b2a42] pt-3 text-sm"><span className="text-slate-500">{t('items_total')}</span><strong className="text-[#20d26c]">{money(itemsTotal)}</strong></div>
            </div>
          )}
        </div>;
      })}
          </div>
        </div>;
      })}
    </div>
    {statusModal && <Modal title={`${statusModal.name} · ${t('settings')}`} onClose={() => setStatusModal(null)}>
      <div className="space-y-2">
        {(['available', 'maintenance', 'offline'] as const).map(st => <button key={st} className="btn btn-ghost w-full justify-start" onClick={() => { onSetStatus(statusModal, st); setStatusModal(null); }}><StatusPill status={st} t={t} />{t(st)}</button>)}
      </div>
    </Modal>}
    {picker && pickerSession && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPicker(null)}>
        <div className="panel w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">{picker.type === 'game' ? t('pick_game') : t('pick_beverage')}</h3>
            <button onClick={() => setPicker(null)}><X size={18} /></button>
          </div>
          {picker.type === 'game' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {pickerGames.length === 0 && <p className="col-span-full text-sm text-slate-500">{t('no_prices')}</p>}
              {pickerGames.map(game => { const cs = colorStyle(game.color || 'ocean'); return (
                <button key={game.id} className="rounded-lg border p-3 text-center transition hover:scale-[1.02]" style={{ background: cs.bg, borderColor: cs.border }} onClick={() => { onAddItem(pickerSession.id, 'game', game.label, Number(game.price), false, undefined, game); setPicker(null); }}>
                  <div className="mb-1 flex items-center justify-center gap-1"><Gamepad2 size={14} style={{ color: cs.text }} /><span className="text-sm font-semibold text-slate-200">{game.label}</span></div>
                  <p className="text-xs text-[#20d26c]">{money(Number(game.price))}</p>
                  <p className="text-[10px] text-slate-500">{game.duration_minutes} {t('minutes_short')}{game.game_mode === 'football' ? ` · ${t('football')}` : game.game_mode === 'party' ? ` · ${t('party_mode')}` : ''}</p>
                </button>
              ); })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {pickerDrinks.length === 0 && <p className="col-span-full text-sm text-slate-500">{t('no_products')}</p>}
              {pickerDrinks.map(product => { const cs = colorStyle(product.color || 'ocean'); return (
                <button key={product.id} disabled={product.total_units <= 0} className="rounded-lg border p-3 text-center transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-30" style={{ background: cs.bg, borderColor: cs.border }} onClick={() => onAddItem(pickerSession.id, 'product', product.name, Number(product.selling_price), false, product)}>
                  <div className="mb-1 flex items-center justify-center gap-1">{product.category === 'beverage' ? <Coffee size={14} style={{ color: cs.text }} /> : <Package size={14} style={{ color: cs.text }} />}<span className="text-sm font-semibold text-slate-200">{product.name}</span></div>
                  <p className="text-xs text-[#20d26c]">{money(Number(product.selling_price))}</p>
                  <p className="text-[10px] text-slate-500">{product.total_units} {t('units')}</p>
                </button>
              ); })}
              <button className="col-span-full btn btn-ghost mt-2" onClick={() => setPicker(null)}>{t('close')}</button>
            </div>
          )}
          {picker.type === 'game' && <button className="btn btn-ghost mt-3 w-full" onClick={() => setPicker(null)}>{t('close')}</button>}
        </div>
      </div>
    )}
    {billStation && (() => {
      const billSession = sessions.find(s => s.station_id === billStation.id);
      if (!billSession) { setBillStation(null); return null; }
      const billItems = sessionItems.filter(si => si.session_id === billSession.id);
      return <SessionBillModal station={billStation} session={billSession} prices={prices} products={products} items={billItems} tick={tick} onAddItem={onAddItem} onRemoveItem={onRemoveItem} onAddCustom={onAddCustom} onFinish={(ap) => { onFinish(billStation, ap); setBillStation(null); }} onCancelSession={() => { onCancelSession(billStation); setBillStation(null); }} onClose={() => setBillStation(null)} t={t} />;
    })()}

  </>;

}

function CounterRow({ label, value, color, onMinus, onPlus, onReset }: { label: string; value: number; color: 'cyan' | 'amber'; onMinus: () => void; onPlus: () => void; onReset: () => void }) {
  const accent = color === 'cyan' ? 'text-[#08b5ee]' : 'text-[#ffb13b]';
  const border = color === 'cyan' ? 'border-[#08b5ee]' : 'border-[#ffb13b]';
  return <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-1 text-xs"><span className={`${accent} truncate`}>{label}</span><button className="rounded border border-[#263954] px-2 py-1 text-base leading-none" onClick={onMinus}>−</button><span className="min-w-8 rounded border border-[#263954] px-2 py-1 text-center font-bold text-white">{value}</span><div className="flex gap-1"><button className={`rounded border ${border} px-2 py-1 text-base leading-none ${accent}`} onClick={onPlus}>+</button><button className="rounded border border-[#ff4650] px-2 py-1 text-[#ff4650]" onClick={onReset}><RotateCcw size={12} /></button></div></div>;
}

// === Beverages View ===
function BeveragesView({ products, onSave, onRestock, onSell, onEditPrice, workerName, t }: {
  products: Product[]; onSave: (e: FormEvent<HTMLFormElement>) => void; onRestock: (p: Product, n: number) => void; onSell: (p: Product, q: number) => void; onEditPrice: (p: Product, p2: number) => void; workerName: string; t: TFunc;
}) {
  const [restockModal, setRestockModal] = useState<Product | null>(null);
  const [sellModal, setSellModal] = useState<Product | null>(null);
  const [priceModal, setPriceModal] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [sellQty, setSellQty] = useState(1);
  const [newPrice, setNewPrice] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const allProducts = products;
  const filtered = filter === 'all' ? allProducts : allProducts.filter(p => p.category === filter);

  const categoryLabel = (cat: string) => cat === 'beverage' ? t('drink') : cat === 'snack' ? t('snack') : t('accessory');

  return <>
    <SectionTitle title={t('beverages')} subtitle={t('drinks_snacks_accessories')} action={<span className="rounded-lg bg-[#102b21] px-3 py-2 text-sm text-[#20d26c]">{allProducts.reduce((n, p) => n + p.total_units, 0)} {t('units_on_hand')}</span>} />
    <div className="mb-4 flex gap-2">
      <button onClick={() => setFilter('all')} className={`rounded-lg px-3 py-1.5 text-sm transition ${filter === 'all' ? 'bg-[#20c96b] text-[#05100a] font-semibold' : 'bg-[#0d1524] text-slate-400 hover:text-white'}`}>{t('all')}</button>
      <button onClick={() => setFilter('beverage')} className={`rounded-lg px-3 py-1.5 text-sm transition ${filter === 'beverage' ? 'bg-[#08b5ee] text-[#04101b] font-semibold' : 'bg-[#0d1524] text-slate-400 hover:text-white'}`}>{t('drink')}</button>
      <button onClick={() => setFilter('snack')} className={`rounded-lg px-3 py-1.5 text-sm transition ${filter === 'snack' ? 'bg-[#ffb13b] text-[#1a0e00] font-semibold' : 'bg-[#0d1524] text-slate-400 hover:text-white'}`}>{t('snack')}</button>
      <button onClick={() => setFilter('accessory')} className={`rounded-lg px-3 py-1.5 text-sm transition ${filter === 'accessory' ? 'bg-[#a78bfa] text-[#100a20] font-semibold' : 'bg-[#0d1524] text-slate-400 hover:text-white'}`}>{t('accessory')}</button>
    </div>
    <div className="space-y-3">
      {filtered.length === 0 && <Empty text={t('no_products')} />}
      {filtered.map(product => { const cs = colorStyle(product.color); return <div className="panel flex flex-wrap items-center justify-between gap-4 p-4" key={product.id}>
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-3" style={{ background: cs.iconBg, color: cs.text }}>{product.category === 'beverage' ? <Coffee size={20} /> : product.category === 'snack' ? <Package size={20} /> : <Package size={20} />}</div>
          <div>
            <h3 className="font-semibold">{product.name}</h3>
            <p className="text-xs text-slate-400">{t('unit_cost')}: {money(product.purchase_price)} · {t('selling_price')}: {money(product.selling_price)} / unit · <span style={{ color: cs.text }}>{categoryLabel(product.category)}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-semibold">{product.total_units} {t('units')}</p>
            <p className={`text-xs ${product.total_units === 0 ? 'text-red-400' : product.total_units <= 5 ? 'text-amber-400' : 'text-slate-400'}`}>{product.total_units === 0 ? t('out_of_stock') : product.total_units <= 5 ? t('low_stock') : ''}</p>
          </div>
          <button className="btn btn-ghost p-2" onClick={() => { setPriceModal(product); setNewPrice(product.selling_price); }} title={t('edit')}><Pencil size={15} /></button>
          <button className="btn btn-ghost p-2" onClick={() => { setSellModal(product); setSellQty(1); }} title={t('sell')}><ShoppingBag size={15} /></button>
          <button className="btn btn-primary p-2" onClick={() => { setRestockModal(product); setRestockQty(1); }} title={t('add_stock')}><Plus size={17} /></button>
        </div>
      </div>; })}
    </div>
    {restockModal && <Modal title={`${t('add_stock')} · ${restockModal.name}`} onClose={() => setRestockModal(null)}>
      <label className="block text-sm text-slate-300">{t('units_to_add')}<input className="field mt-2" type="number" min="1" value={restockQty} onChange={e => setRestockQty(Number(e.target.value))} autoFocus /></label>
      <p className="mt-2 text-xs text-slate-500">+{restockQty} {t('units')} → {restockModal.total_units + restockQty} {t('units_on_hand')}</p>
      <button className="btn btn-primary mt-4 w-full" onClick={() => { onRestock(restockModal, restockQty); setRestockModal(null); }}><Check size={16} />{t('save')}</button>
    </Modal>}
    {sellModal && <Modal title={`${t('sell')} · ${sellModal.name}`} onClose={() => setSellModal(null)}>
      <label className="block text-sm text-slate-300">{t('quantity')}<input className="field mt-2" type="number" min="1" max={sellModal.total_units} value={sellQty} onChange={e => setSellQty(Number(e.target.value))} autoFocus /></label>
      <p className="mt-2 text-xs text-slate-500">{t('total')}: {money(sellModal.selling_price * sellQty)}</p>
      <button className="btn btn-primary mt-4 w-full" onClick={() => { onSell(sellModal, sellQty); setSellModal(null); }}><Check size={16} />{t('sell')}</button>
    </Modal>}
    {priceModal && <Modal title={`${t('edit')} · ${priceModal.name}`} onClose={() => setPriceModal(null)}>
      <label className="block text-sm text-slate-300">{t('selling_price')}<input className="field mt-2" type="number" min="0" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} autoFocus /></label>
      <button className="btn btn-primary mt-4 w-full" onClick={() => { onEditPrice(priceModal, newPrice); setPriceModal(null); }}><Check size={16} />{t('save')}</button>
    </Modal>}
  </>;
}

// === Prices View ===
function PricesView({ prices, stations, stationTypes, onSave, onDelete, onDeleteAll, onVerifyAdminPin, isAdmin, t }: {
  prices: PriceRule[]; stations: Station[]; stationTypes: StationType[]; onSave: (e: FormEvent<HTMLFormElement>) => void; onDelete: (p: PriceRule) => void; onDeleteAll: () => Promise<boolean>; onVerifyAdminPin: (pin: string) => Promise<boolean>; isAdmin: boolean; t: TFunc;
}) {
  const priceCategories = stationTypes.length > 0 ? stationTypes : [...new Set(stations.map(s => s.type))].map((name, i) => ({ id: name, name, label: name, color: 'ocean', sort_order: i } as StationType));
  const [gameMode, setGameMode] = useState<'standard' | 'football' | 'party'>('standard');
  const [gameColor, setGameColor] = useState<string>('ocean');
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function confirmDeleteAll() {
    setPinError('');
    setDeleteBusy(true);
    const ok = await onVerifyAdminPin(pinInput);
    if (!ok) { setPinError(t('wrong_pin')); setDeleteBusy(false); return; }
    const success = await onDeleteAll();
    setDeleteBusy(false);
    if (success) { setShowDeleteAll(false); setPinInput(''); }
    else setPinError(t('delete_failed'));
  }

  return <>
    <SectionTitle title={t('game_prices')} subtitle="One source of truth for every session and calculator sale." action={
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400">{prices.length} {t('rate_rules')}</span>
        {isAdmin && prices.length > 0 && <button className="btn btn-danger" onClick={() => { setShowDeleteAll(true); setPinInput(''); setPinError(''); }}><Trash2 size={15} />{t('delete_all')}</button>}
      </div>
    } />
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.7fr]">
      {/* Compact add-pricing form */}
      <form onSubmit={onSave} className="panel p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-300">{t('add_pricing')}</h2>
        <div className="space-y-2">
          <input className="field !py-2 text-sm" name="label" placeholder="Label, e.g. PS5 standard" required />
          <select className="field !py-2 text-sm" name="category">{priceCategories.map(tp => <option key={tp.name} value={tp.name}>{tp.label}</option>)}</select>
          {gameMode !== 'party' && (
            <div className="grid grid-cols-2 gap-2"><input className="field !py-2 text-sm" name="duration" type="number" min="1" placeholder={t('minutes')} required /><input className="field !py-2 text-sm" name="price" type="number" min="0" placeholder={`${t('price')} DZD`} required /></div>
          )}
          {gameMode === 'party' && (
            <input className="field !py-2 text-sm" name="price" type="number" min="0" placeholder={`${t('price_per_party')} DZD`} required />
          )}

          <div>
            <p className="mb-1.5 text-xs text-slate-400">{t('game_mode')}</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setGameMode('standard')} className={`flex-1 rounded-lg border-2 px-2 py-1.5 text-xs transition ${gameMode === 'standard' ? 'border-[#08b5ee] bg-[#0c1828] text-[#08b5ee]' : 'border-[#263954] text-slate-400 hover:text-white'}`}><Gamepad2 size={12} className="mr-1 inline" />{t('gta_mode')}</button>
              <button type="button" onClick={() => setGameMode('football')} className={`flex-1 rounded-lg border-2 px-2 py-1.5 text-xs transition ${gameMode === 'football' ? 'border-[#27baff] bg-[#162c49] text-[#27baff]' : 'border-[#263954] text-slate-400 hover:text-white'}`}><CircleDollarSign size={12} className="mr-1 inline" />{t('football_mode')}</button>
              <button type="button" onClick={() => setGameMode('party')} className={`flex-1 rounded-lg border-2 px-2 py-1.5 text-xs transition ${gameMode === 'party' ? 'border-[#20d26c] bg-[#0d2018] text-[#20d26c]' : 'border-[#263954] text-slate-400 hover:text-white'}`}><Users size={12} className="mr-1 inline" />{t('party_mode')}</button>
            </div>
            <input type="hidden" name="game_mode" value={gameMode} />
          </div>

          {gameMode === 'football' && (
            <div className="space-y-2 rounded-lg border border-[#162c49] bg-[#0c1828] p-2">
              <label className="block text-xs text-slate-300">{t('match_price')}<input className="field mt-1 !py-2 text-sm" name="match_price" type="number" min="0" placeholder={`${t('match_price')} DZD`} required /></label>
              <label className="block text-xs text-slate-300">{t('prolongation_price')}<input className="field mt-1 !py-2 text-sm" name="prolongation_price" type="number" min="0" placeholder={`${t('prolongation_price')} DZD`} required /></label>
            </div>
          )}
          {gameMode !== 'party' && <label className="block text-xs text-slate-300">{t('notification_minutes')}<div className="mt-1 flex items-center gap-2"><input className="field !py-2 text-sm" name="notification_minutes" type="number" min="1" defaultValue={5} required /><span className="text-xs text-slate-500">{t('minutes_short')}</span></div></label>}
          <input className="field !py-2 text-sm" name="notes" placeholder={t('notes')} />

          <div>
            <p className="mb-1.5 text-xs text-slate-400">{t('game_color')}</p>
            <div className="flex flex-wrap gap-1.5">
              {GAME_COLORS.map(c => { const cs = colorStyle(c); return <button key={c} type="button" onClick={() => setGameColor(c)} className="flex items-center gap-1 rounded-lg border-2 px-1.5 py-0.5 transition" style={{ background: cs.bg, borderColor: gameColor === c ? cs.text : 'transparent' }}><span className="h-3 w-3 rounded-full" style={{ background: cs.text }} /><span className="text-xs" style={{ color: cs.text }}>{t(c)}</span></button>; })}
            </div>
            <input type="hidden" name="color" value={gameColor} />
          </div>
        </div>
        <button className="btn btn-primary mt-3 w-full !py-2 text-sm"><Plus size={15} />{t('add_pricing')}</button>
      </form>

      {/* Larger, more readable price list */}
      <div className="panel overflow-hidden">
        <div className="hidden grid-cols-12 gap-4 border-b border-[#22324d] px-5 py-3 text-xs uppercase tracking-wider text-slate-500 sm:grid">
          <span className="col-span-4">{t('game_prices')}</span>
          <span className="col-span-2">{t('duration')}</span>
          <span className="col-span-3">{t('price')}</span>
          <span className="col-span-2">{t('game_mode')}</span>
          <span className="col-span-1"></span>
        </div>
        {prices.length === 0 && <Empty text={t('no_prices')} />}
        {prices.map(price => { const cs = colorStyle(price.color || 'ocean'); return <div key={price.id} className="grid gap-2 border-b border-[#1b2a42] px-5 py-5 last:border-0 sm:grid-cols-12 sm:items-center">
          <span className="col-span-4 flex items-center gap-2 text-base font-bold"><span className="h-3.5 w-3.5 rounded-full" style={{ background: cs.text }} />{price.label}<small className="ml-1.5 text-sm font-normal" style={{ color: cs.text }}>{price.station_type}</small></span>
          <span className="col-span-2 text-sm text-slate-300">{price.game_mode === 'party' ? '—' : `${price.duration_minutes} ${t('minutes')}`}</span>
          <span className="col-span-3 text-lg font-bold text-[#20d26c]">{money(Number(price.price))}{price.game_mode === 'football' && <span className="ml-1 text-xs text-[#27baff]">/ {money(Number(price.match_price))} {t('per_match')}</span>}{price.game_mode === 'party' && <span className="ml-1 text-xs text-[#20d26c]">/ {t('per_party')}</span>}</span>
          <span className="col-span-2 text-sm">{price.game_mode === 'football' ? <span className="rounded-full bg-[#162c49] px-2.5 py-1 text-xs text-[#27baff]">{t('football')}</span> : price.game_mode === 'party' ? <span className="rounded-full bg-[#0d2018] px-2.5 py-1 text-xs text-[#20d26c]">{t('party_mode')}</span> : <span className="rounded-full bg-[#15293d] px-2.5 py-1 text-xs text-[#08b5ee]">{t('standard')}</span>}</span>
          <span className="col-span-1">{isAdmin && <button className="btn btn-danger p-1.5" onClick={() => onDelete(price)}><Trash2 size={14} /></button>}</span>
        </div>; })}
      </div>
    </div>

    {showDeleteAll && (
      <Modal title={t('delete_all_prices')} onClose={() => setShowDeleteAll(false)}>
        <p className="mb-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{t('delete_all_prices_confirm')}</p>
        <label className="block text-sm text-slate-300">{t('enter_admin_pin')}
          <input className="field mt-2 text-center text-xl tracking-[0.4em]" type="password" inputMode="numeric" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError(''); }} placeholder="----" autoFocus />
        </label>
        {pinError && <p className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{pinError}</p>}
        <div className="mt-4 flex gap-2">
          <button className="btn btn-danger flex-1" disabled={deleteBusy || pinInput.length < 1} onClick={confirmDeleteAll}>{deleteBusy ? '...' : t('delete_all')}</button>
          <button className="btn btn-ghost flex-1" disabled={deleteBusy} onClick={() => setShowDeleteAll(false)}>{t('cancel')}</button>
        </div>
      </Modal>
    )}
  </>;
}

// === Summary View ===
function SummaryView({ transactions, sessions, stations, products, clients, payments, t }: {
  transactions: Transaction[]; sessions: Session[]; stations: Station[]; products: Product[]; clients: Client[]; payments: ClientPayment[]; t: TFunc;
}) {
  const today = new Date().toDateString();
  const todayTx = transactions.filter(tx => new Date(tx.created_at).toDateString() === today);
  const totalRevenue = todayTx.reduce((s, tx) => s + Number(tx.total), 0);
  const gameRevenue = todayTx.filter(tx => tx.source === 'session').reduce((s, tx) => s + Number(tx.total), 0);
  const bevRevenue = todayTx.filter(tx => tx.source === 'sale' || tx.source === 'calculator').reduce((s, tx) => s + Number(tx.total), 0);
  const todayPayments = payments.filter(p => new Date(p.created_at).toDateString() === today);
  const paymentsTotal = todayPayments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = clients.reduce((s, c) => s + Number(c.balance), 0);
  const lowStock = products.filter(p => p.total_units <= 5).length;
  const todaySessions = sessions.filter(s => new Date(s.started_at).toDateString() === today).length;

  function doExport() {
    exportCSV(`daily_summary_${new Date().toISOString().slice(0,10)}.csv`, todayTx.map(tx => ({ date: tx.created_at, source: tx.source, worker: tx.worker_name, total: tx.total, paid: tx.paid })));
  }

  return <>
    <SectionTitle title={t('daily_summary')} subtitle={new Date().toLocaleDateString()} action={<button className="btn btn-ghost" onClick={doExport}><Download size={16} />{t('export_report')}</button>} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label={t('total_earnings')} value={money(totalRevenue)} icon={<CircleDollarSign />} color="green" />
      <Metric label={t('gaming_revenue')} value={money(gameRevenue)} icon={<Gamepad2 />} color="cyan" />
      <Metric label={t('transactions')} value={String(todayTx.length)} icon={<ShoppingBag />} color="blue" />
      <Metric label={t('low_stock_products')} value={String(lowStock)} icon={<Package />} color="amber" />
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="panel p-5">
        <h2 className="mb-4 font-bold">{t('business_pulse')}</h2>
        <div className="space-y-4">
          <SummaryLine label={t('sessions_count')} value={String(todaySessions)} />
          <SummaryLine label={t('stations_in_use')} value={`${stations.filter(s => s.status === 'in_use').length} / ${stations.length}`} />
          <SummaryLine label={t('revenue_from_beverages')} value={money(Math.max(0, bevRevenue))} />
          <SummaryLine label={t('stock_units_remaining')} value={String(products.reduce((n, p) => n + p.total_units, 0))} />
          <SummaryLine label={t('payments')} value={money(paymentsTotal)} />
          <SummaryLine label={t('outstanding_amounts')} value={money(outstanding)} />
        </div>
      </div>
      <div className="panel p-5">
        <h2 className="mb-4 font-bold">{t('latest_transactions')}</h2>
        {todayTx.slice(0, 8).map(tx => <div className="flex justify-between border-b border-[#1b2a42] py-3 text-sm last:border-0" key={tx.id}>
          <div><span className="capitalize text-slate-400">{tx.source}</span>{tx.worker_name && <span className="ml-2 text-xs text-slate-600">{tx.worker_name}</span>}</div>
          <strong className="text-[#20d26c]">{money(Number(tx.total))}</strong>
        </div>)}
        {todayTx.length === 0 && <Empty text={t('no_transactions')} />}
      </div>
    </div>
  </>;
}

// === Full Log View (Daily Archives) ===
function FullLogView({ archives, t }: { archives: DailyArchive[]; t: TFunc }) {
  const [dateFilter, setDateFilter] = useState('');
  const filtered = dateFilter ? archives.filter(a => a.archive_date === dateFilter) : archives;

  function doExport() {
    exportCSV(`full_log_${new Date().toISOString().slice(0,10)}.csv`, filtered.map(a => ({
      date: a.archive_date,
      total_revenue: a.total_revenue,
      gaming_revenue: a.gaming_revenue,
      beverage_revenue: a.beverage_revenue,
      payments_total: a.payments_total,
      sessions_count: a.sessions_count,
      transactions_count: a.transactions_count,
      outstanding_amount: a.outstanding_amount,
    })));
  }

  return <>
    <SectionTitle title={t('full_log')} subtitle={t('full_log_desc')} action={<button className="btn btn-ghost" onClick={doExport}><Download size={16} />{t('export_csv')}</button>} />
    <div className="mb-4 flex items-center gap-3">
      <label className="text-sm text-slate-400">{t('filter_by_date')}</label>
      <input type="date" className="field max-w-[200px]" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
      {dateFilter && <button className="btn btn-ghost p-2" onClick={() => setDateFilter('')}><X size={14} /></button>}
    </div>
    {filtered.length === 0 && <div className="panel p-8"><Empty text={t('no_archives')} /></div>}
    <div className="space-y-3">
      {filtered.map(arch => (
        <div key={arch.id} className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">{new Date(arch.archive_date + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <span className="rounded-lg bg-[#102b21] px-3 py-1.5 text-sm font-semibold text-[#20d26c]">{money(Number(arch.total_revenue))}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-[#1b2a42] p-3"><p className="text-xs text-slate-500">{t('gaming_rev')}</p><p className="font-semibold text-[#08b5ee]">{money(Number(arch.gaming_revenue))}</p></div>
            <div className="rounded-lg border border-[#1b2a42] p-3"><p className="text-xs text-slate-500">{t('beverage_rev')}</p><p className="font-semibold text-[#20d26c]">{money(Number(arch.beverage_revenue))}</p></div>
            <div className="rounded-lg border border-[#1b2a42] p-3"><p className="text-xs text-slate-500">{t('payments')}</p><p className="font-semibold text-[#4798ff]">{money(Number(arch.payments_total))}</p></div>
            <div className="rounded-lg border border-[#1b2a42] p-3"><p className="text-xs text-slate-500">{t('sessions_today')}</p><p className="font-semibold">{arch.sessions_count}</p></div>
            <div className="rounded-lg border border-[#1b2a42] p-3"><p className="text-xs text-slate-500">{t('tx_count')}</p><p className="font-semibold">{arch.transactions_count}</p></div>
            <div className="rounded-lg border border-[#1b2a42] p-3"><p className="text-xs text-slate-500">{t('outstanding_amounts')}</p><p className="font-semibold text-[#ffb13b]">{money(Number(arch.outstanding_amount))}</p></div>
          </div>
        </div>
      ))}
    </div>
  </>;
}

// === Log Management View (Audit Trail) ===
function LogManagementView({ logs, t }: { logs: AuditLog[]; t: TFunc }) {
  function doExport() {
    exportCSV(`log_management_${new Date().toISOString().slice(0,10)}.csv`, logs.map(l => ({
      timestamp: l.created_at,
      user: l.worker_name,
      action: l.action,
      entity: l.entity,
      details: JSON.stringify(l.details),
    })));
  }

  return <>
    <SectionTitle title={t('log_management')} subtitle={t('log_management_desc')} action={<button className="btn btn-ghost" onClick={doExport}><Download size={16} />{t('export_csv')}</button>} />
    <div className="panel overflow-hidden">
      {logs.length === 0 && <Empty text={t('no_audit_logs')} />}
      {logs.length > 0 && (
        <div className="hidden grid-cols-4 gap-4 border-b border-[#22324d] px-5 py-3 text-xs uppercase tracking-wider text-slate-500 sm:grid">
          <span>{t('timestamp')}</span><span>{t('user')}</span><span>{t('action')}</span><span>{t('details')}</span>
        </div>
      )}
      {logs.map(log => (
        <div key={log.id} className="grid gap-2 border-b border-[#1b2a42] px-5 py-4 last:border-0 sm:grid-cols-4 sm:items-start">
          <time className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</time>
          <div><span className="rounded-full bg-[#172c40] px-2 py-1 text-xs text-[#08b5ee]">{log.worker_name || '—'}</span></div>
          <div><p className="font-semibold text-sm">{log.action}</p>{log.entity && <p className="text-xs text-slate-500">{log.entity}</p>}</div>
          <p className="text-xs text-slate-500">{Object.entries(log.details || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}</p>
        </div>
      ))}
    </div>
  </>;
}

// === Calculator View ===
type CalcItem = { key: string; type: 'game' | 'product' | 'custom'; label: string; qty: number; unitPrice: number };

function CalculatorView({ prices, products, stationTypes, workerName, onSaved, onLog, t }: {
  prices: PriceRule[]; products: Product[]; stationTypes: StationType[]; workerName: string; onSaved: () => void; onLog: (a: string, e?: string, o?: Record<string, unknown>, n?: Record<string, unknown>, d?: Record<string, string>) => void; t: TFunc;
}) {
  const [cart, setCart] = useState<CalcItem[]>([]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [customLabel, setCustomLabel] = useState('');
  const [customPrice, setCustomPrice] = useState(0);

  const total = cart.reduce((s, item) => s + item.unitPrice * item.qty, 0);
  const change = amountPaid - total;

  function addToCart(item: CalcItem) {
    const existing = cart.find(c => c.key === item.key);
    if (existing) { setCart(cart.map(c => c.key === item.key ? { ...c, qty: c.qty + 1 } : c)); }
    else { setCart([...cart, item]); }
  }
  function addGame(rule: PriceRule) {
    addToCart({ key: `game_${rule.id}`, type: 'game', label: rule.label, qty: 1, unitPrice: Number(rule.price) });
  }
  function addProduct(prod: Product) {
    if (prod.total_units <= 0) return;
    addToCart({ key: `product_${prod.id}`, type: 'product', label: prod.name, qty: 1, unitPrice: Number(prod.selling_price) });
  }
  function addCustom() {
    if (!customLabel.trim() || customPrice <= 0) return;
    const key = `custom_${Date.now()}`;
    setCart([...cart, { key, type: 'custom', label: customLabel.trim(), qty: 1, unitPrice: customPrice }]);
    setCustomLabel('');
    setCustomPrice(0);
  }
  function removeItem(key: string) { setCart(cart.filter(c => c.key !== key)); }
  function editQty(key: string, qty: number) { setCart(cart.map(c => c.key === key ? { ...c, qty: Math.max(1, qty) } : c)); }
  function clearCart() { setCart([]); setAmountPaid(0); }

  const gameGroups = stationTypes.map(st => ({ type: st, games: prices.filter(p => p.station_type === st.name) })).filter(g => g.games.length > 0);
  const drinks = products;

  async function save() {
    if (cart.length === 0 || !total) return;
    const paid = amountPaid > 0 ? amountPaid : total;
    const { data } = await supabase.from('app_transactions').insert({
      source: 'calculator', worker_name: workerName, total, paid,
    }).select().maybeSingle();
    if (data) {
      await supabase.from('app_transaction_items').insert(cart.map(item => ({
        transaction_id: data.id, item_type: item.type === 'custom' ? 'game' : item.type, label: item.label, quantity: item.qty, unit_price: item.unitPrice,
      })));
      const productItems = cart.filter(c => c.type === 'product');
      for (const item of productItems) {
        const product = products.find(p => p.name === item.label);
        if (product) {
          const newTotal = Math.max(0, product.total_units - item.qty);
          await supabase.from('app_products').update({ total_units: newTotal }).eq('id', product.id);
        }
      }
      await onLog('Calculator transaction', 'transaction', undefined, { total, paid, change: Math.max(0, change) }, { total: String(total), worker: workerName });
      await onSaved();
      clearCart();
    }
  }

  const tileBase = "group relative flex flex-col items-center justify-center gap-1 rounded-xl border p-4 text-center transition hover:scale-[1.03] hover:shadow-lg cursor-pointer";

  return <>
    <SectionTitle title={t('calculator')} subtitle={t('tap_to_add')} />
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <div className="space-y-5">
        {/* Game groups by station type */}
        {gameGroups.map(g => {
          const tcs = colorStyle(g.type.color || 'ocean');
          return (
            <div key={g.type.id} className="panel p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: tcs.text }}><Gamepad2 size={16} />{g.type.label}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {g.games.map(rule => (
                  <button key={rule.id} className={`${tileBase}`} style={{ background: tcs.bg, borderColor: tcs.border }} onClick={() => addGame(rule)}>
                    <span className="text-sm font-semibold text-slate-200">{rule.label}</span>
                    <span className="text-xs" style={{ color: tcs.text }}>{money(Number(rule.price))}</span>
                    <span className="text-[10px] text-slate-500">{rule.duration_minutes} {t('minutes')}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Drinks group */}
        {drinks.length > 0 && (
          <div className="panel p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#08b5ee]"><Coffee size={16} />{t('drinks')}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {drinks.map(prod => (
                <button key={prod.id} disabled={prod.total_units <= 0} className={`${tileBase} border-[#15293d] bg-[#0c1828] hover:border-[#08b5ee] disabled:cursor-not-allowed disabled:opacity-30`} onClick={() => addProduct(prod)}>
                  <span className="text-sm font-semibold text-slate-200">{prod.name}</span>
                  <span className="text-xs text-[#08b5ee]">{money(Number(prod.selling_price))}</span>
                  <span className="text-[10px] text-slate-500">{prod.total_units} {t('units')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom item row */}
        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-300">{t('custom_item')}</h3>
          <div className="grid grid-cols-[1fr_100px_60px] gap-2">
            <input className="field" placeholder={t('custom_item')} value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
            <input className="field" type="number" min="0" placeholder={t('price')} value={customPrice || ''} onChange={e => setCustomPrice(Number(e.target.value))} />
            <button className="btn btn-primary" onClick={addCustom}><Plus size={16} /></button>
          </div>
        </div>
      </div>

      {/* Cart + payment panel */}
      <div className="panel sticky top-20 h-fit p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{t('new_transaction')}</h2>
          <span className="text-xs text-slate-500">{workerName}</span>
        </div>

        {cart.length === 0 ? <Empty text={t('tap_to_add')} /> : (
          <div className="space-y-2">{cart.map(item => (
            <div key={item.key} className="flex items-center gap-2 rounded-lg border border-[#1b2a42] p-3">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.type === 'game' ? 'bg-[#162c49] text-[#27baff]' : item.type === 'product' ? 'bg-[#102b21] text-[#20d26c]' : 'bg-[#32231b] text-[#ffb13b]'}`}>{item.type === 'game' ? 'Game' : item.type === 'product' ? 'Drink' : 'Custom'}</span>
              <span className="flex-1 text-sm">{item.label}</span>
              <button className="btn btn-ghost p-1" onClick={() => editQty(item.key, item.qty - 1)}><span className="text-xs">−</span></button>
              <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
              <button className="btn btn-ghost p-1" onClick={() => editQty(item.key, item.qty + 1)}><Plus size={12} /></button>
              <span className="w-20 text-right text-sm font-semibold">{money(item.unitPrice * item.qty)}</span>
              <button className="btn btn-danger p-1" onClick={() => removeItem(item.key)}><X size={14} /></button>
            </div>
          ))}
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">{t('total')}</span>
            <span className="text-2xl font-bold text-[#20d26c]">{money(total)}</span>
          </div>
          <label className="block text-sm text-slate-400">{t('amount_paid')}
            <input className="field mt-1" type="number" min="0" value={amountPaid || ''} onChange={e => setAmountPaid(Number(e.target.value))} placeholder={String(total)} />
          </label>
          {amountPaid > 0 && (
            <div className="flex items-center justify-between rounded-lg p-3" style={{ background: change >= 0 ? '#0d2018' : '#2a0f12' }}>
              <span className="text-sm">{t('change_owed')}</span>
              <span className={`text-lg font-bold ${change >= 0 ? 'text-[#20d26c]' : 'text-[#ff4650]'}`}>{change >= 0 ? money(change) : money(Math.abs(change))}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={clearCart} disabled={cart.length === 0} className="btn btn-ghost flex-1 disabled:opacity-40"><Trash2 size={16} />{t('clear_cart')}</button>
            <button onClick={save} disabled={!total} className="btn btn-primary flex-1 disabled:opacity-40"><Check size={16} />{t('save_transaction')}</button>
          </div>
        </div>
      </div>
    </div>
  </>;
}

// === Storage View ===
function StorageView({ products, onSave, onRestock, onEdit, onDelete, onDeleteAll, onVerifyAdminPin, t }: {
  products: Product[]; onSave: (e: FormEvent<HTMLFormElement>) => void; onRestock: (p: Product, n: number) => void; onEdit: (p: Product, u: Partial<Product>) => void; onDelete: (p: Product) => void; onDeleteAll: () => Promise<boolean>; onVerifyAdminPin: (pin: string) => Promise<boolean>; t: TFunc;
}) {
  const [restockModal, setRestockModal] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [editModal, setEditModal] = useState<Product | null>(null);
  const [formCategory, setFormCategory] = useState('beverage');
  const [formColor, setFormColor] = useState('ocean');
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function confirmDeleteAll() {
    setPinError('');
    setDeleteBusy(true);
    const ok = await onVerifyAdminPin(pinInput);
    if (!ok) { setPinError(t('wrong_pin')); setDeleteBusy(false); return; }
    const success = await onDeleteAll();
    setDeleteBusy(false);
    if (success) { setShowDeleteAll(false); setPinInput(''); }
    else setPinError(t('delete_failed'));
  }

  const categoryLabel = (cat: string) => cat === 'beverage' ? t('drink') : cat === 'snack' ? t('snack') : t('accessory');
  return <>
    <SectionTitle title={t('storage')} subtitle="Full inventory management." action={
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-[#102b21] px-3 py-2 text-sm text-[#20d26c]">{products.reduce((n, p) => n + p.total_units, 0)} {t('units_on_hand')}</span>
        {products.length > 0 && <button className="btn btn-danger" onClick={() => { setShowDeleteAll(true); setPinInput(''); setPinError(''); }}><Trash2 size={15} />{t('delete_all')}</button>}
      </div>
    } />
    <div className="grid gap-5 xl:grid-cols-[1.05fr_1.6fr]">
      <form onSubmit={onSave} className="panel p-5">
        <h2 className="mb-4 font-bold">{t('add_product')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="field sm:col-span-2" name="name" placeholder={t('product_name')} required />
          <select className="field" name="category" value={formCategory} onChange={e => { setFormCategory(e.target.value); setFormColor(CATEGORY_COLORS[e.target.value] ?? 'ocean'); }}><option value="beverage">{t('drink')}</option><option value="snack">{t('snack')}</option><option value="accessory">{t('accessory')}</option></select>
          <input className="field" name="total_units" type="number" min="0" placeholder={t('total_units')} required />
          <input className="field" name="purchase" type="number" min="0" placeholder={t('purchase_price_per_unit')} required />
          <input className="field" name="selling" type="number" min="0" placeholder={t('selling_price')} required />
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm text-slate-300">{t('product_color')}</p>
            <div className="flex gap-2">
              {GAME_COLORS.map(c => { const cs = colorStyle(c); return <label key={c} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-2 py-1 transition hover:scale-105 ${formColor === c ? 'ring-2 ring-offset-1 ring-offset-[#0a1524]' : 'border-transparent'}`} style={{ background: cs.bg, borderColor: formColor === c ? cs.text : 'transparent' }}><input type="radio" name="color" value={c} checked={formColor === c} onChange={() => setFormColor(c)} className="sr-only" /><span className="h-4 w-4 rounded-full" style={{ background: cs.text }} /><span className="text-xs" style={{ color: cs.text }}>{t(c)}</span></label>; })}
            </div>
          </div>
        </div>
        <button className="btn btn-primary mt-4 w-full"><Plus size={16} />{t('add_product')}</button>
      </form>
      <div className="space-y-3">
        {products.length === 0 && <Empty text={t('no_products')} />}
        {products.map(product => { const cs = colorStyle(product.color); return <div className="panel flex flex-wrap items-center justify-between gap-4 p-4" key={product.id}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-3" style={{ background: cs.iconBg, color: cs.text }}><Package size={20} /></div>
            <div>
              <h3 className="font-semibold">{product.name}</h3>
              <p className="text-xs text-slate-400">{t('unit_cost')}: {money(product.purchase_price)} · {t('selling_price')}: {money(product.selling_price)} / unit · <span style={{ color: cs.text }}>{categoryLabel(product.category)}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold">{product.total_units} {t('units')}</p>
              <p className={`text-xs ${product.total_units === 0 ? 'text-red-400' : product.total_units <= 5 ? 'text-amber-400' : 'text-slate-400'}`}>{product.total_units === 0 ? t('out_of_stock') : product.total_units <= 5 ? t('low_stock') : ''}</p>
            </div>
            <button className="btn btn-ghost p-2" onClick={() => { setEditModal(product); }}><Pencil size={15} /></button>
            <button className="btn btn-danger p-2" onClick={() => { if (confirm(t('confirm_delete'))) onDelete(product); }}><Trash2 size={15} /></button>
            <button className="btn btn-primary p-2" onClick={() => { setRestockModal(product); setRestockQty(1); }} title={t('add_stock')}><Plus size={17} /></button>
          </div>
        </div>; })}
      </div>
    </div>
    {restockModal && <Modal title={`${t('add_stock')} · ${restockModal.name}`} onClose={() => setRestockModal(null)}>
      <label className="block text-sm text-slate-300">{t('units_to_add')}<input className="field mt-2" type="number" min="1" value={restockQty} onChange={e => setRestockQty(Number(e.target.value))} autoFocus /></label>
      <p className="mt-2 text-xs text-slate-500">+{restockQty} {t('units')} → {restockModal.total_units + restockQty} {t('units_on_hand')}</p>
      <button className="btn btn-primary mt-4 w-full" onClick={() => { onRestock(restockModal, restockQty); setRestockModal(null); }}><Check size={16} />{t('save')}</button>
    </Modal>}
    {editModal && <EditProductModal product={editModal} onClose={() => setEditModal(null)} onSave={(u) => { onEdit(editModal, u); setEditModal(null); }} t={t} />}
    {showDeleteAll && (
      <Modal title={t('delete_all_products')} onClose={() => setShowDeleteAll(false)}>
        <p className="mb-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{t('delete_all_products_confirm')}</p>
        <label className="block text-sm text-slate-300">{t('enter_admin_pin')}
          <input className="field mt-2 text-center text-xl tracking-[0.4em]" type="password" inputMode="numeric" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError(''); }} placeholder="----" autoFocus />
        </label>
        {pinError && <p className="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{pinError}</p>}
        <div className="mt-4 flex gap-2">
          <button className="btn btn-danger flex-1" disabled={deleteBusy || pinInput.length < 1} onClick={confirmDeleteAll}>{deleteBusy ? '...' : t('delete_all')}</button>
          <button className="btn btn-ghost flex-1" disabled={deleteBusy} onClick={() => setShowDeleteAll(false)}>{t('cancel')}</button>
        </div>
      </Modal>
    )}
  </>;
}

function EditProductModal({ product, onClose, onSave, t }: { product: Product; onClose: () => void; onSave: (u: Partial<Product>) => void; t: TFunc }) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [totalUnits, setTotalUnits] = useState(product.total_units);
  const [purchasePrice, setPurchasePrice] = useState(product.purchase_price);
  const [sellingPrice, setSellingPrice] = useState(product.selling_price);
  const [color, setColor] = useState(product.color || CATEGORY_COLORS[product.category] || 'ocean');
  return <Modal title={`${t('edit')} · ${product.name}`} onClose={onClose}>
    <div className="space-y-3">
      <label className="block text-sm text-slate-300">{t('product_name')}<input className="field mt-2" value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block text-sm text-slate-300">{t('category')}<select className="field mt-2" value={category} onChange={e => { setCategory(e.target.value); setColor(CATEGORY_COLORS[e.target.value] ?? 'ocean'); }}><option value="beverage">{t('drink')}</option><option value="snack">{t('snack')}</option><option value="accessory">{t('accessory')}</option></select></label>
      <label className="block text-sm text-slate-300">{t('total_units')}<input className="field mt-2" type="number" min="0" value={totalUnits} onChange={e => setTotalUnits(Number(e.target.value))} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-slate-300">{t('purchase_price_per_unit')}<input className="field mt-2" type="number" min="0" value={purchasePrice} onChange={e => setPurchasePrice(Number(e.target.value))} /></label>
        <label className="block text-sm text-slate-300">{t('selling_price')}<input className="field mt-2" type="number" min="0" value={sellingPrice} onChange={e => setSellingPrice(Number(e.target.value))} /></label>
      </div>
      <div>
        <p className="mb-2 text-sm text-slate-300">{t('product_color')}</p>
        <div className="flex gap-2">
          {GAME_COLORS.map(c => { const cs = colorStyle(c); return <button key={c} type="button" onClick={() => setColor(c)} className="flex items-center gap-1.5 rounded-lg border-2 px-2 py-1 transition" style={{ background: cs.bg, borderColor: color === c ? cs.text : 'transparent' }}><span className="h-4 w-4 rounded-full" style={{ background: cs.text }} /><span className="text-xs" style={{ color: cs.text }}>{t(c)}</span></button>; })}
        </div>
      </div>
    </div>
    <button className="btn btn-primary mt-4 w-full" onClick={() => onSave({ name, category, units_per_box: 1, total_units: totalUnits, purchase_price: purchasePrice, selling_price: sellingPrice, color })}><Check size={16} />{t('save')}</button>
  </Modal>;
}

// === Clients View ===
function ClientsView({ clients, payments, onSave, onEdit, onPayment, workerName, onLog, t }: {
  clients: Client[]; payments: ClientPayment[]; onSave: (e: FormEvent<HTMLFormElement>) => void; onEdit: (c: Client, u: Partial<Client>) => void; onPayment: (c: Client, a: number) => void; workerName: string; onLog: (a: string, e?: string, o?: Record<string, unknown>, n?: Record<string, unknown>, d?: Record<string, string>) => void; t: TFunc;
}) {
  const [payModal, setPayModal] = useState<Client | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [editModal, setEditModal] = useState<Client | null>(null);
  const [historyModal, setHistoryModal] = useState<Client | null>(null);

  return <>
    <SectionTitle title={t('clients')} subtitle="Keep customer balances and payment history close at hand." />
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.4fr]">
      <form onSubmit={onSave} className="panel p-5">
        <h2 className="mb-4 font-bold">{t('add_client')}</h2>
        <div className="space-y-3">
          <input className="field" name="name" placeholder={t('customer_name')} required />
          <input className="field" name="phone" placeholder={t('phone_optional')} />
        </div>
        <button className="btn btn-primary mt-4 w-full"><Plus size={16} />{t('add_client')}</button>
      </form>
      <div className="panel overflow-hidden">
        {clients.length === 0 && <Empty text={t('no_clients')} />}
        {clients.map(client => <div className="flex items-center justify-between border-b border-[#1b2a42] px-5 py-4 last:border-0" key={client.id}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[#172c40] p-2 text-[#08b5ee]"><UserRound size={17} /></div>
            <div>
              <p className="font-semibold">{client.name}</p>
              <p className="text-xs text-slate-500">{client.phone || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className={`font-semibold ${Number(client.balance) > 0 ? 'text-amber-400' : 'text-[#20d26c]'}`}>{money(Number(client.balance))}</p>
              <p className="text-xs text-slate-500">{t('outstanding')}</p>
            </div>
            <button className="btn btn-ghost p-2" onClick={() => setHistoryModal(client)} title={t('debt_history')}><Clock size={15} /></button>
            <button className="btn btn-ghost p-2" onClick={() => setEditModal(client)} title={t('edit')}><Pencil size={15} /></button>
            {Number(client.balance) > 0 && <button className="btn btn-primary p-2" onClick={() => { setPayModal(client); setPayAmount(Number(client.balance)); }} title={t('record_payment')}><CircleDollarSign size={15} /></button>}
          </div>
        </div>)}
      </div>
    </div>
    {payModal && <Modal title={`${t('record_payment')} · ${payModal.name}`} onClose={() => setPayModal(null)}>
      <label className="block text-sm text-slate-300">{t('payment')} ({t('balance')}: {money(Number(payModal.balance))})<input className="field mt-2" type="number" min="1" max={Number(payModal.balance)} value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} autoFocus /></label>
      <button className="btn btn-primary mt-4 w-full" onClick={() => { onPayment(payModal, payAmount); setPayModal(null); }}><Check size={16} />{t('save')}</button>
    </Modal>}
    {editModal && <EditClientModal client={editModal} onClose={() => setEditModal(null)} onSave={(u) => { onEdit(editModal, u); setEditModal(null); }} t={t} />}
    {historyModal && <Modal title={`${t('debt_history')} · ${historyModal.name}`} onClose={() => setHistoryModal(null)}>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {payments.filter(p => p.client_id === historyModal.id).map(p => <div key={p.id} className="flex justify-between border-b border-[#1b2a42] py-2 text-sm"><div><span className="text-[#20d26c]">{money(Number(p.amount))}</span>{p.worker_name && <span className="ml-2 text-xs text-slate-500">{p.worker_name}</span>}</div><time className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</time></div>)}
        {payments.filter(p => p.client_id === historyModal.id).length === 0 && <Empty text="No payments recorded." />}
      </div>
    </Modal>}
  </>;
}

function EditClientModal({ client, onClose, onSave, t }: { client: Client; onClose: () => void; onSave: (u: Partial<Client>) => void; t: TFunc }) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone || '');
  return <Modal title={`${t('edit')} · ${client.name}`} onClose={onClose}>
    <div className="space-y-3">
      <label className="block text-sm text-slate-300">{t('customer_name')}<input className="field mt-2" value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block text-sm text-slate-300">{t('phone_optional')}<input className="field mt-2" value={phone} onChange={e => setPhone(e.target.value)} /></label>
    </div>
    <button className="btn btn-primary mt-4 w-full" onClick={() => onSave({ name, phone })}><Check size={16} />{t('save')}</button>
  </Modal>;
}

// === Reminders View (each reminder links to its place: product / station / client) ===
function RemindersView({ reminders, products, stations, clients, onSave, onEdit, onDelete, onToggle, onGoto, t }: {
  reminders: Reminder[]; products: Product[]; stations: Station[]; clients: Client[];
  onSave: (e: FormEvent<HTMLFormElement>) => void; onEdit: (r: Reminder, u: Partial<Reminder>) => void; onDelete: (r: Reminder) => void; onToggle: (r: Reminder) => void; onGoto: (v: View) => void; t: TFunc;
}) {
  const [editModal, setEditModal] = useState<Reminder | null>(null);
  const [editMsg, setEditMsg] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editKind, setEditKind] = useState<Reminder['link_kind']>('none');
  const [editLinkId, setEditLinkId] = useState('');
  const [newKind, setNewKind] = useState<Reminder['link_kind']>('none');
  const [newLinkId, setNewLinkId] = useState('');

  function linkTarget(r: Reminder): View {
    if (r.link_kind === 'product') return 'storage';
    if (r.link_kind === 'station') return 'control';
    if (r.link_kind === 'client') return 'clients';
    return 'reminders';
  }
  function linkName(r: Reminder): string | null {
    if (r.link_kind === 'product') {
      const p = products.find(x => x.id === r.link_id);
      return p ? p.name : (r.link_label ?? null);
    }
    if (r.link_kind === 'station') {
      const s = stations.find(x => x.id === r.link_id);
      return s ? s.name : (r.link_label ?? null);
    }
    if (r.link_kind === 'client') {
      const c = clients.find(x => x.id === r.link_id);
      return c ? c.name : (r.link_label ?? null);
    }
    return null;
  }
  function linkBroken(r: Reminder): boolean {
    if (r.link_kind === 'product') return !!r.link_id && !products.some(x => x.id === r.link_id);
    if (r.link_kind === 'station') return !!r.link_id && !stations.some(x => x.id === r.link_id);
    if (r.link_kind === 'client') return !!r.link_id && !clients.some(x => x.id === r.link_id);
    return false;
  }

  const linkOptions = (kind: Reminder['link_kind']) =>
    kind === 'product' ? products.map(p => ({ id: p.id, label: p.name }))
    : kind === 'station' ? stations.map(s => ({ id: s.id, label: s.name }))
    : kind === 'client' ? clients.map(c => ({ id: c.id, label: c.name }))
    : [];

  return <>
    <SectionTitle title={t('reminders')} subtitle={t('reminders_desc')} />
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.4fr]">
      <form onSubmit={onSave} className="panel p-5">
        <h2 className="mb-4 font-bold">{t('add_reminder')}</h2>
        <div className="space-y-3">
          <input className="field" name="message" placeholder={t('message')} required />
          <div className="grid grid-cols-2 gap-3">
            <input className="field" name="date" type="date" required />
            <input className="field" name="time" type="time" required />
          </div>
          <label className="block text-sm text-slate-300">{t('linked_to')}
            <select className="field mt-2" name="link_kind" value={newKind} onChange={e => { setNewKind(e.target.value as Reminder['link_kind']); setNewLinkId(''); }}>
              <option value="none">{t('link_none')}</option>
              <option value="product">{t('link_product')}</option>
              <option value="station">{t('link_station')}</option>
              <option value="client">{t('link_client')}</option>
            </select>
          </label>
          {newKind !== 'none' && (
            <select className="field" name="link_id" value={newLinkId} onChange={e => setNewLinkId(e.target.value)} required>
              <option value="">{t('choose_linked')}</option>
              {linkOptions(newKind).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          )}
        </div>
        <button className="btn btn-primary mt-4 w-full"><Plus size={16} />{t('add_reminder')}</button>
      </form>
      <div className="space-y-3">
        {reminders.length === 0 && <Empty text={t('no_reminders')} />}
        {reminders.map(r => {
          const due = new Date(r.due_at);
          const isOverdue = !r.completed && due.getTime() <= Date.now();
          const name = linkName(r);
          const broken = linkBroken(r);
          return <div key={r.id} className={`panel flex items-center justify-between gap-4 p-4 ${r.completed ? 'opacity-50' : ''} ${isOverdue ? 'border-amber-700' : ''}`}>
            <div className="flex min-w-0 items-center gap-3">
              <button className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${r.completed ? 'border-[#20d26c] bg-[#20d26c] text-[#05100a]' : 'border-slate-600'}`} onClick={() => onToggle(r)}>{r.completed && <Check size={14} />}</button>
              <div className="min-w-0">
                <p className={`font-semibold ${r.completed ? 'line-through' : ''}`}>{r.message}</p>
                <p className={`text-xs ${isOverdue ? 'text-amber-400' : 'text-slate-500'}`}>{due.toLocaleString()}</p>
                {r.link_kind !== 'none' && (
                  broken
                    ? <p className="mt-1 text-xs text-red-400">{t('link_deleted')}</p>
                    : name && <button className="mt-1 text-xs underline-offset-4 hover:underline" style={{ color: 'var(--accent)' }} onClick={() => onGoto(linkTarget(r))}>{name}</button>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button className="btn btn-ghost p-2" onClick={() => { setEditModal(r); setEditMsg(r.message); setEditDate(due.toISOString().slice(0, 10)); setEditTime(due.toTimeString().slice(0, 5)); setEditKind(r.link_kind ?? 'none'); setEditLinkId(r.link_id ?? ''); }}><Pencil size={14} /></button>
              <button className="btn btn-danger p-2" onClick={() => onDelete(r)}><Trash2 size={14} /></button>
            </div>
          </div>;
        })}
      </div>
    </div>
    {editModal && <Modal title={t('edit')} onClose={() => setEditModal(null)}>
      <div className="space-y-3">
        <label className="block text-sm text-slate-300">{t('message')}<input className="field mt-2" value={editMsg} onChange={e => setEditMsg(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-slate-300">{t('date')}<input className="field mt-2" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></label>
          <label className="block text-sm text-slate-300">{t('time')}<input className="field mt-2" type="time" value={editTime} onChange={e => setEditTime(e.target.value)} /></label>
        </div>
        <label className="block text-sm text-slate-300">{t('linked_to')}
          <select className="field mt-2" value={editKind} onChange={e => { setEditKind(e.target.value as Reminder['link_kind']); setEditLinkId(''); }}>
            <option value="none">{t('link_none')}</option>
            <option value="product">{t('link_product')}</option>
            <option value="station">{t('link_station')}</option>
            <option value="client">{t('link_client')}</option>
          </select>
        </label>
        {editKind !== 'none' && (
          <select className="field" value={editLinkId} onChange={e => setEditLinkId(e.target.value)}>
            <option value="">{t('choose_linked')}</option>
            {linkOptions(editKind).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        )}
      </div>
      <button className="btn btn-primary mt-4 w-full" onClick={() => {
        const kind = editKind;
        const lid = editLinkId.trim() || null;
        const label = kind === 'product' ? products.find(p => p.id === lid)?.name ?? null
          : kind === 'station' ? stations.find(s => s.id === lid)?.name ?? null
          : kind === 'client' ? clients.find(c => c.id === lid)?.name ?? null : null;
        onEdit(editModal, { message: editMsg, due_at: `${editDate}T${editTime}:00`, link_kind: kind, link_id: lid, link_label: label });
        setEditModal(null);
      }}><Check size={16} />{t('save')}</button>
    </Modal>}
  </>;
}

// === Workers View (read-only monitoring) ===
function WorkersView({ workers, t }: {
  workers: Worker[]; t: TFunc;
}) {
  const roleColors: Record<string, string> = {
    admin: 'bg-[#102b21] text-[#20d26c]',
    sub_admin: 'bg-[#2a1f4a] text-[#a78bfa]',
    worker: 'bg-[#172c40] text-[#08b5ee]',
  };
  const roleIcons: Record<string, ReactNode> = {
    admin: <Crown size={16} />,
    sub_admin: <Shield size={16} />,
    worker: <UserRound size={16} />,
  };
  const roleLabels: Record<string, string> = {
    admin: t('role_admin'), sub_admin: t('role_sub_admin'), worker: t('role_worker'),
  };

  function isReallyOnline(w: Worker): boolean {
    if (!w.last_heartbeat_at) return false;
    return Date.now() - new Date(w.last_heartbeat_at).getTime() < 60000;
  }

  function sessionDuration(w: Worker): string | null {
    if (!w.session_started_at) return null;
    const secs = Math.floor((Date.now() - new Date(w.session_started_at).getTime()) / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const sorted = [...workers].sort((a, b) => {
    const ao = isReallyOnline(a) ? 0 : 1;
    const bo = isReallyOnline(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });

  return <>
    <SectionTitle title={t('workers')} subtitle="Real-time presence and connection info for your team." />
    <div className="panel overflow-hidden">
      {sorted.length === 0 && <Empty text={t('no_pins')} />}
      {sorted.map(w => {
        const online = isReallyOnline(w);
        const duration = sessionDuration(w);
        return <div key={w.id} className="flex flex-col gap-3 border-b border-[#1b2a42] px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${roleColors[w.role] || roleColors.worker}`}>{roleIcons[w.role] || <UserRound size={16} />}</div>
            <div>
              <p className="font-semibold">{w.name || <span className="text-slate-500 italic">Unnamed</span>}</p>
              <p className="text-xs text-slate-500">{roleLabels[w.role] || w.role} · {w.active ? t('active') : t('disabled')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <span className={`flex items-center gap-1.5 ${online ? 'text-[#20d26c]' : 'text-slate-600'}`}>
              <span className={`h-2 w-2 rounded-full ${online ? 'bg-[#20d26c] shadow-[0_0_6px_#20d26c]' : 'bg-slate-600'}`} />
              {online ? t('online') : t('offline')}
            </span>
            {online && duration && (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Clock size={12} />{duration}
              </span>
            )}
            {w.browser && (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Globe size={12} />{w.browser}
              </span>
            )}
            {w.device_type && (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Monitor size={12} />{w.device_type}
              </span>
            )}
            {w.ip_address && w.ip_address !== 'unknown' && (
              <span className="flex items-center gap-1.5 text-slate-400">
                <MapPin size={12} />{w.ip_address}
              </span>
            )}
            {w.last_login_at && !online && (
              <span className="text-slate-500">{t('last_login')}: {new Date(w.last_login_at).toLocaleString()}</span>
            )}
            {!w.last_login_at && <span className="text-slate-600">{t('never_logged_in')}</span>}
          </div>
        </div>;
      })}
    </div>
  </>;
}

// === Admin Panel View (PIN Management) ===
function AdminView({ workers, settings, currentRole, currentWorkerId, onSaveWorker, onEditWorker, onDeleteWorker, onSaveSettings, onLog, t }: {
  workers: Worker[]; settings: Settings; currentRole: Role; currentWorkerId: string;
  onSaveWorker: (e: FormEvent<HTMLFormElement>) => void;
  onEditWorker: (w: Worker, u: Partial<Worker>) => void;
  onDeleteWorker: (w: Worker) => void;
  onSaveSettings: (e: FormEvent<HTMLFormElement>) => void;
  onLog: (a: string, e?: string, o?: Record<string, unknown>, n?: Record<string, unknown>, d?: Record<string, string>) => void;
  t: TFunc;
}) {
  const [pinEditModal, setPinEditModal] = useState<Worker | null>(null);
  const [newPin, setNewPin] = useState('');

  const isAdmin = currentRole === 'admin';

  async function savePinChange(worker: Worker, pin: string) {
    // Never write the raw PIN into the audit log — record only that it changed.
    onEditWorker(worker, { pin });
    await onLog('PIN changed', 'worker', { name: worker.name }, { changed: true }, { name: worker.name });
    setPinEditModal(null);
    setNewPin('');
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-[#102b21] text-[#20d26c]',
    sub_admin: 'bg-[#2a1f4a] text-[#a78bfa]',
    worker: 'bg-[#172c40] text-[#08b5ee]',
  };
  const roleIcons: Record<string, ReactNode> = {
    admin: <Crown size={16} />,
    sub_admin: <Shield size={16} />,
    worker: <UserRound size={16} />,
  };

  // Admin sees all workers; sub_admin sees only workers (not admins or other sub_admins)
  const visibleWorkers = isAdmin
    ? workers
    : workers.filter(w => w.role === 'worker' || w.id === currentWorkerId);

  function canDelete(w: Worker): boolean {
    if (w.id === currentWorkerId) return false;
    // Never allow deleting the last active admin — that would lock the café out.
    if (w.role === 'admin' && workers.filter(x => x.role === 'admin' && x.active).length <= 1) return false;
    if (isAdmin) return true;
    return w.role === 'worker';
  }

  return <>
    <SectionTitle title={t('admin_panel')} subtitle={t('pin_management')} action={<span className="flex items-center gap-2 rounded-lg bg-[var(--accent-bg)] px-3 py-2 text-sm" style={{ color: 'var(--accent)' }}><Shield size={16} />{isAdmin ? t('admin') : t('sub_admin')}</span>} />

    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      {/* Add worker form */}
      <form onSubmit={onSaveWorker} className="panel p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-[#172c40] p-3 text-[#08b5ee]"><Users size={20} /></div>
          <div><h2 className="font-bold">{t('add_worker')}</h2><p className="text-sm text-slate-400">{t('pin_management')}</p></div>
        </div>
        <div className="space-y-4">
          <label className="block text-sm text-slate-300">{t('worker_name')}<input className="field mt-2" name="name" placeholder={t('worker_name')} required /></label>
          <label className="block text-sm text-slate-300">{t('role')}<select className="field mt-2" name="role"><option value="worker">{t('worker')}</option><option value="sub_admin">{t('sub_admin')}</option><option value="admin">{t('admin')}</option></select></label>
          <label className="block text-sm text-slate-300">{t('pin_code')}<input className="field mt-2" name="pin" type="password" inputMode="numeric" placeholder={t('pin_code')} required /></label>
        </div>
        <button className="btn btn-primary mt-5 w-full"><Plus size={16} />{t('add_worker')}</button>
      </form>

      {/* PIN list */}
      <div className="panel overflow-hidden">
        <div className="border-b border-[#22324d] px-5 py-3">
          <h2 className="font-bold">{t('pin_management')}</h2>
          <p className="text-sm text-slate-400">{isAdmin ? t('can_edit_workers') : t('cannot_edit_admin')}</p>
        </div>
        {visibleWorkers.length === 0 && <Empty text={t('no_pins')} />}
        {visibleWorkers.map(w => (
          <div key={w.id} className="flex items-center justify-between gap-3 border-b border-[#1b2a42] px-5 py-4 last:border-0">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2 ${roleColors[w.role] || roleColors.worker}`}>{roleIcons[w.role] || <UserRound size={16} />}</div>
              <div>
                <p className="font-semibold">{w.name} {w.id === currentWorkerId && <span className="ml-1 text-xs text-slate-500">(you)</span>}</p>
                <p className="text-xs capitalize text-slate-500">{t(w.role)} · {w.active ? t('active') : t('disabled')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="chip font-mono tracking-wider">••••</span>
              {(isAdmin || w.id === currentWorkerId) && (
                <button className="btn btn-ghost p-2" onClick={() => { setPinEditModal(w); setNewPin(''); }} title={t('change_pin')}><Pencil size={15} /></button>
              )}
              {canDelete(w) && (
                <button className="btn btn-danger p-2" onClick={() => { if (confirm(t('confirm_delete_worker'))) onDeleteWorker(w); }} title={t('delete_worker')}><Trash2 size={15} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>

    {pinEditModal && (
      <Modal title={`${t('change_pin')} · ${pinEditModal.name}`} onClose={() => { setPinEditModal(null); setNewPin(''); }}>
        <label className="block text-sm text-slate-300">{t('pin_code')}<input className="field mt-2" type="password" inputMode="numeric" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="••••" autoFocus /></label>
        <button className="btn btn-primary mt-4 w-full" disabled={!newPin} onClick={() => savePinChange(pinEditModal, newPin)}><Check size={16} />{t('save')}</button>
      </Modal>
    )}
  </>;
}

// === Settings View ===
function SettingsView({ settings, stationTypes, stations, onSave, onReset, onAddStationType, onDeleteStationType, onAddStation, onDeleteStation, onLog, t }: {
  settings: Settings; stationTypes: StationType[]; stations: Station[];
  onSave: (e: FormEvent<HTMLFormElement>) => void; onReset: () => Promise<boolean>;
  onAddStationType: (name: string, label: string, color: string) => void; onDeleteStationType: (st: StationType) => void;
  onAddStation: (name: string, type: string, sortOrder: number) => void; onDeleteStation: (s: Station) => void;
  onLog: (a: string, e?: string, o?: Record<string, unknown>, n?: Record<string, unknown>, d?: Record<string, string>) => void; t: TFunc;
}) {
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedColor, setSelectedColor] = useState(settings.theme_color || 'emerald');
  const [selectedIcon, setSelectedIcon] = useState(settings.icon || 'gamepad');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('ocean');
  const [newStationName, setNewStationName] = useState('');
  const [newStationType, setNewStationType] = useState(stationTypes[0]?.name || 'console');

  const [selectedTheme, setSelectedTheme] = useState<AppThemeId | string>(
    isAppThemeId(settings.theme) && settings.theme !== 'midnight' ? settings.theme : 'abyss',
  );
  const themeColorOptions: { value: string; color: string; label: string }[] = [
    { value: 'emerald', color: '#20d26c', label: t('emerald') },
    { value: 'ocean', color: '#08b5ee', label: t('ocean') },
    { value: 'sunset', color: '#ff8c42', label: t('sunset') },
    { value: 'crimson', color: '#ff4650', label: t('crimson') },
    { value: 'gold', color: '#ffb13b', label: t('gold') },
    { value: 'violet', color: '#a78bfa', label: t('violet') },
  ];

  const iconOptions = [
    { value: 'gamepad', label: 'Gamepad' },
    { value: 'coffee', label: 'Coffee' },
    { value: 'zap', label: 'Lightning' },
    { value: 'dices', label: 'Dice' },
    { value: 'target', label: 'Target' },
    { value: 'trophy', label: 'Trophy' },
    { value: 'crown', label: 'Crown' },
    { value: 'swords', label: 'Swords' },
  ];

  async function doReset() {
    setResetBusy(true);
    setResetMsg(null);
    const ok = await onReset();
    setResetBusy(false);
    setShowResetConfirm(false);
    if (ok) {
      setResetMsg({ type: 'success', text: t('reset_done') });
    } else {
      setResetMsg({ type: 'error', text: t('reset_failed') });
    }
  }

  return <>
    <SectionTitle title={t('settings')} subtitle="Personalize your café workspace." />
    <form onSubmit={onSave} className="panel mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-[#172c40] p-3 text-[#08b5ee]"><SettingsIcon /></div>
        <div><h2 className="font-bold">Workspace preferences</h2><p className="text-sm text-slate-400">These preferences belong to this café account.</p></div>
      </div>

      <div className="space-y-5">
        <label className="block text-sm text-slate-300">{t('cafe_name')}<input className="field mt-2" name="name" defaultValue={settings.name} required /></label>

        <div>
          <label className="block text-sm text-slate-300">{t('interface_language')}<select className="field mt-2" name="language" defaultValue={settings.language}><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select></label>
        </div>

        {/* Button color — works on EVERY theme */}
        <div>
          <p className="mb-2 text-sm text-slate-300">{t('theme_color')}</p>
          <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>{t('theme_hint')}</p>
          <div className="flex flex-wrap gap-3">
            {themeColorOptions.map(opt => (
              <button key={opt.value} type="button" onClick={() => setSelectedColor(opt.value)} className="flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition" style={{ borderColor: selectedColor === opt.value ? 'var(--accent)' : 'var(--line)' }}>
                <span className="h-5 w-5 rounded-full" style={{ background: opt.color }} />
                <span className="text-sm" style={{ color: 'var(--ink)' }}>{opt.label}</span>
              </button>
            ))}
          </div>
          <input type="hidden" name="theme_color" value={selectedColor} />
        </div>

        {/* Simple themes */}
        <div>
          <p className="mb-2 text-sm text-slate-300">{t('simple_themes')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {simpleThemeOrder.map(id => (
              <button key={id} type="button" onClick={() => setSelectedTheme(id)} className="theme-card rounded-xl border-2 p-2 text-left transition" style={{ borderColor: selectedTheme === id ? 'var(--accent)' : 'var(--line)' }}>
                <span className="theme-preview mb-1.5 block h-10 overflow-hidden rounded-lg" style={{ background: previewBg(id) }} />
                <span className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>{themeLabel(id, (settings.language as 'en' | 'fr' | 'ar') || 'en')}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Effect themes */}
        <div>
          <p className="mb-2 text-sm text-slate-300">{t('effect_themes')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {effectThemeOrder.map(id => (
              <button key={id} type="button" onClick={() => setSelectedTheme(id)} className="theme-card rounded-xl border-2 p-2 text-left transition" style={{ borderColor: selectedTheme === id ? 'var(--accent)' : 'var(--line)' }}>
                <span className="theme-preview mb-1.5 block h-10 overflow-hidden rounded-lg" style={{ background: previewBg(id) }} />
                <span className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>{themeLabel(id, (settings.language as 'en' | 'fr' | 'ar') || 'en')}</span>
              </button>
            ))}
          </div>
          <input type="hidden" name="theme" value={isAppThemeId(selectedTheme) && selectedTheme !== 'midnight' ? selectedTheme : 'abyss'} />
        </div>

        {/* Icon picker */}
        <div>
          <p className="mb-2 text-sm text-slate-300">{t('app_icon')}</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {iconOptions.map(opt => {
              const Icon = getIconComponent(opt.value);
              return (
                <button key={opt.value} type="button" onClick={() => setSelectedIcon(opt.value)} className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition ${selectedIcon === opt.value ? 'logo-shine border-white bg-[#172c40]' : 'border-[#263954] hover:border-slate-500'}`}>
                  <Icon size={20} />
                  <span className="text-[10px] text-slate-400">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="icon" value={selectedIcon} />
        </div>

        {/* Logo URL */}
        <label className="block text-sm text-slate-300">{t('upload_logo')}
          <input className="field mt-2" name="logo_url" type="url" defaultValue={settings.logo_url || ''} placeholder="https://..." />
          <p className="mt-1 text-xs text-slate-500">Paste an image URL to use as your logo.</p>
        </label>

        {/* Ghost recovery — one owner-only secret word, never displayed back */}
        <GhostSettings settings={settings} t={t} />
      </div>
      <button className="btn btn-primary mt-6"><Check size={16} />{t('save_settings')}</button>
    </form>

    {/* Control Panel Settings */}
    <div className="panel mx-auto mt-5 max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-[#172c40] p-3 text-[#08b5ee]"><Gamepad2 size={20} /></div>
        <div><h2 className="font-bold">{t('control_panel_settings')}</h2><p className="text-sm text-slate-400">{t('control_panel_settings_desc')}</p></div>
      </div>

      {/* Add new station type */}
      <div className="mb-6 rounded-lg border border-[#22324d] bg-[#0a1422] p-4">
        <p className="mb-3 text-sm font-semibold text-slate-300">{t('add_station_type')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className="field" placeholder={t('type_name')} value={newTypeName} onChange={e => setNewTypeName(e.target.value)} />
          <input className="field" placeholder={t('type_label')} value={newTypeLabel} onChange={e => setNewTypeLabel(e.target.value)} />
          <select className="field" value={newTypeColor} onChange={e => setNewTypeColor(e.target.value)}>
            <option value="emerald">{t('emerald')}</option><option value="ocean">{t('ocean')}</option><option value="sunset">{t('sunset')}</option><option value="crimson">{t('crimson')}</option><option value="gold">{t('gold')}</option><option value="violet">{t('violet')}</option>
          </select>
        </div>
        <button className="btn btn-primary mt-3" disabled={!newTypeName.trim()} onClick={() => { onAddStationType(newTypeName, newTypeLabel, newTypeColor); setNewTypeName(''); setNewTypeLabel(''); }}><Plus size={16} />{t('add_station_type')}</button>
      </div>

      {/* Station types list */}
      <div className="space-y-4">
        {stationTypes.map(stype => {
          const tcs = colorStyle(stype.color || 'ocean');
          const typeStations = stations.filter(s => s.type === stype.name);
          return <div key={stype.id} className="rounded-lg border border-[#1b2a42] bg-[#0d1524] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: tcs.text }} />
                <span className="font-semibold" style={{ color: tcs.text }}>{stype.label}</span>
                <span className="text-xs text-slate-500">{typeStations.length} {t('stations_list')}</span>
              </div>
              <button className="rounded-lg border border-[#ff4650] px-2 py-1 text-xs text-[#ff4650] transition hover:bg-[#ff4650]/10" onClick={() => { if (confirm(t('delete_station_type'))) onDeleteStationType(stype); }}><Trash2 size={12} /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {typeStations.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 rounded-lg border border-[#22324d] bg-[#0a1422] px-3 py-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: tcs.text }} />
                  <span className="text-slate-200">{s.name}</span>
                  <button className="text-[#ff4650] transition hover:text-red-400" onClick={() => onDeleteStation(s)}><X size={12} /></button>
                </div>
              ))}
              {typeStations.length === 0 && <span className="text-xs text-slate-500">No stations yet</span>}
            </div>
            {/* Add station to this type */}
            <div className="mt-3 flex gap-2">
              <input className="field flex-1" placeholder={`${t('add_station_to_type')}...`} value={newStationType === stype.name ? newStationName : ''} onChange={e => { setNewStationType(stype.name); setNewStationName(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter' && newStationName.trim() && newStationType === stype.name) { e.preventDefault(); onAddStation(newStationName, stype.name, typeStations.length + 1); setNewStationName(''); } }} />
              <button className="btn btn-ghost" disabled={newStationType !== stype.name || !newStationName.trim()} onClick={() => { onAddStation(newStationName, stype.name, typeStations.length + 1); setNewStationName(''); }}><Plus size={16} /></button>
            </div>
          </div>;
        })}
        {stationTypes.length === 0 && <p className="text-sm text-slate-500">No station types yet. Add one above to get started.</p>}
      </div>
    </div>

    {/* Data Reset */}
    <div className="panel border-red-900/40 mx-auto mt-5 max-w-3xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-red-950/50 p-3 text-[#ff4650]"><RotateCcw size={20} /></div>
        <div><h2 className="font-bold">{t('data_management')}</h2><p className="text-sm text-slate-400">{t('data_management_desc')}</p></div>
      </div>
      {resetMsg && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${resetMsg.type === 'success' ? 'border border-[#20d26c]/40 bg-[#102b21] text-[#20d26c]' : 'border border-red-800 bg-red-950/50 text-red-300'}`}>{resetMsg.text}</div>
      )}
      {!showResetConfirm ? (
        <button className="btn btn-danger w-full" onClick={() => { setResetMsg(null); setShowResetConfirm(true); }}><RotateCcw size={16} />{t('reset_financial_data')}</button>
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{t('reset_confirm')}</p>
          <div className="flex gap-2">
            <button className="btn btn-danger flex-1" disabled={resetBusy} onClick={doReset}>{resetBusy ? t('reset_in_progress') : t('reset_financial_data')}</button>
            <button className="btn btn-ghost flex-1" disabled={resetBusy} onClick={() => setShowResetConfirm(false)}>{t('cancel')}</button>
          </div>
        </div>
      )}
    </div>
  </>;
}

export default App;
