/**
 * src/lib/db.ts
 *
 * Offline-first localStorage data layer that mirrors the Supabase `app_*`
 * tables used by the cafe app. It is API-compatible with the way App.tsx
 * calls supabase:
 *
 *   db.from('app_workers').select('*').order('name')
 *   db.from('app_sessions').select('*').neq('status', 'finished')
 *   db.from('app_session_items').select('id')
 *     .eq('session_id', id).eq('item_type', 'game').is('game_ended_at', null)
 *   db.from('app_transactions').select('*')
 *     .order('created_at', { ascending: false }).limit(200)
 *   await db.from('app_settings').select('*').maybeSingle()
 *   await db.from('app_sessions').insert({...}).select().maybeSingle()
 *   await db.from('app_stations').update({ status: 'in_use' }).eq('id', id)
 *   await db.from('app_session_items').update({...}).in('id', ids)
 *   await db.from('app_products').delete().eq('id', id)
 *   await db.rpc('reset_financial_data')
 *
 * Every builder is thenable, so `await` and `.then()` both work exactly
 * like the Supabase client. Each table is persisted as JSON under the
 * `cafe_<table>` localStorage key. Realistic demo data is seeded once on
 * first run.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Row = Record<string, unknown>;

export type DbError = { message: string };

export type DbResult<T = Row | Row[] | null> = {
  data: T;
  error: DbError | null;
};

export const TABLES = [
  'app_settings',
  'app_workers',
  'app_stations',
  'app_station_types',
  'app_price_rules',
  'app_products',
  'app_sessions',
  'app_session_items',
  'app_transactions',
  'app_transaction_items',
  'app_clients',
  'app_client_payments',
  'app_reminders',
  'app_audit_logs',
  'app_daily_archives',
] as const;

export type TableName = (typeof TABLES)[number];

// ---------------------------------------------------------------------------
// Storage helpers (localStorage with in-memory fallback for non-browser envs)
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'cafe_';
const SEED_FLAG = 'cafe__seeded_v1';

const memoryFallback = new Map<string, string>();

function getStore(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* storage unavailable — use in-memory fallback */
  }
  return null;
}

function readRaw(key: string): string | null {
  const store = getStore();
  if (store) {
    try {
      return store.getItem(key);
    } catch {
      /* fall through to memory */
    }
  }
  return memoryFallback.has(key) ? (memoryFallback.get(key) as string) : null;
}

function writeRaw(key: string, value: string): void {
  const store = getStore();
  if (store) {
    try {
      store.setItem(key, value);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memoryFallback.set(key, value);
}

function loadTable(table: TableName): Row[] {
  const raw = readRaw(KEY_PREFIX + table);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[]).filter(
      (r): r is Row => typeof r === 'object' && r !== null,
    );
  } catch {
    return [];
  }
}

function saveTable(table: TableName, rows: Row[]): void {
  writeRaw(KEY_PREFIX + table, JSON.stringify(rows));
}

function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to Math.random fallback */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Query plumbing (filters / sorting / projection)
// ---------------------------------------------------------------------------

type FilterOp = 'eq' | 'neq' | 'is' | 'in';
type Filter = { op: FilterOp; col: string; val: unknown };
type SortRule = { col: string; ascending: boolean };
type Mode = 'select' | 'insert' | 'update' | 'delete';
type SingleMode = 'many' | 'maybeSingle' | 'single';

function matchFilter(row: Row, f: Filter): boolean {
  const v = row[f.col];
  switch (f.op) {
    case 'eq':
      return v === f.val;
    case 'neq':
      return v !== f.val;
    case 'is':
      if (f.val === null) return v === null || v === undefined;
      return v === f.val;
    case 'in':
      return (f.val as unknown[]).includes(v);
  }
}

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  if (filters.length === 0) return rows.slice();
  return rows.filter((row) => filters.every((f) => matchFilter(row, f)));
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a);
  const sb = String(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

function applySorts(rows: Row[], sorts: SortRule[]): Row[] {
  if (sorts.length === 0) return rows;
  const out = rows.slice();
  out.sort((r1, r2) => {
    for (const s of sorts) {
      const c = compareValues(r1[s.col], r2[s.col]);
      if (c !== 0) return s.ascending ? c : -c;
    }
    return 0;
  });
  return out;
}

function project(row: Row, columns: string): Row {
  const cols = columns
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  if (cols.length === 0 || cols.includes('*')) return { ...row };
  const out: Row = {};
  for (const c of cols) out[c] = row[c];
  return out;
}

/** Strip server-managed fields clients must never overwrite (id / timestamps). */
function sanitizePatch(table: TableName, patch: Row): Row {
  const out: Row = { ...patch };
  delete out.id;
  delete out.created_at;
  void table;
  return out;
}

/** Fill in the server-side defaults Supabase would normally apply. */
function withDefaults(table: TableName, input: Row): Row {
  const row: Row = { ...input };
  if (row.id === null || row.id === undefined) row.id = uid();
  if (row.created_at === null || row.created_at === undefined) row.created_at = nowIso();

  const def = (key: string, value: unknown) => {
    if (row[key] === null || row[key] === undefined) row[key] = value;
  };

  switch (table) {
    case 'app_sessions':
      def('status', 'running');
      def('started_at', row.created_at);
      def('paused_at', null);
      def('ended_at', null);
      def('paused_seconds', 0);
      def('total', 0);
      break;
    case 'app_session_items':
      def('item_type', 'game');
      def('quantity', 1);
      def('unit_price', 0);
      def('is_prolongation', false);
      def('price_rule_id', null);
      def('match_count', 0);
      def('prolongation_count', 0);
      def('match_price', 0);
      def('prolongation_price', 0);
      def('party_count', 0);
      def('duration_minutes', 0);
      def('notification_minutes', 5);
      def('game_started_at', row.created_at);
      def('game_ended_at', null);
      def('notification_sent_at', null);
      break;
    case 'app_stations':
      def('type', 'console');
      def('status', 'available');
      def('sort_order', 0);
      break;
    case 'app_station_types':
      def('color', 'ocean');
      def('sort_order', 0);
      break;
    case 'app_price_rules':
      def('duration_minutes', 0);
      def('price', 0);
      def('game_mode', 'standard');
      def('match_price', 0);
      def('prolongation_price', 0);
      def('notification_minutes', 5);
      def('color', 'ocean');
      break;
    case 'app_products':
      def('category', 'beverage');
      def('units_per_box', 1);
      def('total_units', 0);
      def('purchase_price', 0);
      def('selling_price', 0);
      def('color', 'ocean');
      break;
    case 'app_transactions':
      def('source', 'calculator');
      def('total', 0);
      def('paid', 0);
      break;
    case 'app_transaction_items':
      def('quantity', 1);
      def('unit_price', 0);
      break;
    case 'app_clients':
      def('phone', null);
      def('balance', 0);
      break;
    case 'app_client_payments':
      def('amount', 0);
      break;
    case 'app_reminders':
      def('completed', false);
      def('link_kind', 'none');
      def('link_id', null);
      def('link_label', null);
      break;
    case 'app_audit_logs':
      def('details', {});
      break;
    case 'app_daily_archives':
      def('total_revenue', 0);
      def('gaming_revenue', 0);
      def('beverage_revenue', 0);
      def('payments_total', 0);
      def('sessions_count', 0);
      def('transactions_count', 0);
      def('outstanding_amount', 0);
      def('transactions_json', []);
      break;
    case 'app_workers':
      def('role', 'worker');
      def('pin', '');
      def('active', true);
      def('last_login_at', null);
      def('ip_address', null);
      def('is_online', false);
      def('device_type', null);
      def('browser', null);
      def('last_heartbeat_at', null);
      def('session_started_at', null);
      break;
    case 'app_settings':
      def('ghost_word_hash', null);
      def('theme', 'abyss');
      def('theme_color', 'emerald');
      def('icon', 'gamepad');
      def('logo_url', null);
      def('language', 'en');
      break;
  }
  return row;
}

// ---------------------------------------------------------------------------
// Chainable query builder (thenable, like the Supabase client)
// ---------------------------------------------------------------------------

class TableQuery implements PromiseLike<DbResult> {
  private mode: Mode = 'select';
  private columns = '*';
  private filters: Filter[] = [];
  private sorts: SortRule[] = [];
  private limitCount: number | null = null;
  private singleMode: SingleMode = 'many';
  private pendingInsert: Row[] = [];
  private pendingPatch: Row | null = null;

  constructor(private readonly table: TableName) {}

  select(columns = '*'): this {
    this.columns = columns || '*';
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ op: 'eq', col, val });
    return this;
  }

  neq(col: string, val: unknown): this {
    this.filters.push({ op: 'neq', col, val });
    return this;
  }

  is(col: string, val: unknown): this {
    this.filters.push({ op: 'is', col, val });
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.filters.push({ op: 'in', col, val: vals });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.sorts.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  insert(values: Row | Row[]): this {
    this.mode = 'insert';
    const arr = Array.isArray(values) ? values : [values];
    this.pendingInsert = arr.map((r) => ({ ...(r as Row) }));
    return this;
  }

  update(patch: Row): this {
    this.mode = 'update';
    this.pendingPatch = { ...patch };
    return this;
  }

  delete(): this {
    this.mode = 'delete';
    return this;
  }

  maybeSingle(): Promise<DbResult<Row | null>> {
    this.singleMode = 'maybeSingle';
    return this.execute() as Promise<DbResult<Row | null>>;
  }

  single(): Promise<DbResult<Row | null>> {
    this.singleMode = 'single';
    return this.execute() as Promise<DbResult<Row | null>>;
  }

  // PromiseLike — makes `await db.from(...).select(...)` and `.then()` work.
  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<DbResult | TResult> {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<DbResult> {
    return this.execute().finally(onfinally);
  }

  private validateFilters(): string | null {
    for (const f of this.filters) {
      if (f.val === undefined) return `Invalid filter ${f.op}(${f.col}): value is undefined`;
      if (f.op === 'in' && !Array.isArray(f.val)) {
        return `Invalid filter in(${f.col}): expected an array`;
      }
    }
    return null;
  }

  private async execute(): Promise<DbResult> {
    try {
      switch (this.mode) {
        case 'insert':
          return this.runInsert();
        case 'update':
          return this.runUpdate();
        case 'delete':
          return this.runDelete();
        default:
          return this.runSelect();
      }
    } catch (err) {
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : 'Local database error' },
      };
    }
  }

  private async runSelect(): Promise<DbResult> {
    const bad = this.validateFilters();
    if (bad) return { data: null, error: { message: bad } };
    let rows = applyFilters(loadTable(this.table), this.filters);
    rows = applySorts(rows, this.sorts);
    if (this.limitCount !== null && this.limitCount !== undefined) {
      rows = rows.slice(0, Math.max(0, this.limitCount));
    }
    if (this.singleMode === 'maybeSingle' || this.singleMode === 'single') {
      const first = rows[0];
      if (first === undefined) {
        if (this.singleMode === 'single') {
          return { data: null, error: { message: 'No rows returned' } };
        }
        return { data: null, error: null };
      }
      return { data: project(first, this.columns), error: null };
    }
    return { data: rows.map((r) => project(r, this.columns)), error: null };
  }

  private async runInsert(): Promise<DbResult> {
    const table = loadTable(this.table);
    const created = this.pendingInsert.map((r) => withDefaults(this.table, r));
    table.push(...created);
    saveTable(this.table, table);
    const out = created.map((r) => project(r, this.columns));
    if (this.singleMode !== 'many') {
      const first = out[0];
      if (first === undefined) return { data: null, error: { message: 'Insert returned no rows' } };
      return { data: first, error: null };
    }
    return { data: out, error: null };
  }

  private async runUpdate(): Promise<DbResult> {
    const bad = this.validateFilters();
    if (bad) return { data: null, error: { message: bad } };
    if (!this.pendingPatch) return { data: null, error: { message: 'Update called without values' } };
    const patch = sanitizePatch(this.table, this.pendingPatch);
    const updated: Row[] = [];
    const next = loadTable(this.table).map((row) => {
      if (!this.filters.every((f) => matchFilter(row, f))) return row;
      const merged = { ...row, ...patch };
      updated.push(merged);
      return merged;
    });
    saveTable(this.table, next);
    const out = updated.map((r) => project(r, this.columns));
    if (this.singleMode !== 'many') {
      const first = out[0];
      return { data: first === undefined ? null : first, error: null };
    }
    return { data: out, error: null };
  }

  private async runDelete(): Promise<DbResult> {
    const bad = this.validateFilters();
    if (bad) return { data: null, error: { message: bad } };
    const table = loadTable(this.table);
    const isMatch = (row: Row) => this.filters.every((f) => matchFilter(row, f));
    const removed = table.filter(isMatch);
    saveTable(this.table, table.filter((row) => !isMatch(row)));
    const out = removed.map((r) => project(r, this.columns));
    if (this.singleMode !== 'many') {
      const first = out[0];
      return { data: first === undefined ? null : first, error: null };
    }
    return { data: out, error: null };
  }
}

// ---------------------------------------------------------------------------
// Seed data (first run only)
// ---------------------------------------------------------------------------

function seedRow(partial: Row): Row {
  return { id: uid(), created_at: nowIso(), ...partial };
}

function buildSeed(): Record<TableName, Row[]> {
  const now = nowIso();

  const settings: Row[] = [
    seedRow({
      name: 'Max Gaming',
      admin_pin: '',
      worker_pin: '',
      ghost_word_hash: null,
      theme: 'abyss',
      theme_color: 'emerald',
      icon: 'gamepad',
      logo_url: null,
      language: 'en',
    }),
  ];

  const workers: Row[] = [
    seedRow({
      name: 'Admin',
      role: 'admin',
      pin: '',
      active: true,
      last_login_at: null,
      ip_address: null,
      is_online: false,
      device_type: null,
      browser: null,
      last_heartbeat_at: null,
      session_started_at: null,
    }),
    seedRow({
      name: 'Yacine',
      role: 'worker',
      pin: '',
      active: true,
      last_login_at: null,
      ip_address: null,
      is_online: false,
      device_type: null,
      browser: null,
      last_heartbeat_at: null,
      session_started_at: null,
    }),
    seedRow({
      name: 'Karim',
      role: 'sub_admin',
      pin: '',
      active: true,
      last_login_at: null,
      ip_address: null,
      is_online: false,
      device_type: null,
      browser: null,
      last_heartbeat_at: null,
      session_started_at: null,
    }),
  ];

  const stationTypes: Row[] = [
    seedRow({ name: 'console', label: 'PlayStations', color: 'emerald', sort_order: 1 }),
    seedRow({ name: 'pool', label: 'Pool Tables', color: 'ocean', sort_order: 2 }),
    seedRow({ name: 'xbox', label: 'Xbox Zone', color: 'sunset', sort_order: 3 }),
    seedRow({ name: 'pc', label: 'PC Gaming', color: 'crimson', sort_order: 4 }),
    seedRow({ name: 'arcade', label: 'Arcade', color: 'gold', sort_order: 5 }),
    seedRow({ name: 'vip', label: 'VIP Lounge', color: 'emerald', sort_order: 6 }),
  ];

  const stationDefs: Array<[string, string]> = [
    ['PS1', 'console'],
    ['PS2', 'console'],
    ['PS3', 'console'],
    ['PS4', 'console'],
    ['PS5', 'console'],
    ['Pool 1', 'pool'],
    ['Xbox', 'xbox'],
    ['PC', 'pc'],
  ];
  const stations: Row[] = stationDefs.map(([name, type], i) =>
    seedRow({ name, type, status: 'available', sort_order: i + 1 }),
  );

  const priceRules: Row[] = [
    seedRow({
      station_type: 'console',
      label: 'FIFA 24 — Match',
      duration_minutes: 10,
      price: 10,
      notes: 'Football match pricing, 10 DZD per match',
      game_mode: 'football',
      match_price: 10,
      prolongation_price: 5,
      notification_minutes: 2,
      color: 'emerald',
    }),
    seedRow({
      station_type: 'console',
      label: 'eFootball — Match',
      duration_minutes: 10,
      price: 10,
      notes: 'Football match pricing',
      game_mode: 'football',
      match_price: 10,
      prolongation_price: 5,
      notification_minutes: 2,
      color: 'ocean',
    }),
    seedRow({
      station_type: 'console',
      label: 'GTA V — 30 min',
      duration_minutes: 30,
      price: 30,
      notes: 'Open-world timed session',
      game_mode: 'standard',
      match_price: 0,
      prolongation_price: 0,
      notification_minutes: 5,
      color: 'crimson',
    }),
    seedRow({
      station_type: 'console',
      label: 'Standard — 30 min',
      duration_minutes: 30,
      price: 25,
      notes: '',
      game_mode: 'standard',
      match_price: 0,
      prolongation_price: 0,
      notification_minutes: 5,
      color: 'emerald',
    }),
    seedRow({
      station_type: 'console',
      label: 'Standard — 1 hour',
      duration_minutes: 60,
      price: 45,
      notes: '',
      game_mode: 'standard',
      match_price: 0,
      prolongation_price: 0,
      notification_minutes: 5,
      color: 'emerald',
    }),
    seedRow({
      station_type: 'pool',
      label: 'Pool — 30 min',
      duration_minutes: 30,
      price: 20,
      notes: '',
      game_mode: 'standard',
      match_price: 0,
      prolongation_price: 0,
      notification_minutes: 5,
      color: 'ocean',
    }),
    seedRow({
      station_type: 'xbox',
      label: 'Xbox — 30 min',
      duration_minutes: 30,
      price: 25,
      notes: '',
      game_mode: 'standard',
      match_price: 0,
      prolongation_price: 0,
      notification_minutes: 5,
      color: 'sunset',
    }),
    seedRow({
      station_type: 'pc',
      label: 'PC — 1 hour',
      duration_minutes: 60,
      price: 40,
      notes: '',
      game_mode: 'standard',
      match_price: 0,
      prolongation_price: 0,
      notification_minutes: 5,
      color: 'crimson',
    }),
  ];

  const products: Row[] = [
    seedRow({ name: 'Coca-Cola 33cl', category: 'beverage', units_per_box: 24, total_units: 36, purchase_price: 55, selling_price: 100, color: 'crimson' }),
    seedRow({ name: 'Pepsi 33cl', category: 'beverage', units_per_box: 24, total_units: 24, purchase_price: 55, selling_price: 100, color: 'ocean' }),
    seedRow({ name: 'Fanta 33cl', category: 'beverage', units_per_box: 24, total_units: 4, purchase_price: 55, selling_price: 100, color: 'sunset' }),
    seedRow({ name: 'Mineral Water 50cl', category: 'beverage', units_per_box: 24, total_units: 48, purchase_price: 30, selling_price: 50, color: 'ocean' }),
    seedRow({ name: 'Espresso', category: 'beverage', units_per_box: 1, total_units: 60, purchase_price: 25, selling_price: 60, color: 'gold' }),
    seedRow({ name: 'Chips Paprika', category: 'snack', units_per_box: 12, total_units: 18, purchase_price: 40, selling_price: 0, color: 'sunset' }),
    seedRow({ name: 'Chocolate Bar', category: 'snack', units_per_box: 24, total_units: 0, purchase_price: 60, selling_price: 0, color: 'crimson' }),
    seedRow({ name: 'Croissant', category: 'snack', units_per_box: 12, total_units: 9, purchase_price: 35, selling_price: 70, color: 'gold' }),
  ];

  const clients: Row[] = [
    seedRow({ name: 'Amine Benali', phone: '0550 12 34 56', balance: 1500 }),
    seedRow({ name: 'Riyad Kaci', phone: '0661 98 76 54', balance: 0 }),
    seedRow({ name: 'Sofia Merbah', phone: null, balance: 0 }),
  ];

  // No phantom demo reminders: the seed stays empty so the bell never
  // shows a reminder about something the user never created.
  const reminders: Row[] = [];

  void now;

  return {
    app_settings: settings,
    app_workers: workers,
    app_stations: stations,
    app_station_types: stationTypes,
    app_price_rules: priceRules,
    app_products: products,
    app_sessions: [],
    app_session_items: [],
    app_transactions: [],
    app_transaction_items: [],
    app_clients: clients,
    app_client_payments: [],
    app_reminders: reminders,
    app_audit_logs: [],
    app_daily_archives: [],
  };
}

const LINK_FLAG = 'cafe__reminder_links_v1';

function ensureSeeded(): void {
  if (readRaw(SEED_FLAG)) {
    // One-time migration: drop the old phantom demo reminder and backfill
    // the new link columns on reminders created before linking existed.
    if (!readRaw(LINK_FLAG)) {
      try {
        const rows = loadTable('app_reminders');
        const cleaned = rows.filter((r) => {
          const m = String(r.message ?? '');
          // Remove the seeded phantom that haunted the bell.
          return m !== 'Restock Coca-Cola before the weekend rush';
        }).map((r) => ({
          ...r,
          link_kind: typeof r.link_kind === 'string' ? r.link_kind : 'none',
          link_id: (r.link_id as string | null) ?? null,
          link_label: (r.link_label as string | null) ?? null,
        }));
        saveTable('app_reminders', cleaned);
      } catch { /* keep existing data untouched on error */ }
      writeRaw(LINK_FLAG, '1');
    }
    return;
  }
  // Respect pre-existing data (e.g. a previous version of the app wrote here).
  const hasData = TABLES.some((t) => loadTable(t).length > 0);
  if (!hasData) {
    const seed = buildSeed();
    for (const t of TABLES) saveTable(t, seed[t]);
  }
  writeRaw(SEED_FLAG, '1');
  writeRaw(LINK_FLAG, '1');
}

// ---------------------------------------------------------------------------
// RPC handlers
// ---------------------------------------------------------------------------

async function resetFinancialData(): Promise<DbResult> {
  const counts = {
    sessions: loadTable('app_sessions').length,
    transactions: loadTable('app_transactions').length,
    transaction_items: loadTable('app_transaction_items').length,
    session_items: loadTable('app_session_items').length,
    audit_logs: loadTable('app_audit_logs').length,
    client_payments: loadTable('app_client_payments').length,
  };

  saveTable('app_transaction_items', []);
  saveTable('app_transactions', []);
  saveTable('app_session_items', []);
  saveTable('app_sessions', []);
  saveTable('app_audit_logs', []);
  saveTable('app_client_payments', []);

  saveTable(
    'app_clients',
    loadTable('app_clients').map((c) => ({ ...c, balance: 0 })),
  );

  saveTable(
    'app_stations',
    loadTable('app_stations').map((s) =>
      s.status === 'in_use' || s.status === 'paused' ? { ...s, status: 'available' } : s,
    ),
  );

  return {
    data: {
      deleted: {
        sessions: counts.sessions,
        transactions: counts.transactions,
        transaction_items: counts.transaction_items,
        audit_logs: counts.audit_logs,
        client_payments: counts.client_payments,
      },
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function deleteAllLogs(): Promise<DbResult> {
  const counts = {
    audit_logs: loadTable('app_audit_logs').length,
    daily_archives: loadTable('app_daily_archives').length,
  };
  saveTable('app_audit_logs', []);
  saveTable('app_daily_archives', []);
  return { data: { deleted: counts }, error: null };
}

async function fullCatalogWipe(): Promise<DbResult> {
  const counts = {
    products: loadTable('app_products').length,
    price_rules: loadTable('app_price_rules').length,
    sessions: loadTable('app_sessions').length,
    transactions: loadTable('app_transactions').length,
    transaction_items: loadTable('app_transaction_items').length,
    session_items: loadTable('app_session_items').length,
  };
  saveTable('app_session_items', []);
  saveTable('app_transaction_items', []);
  saveTable('app_transactions', []);
  saveTable('app_sessions', []);
  saveTable('app_price_rules', []);
  saveTable('app_products', []);
  saveTable(
    'app_stations',
    loadTable('app_stations').map((s) =>
      s.status === 'in_use' || s.status === 'paused' ? { ...s, status: 'available' } : s,
    ),
  );
  saveTable(
    'app_clients',
    loadTable('app_clients').map((c) => ({ ...c, balance: 0 })),
  );
  return { data: { deleted: counts }, error: null };
}

async function deleteAllPrices(): Promise<DbResult> {
  const count = loadTable('app_price_rules').length;
  saveTable('app_price_rules', []);
  return { data: { deleted: { price_rules: count } }, error: null };
}

async function deleteAllProducts(): Promise<DbResult> {
  const count = loadTable('app_products').length;
  saveTable('app_products', []);
  return { data: { deleted: { products: count } }, error: null };
}

export const db = {
  from(table: TableName): TableQuery {
    ensureSeeded();
    return new TableQuery(table);
  },

  async rpc(fn: string): Promise<DbResult> {
    ensureSeeded();
    if (fn === 'reset_financial_data') return resetFinancialData();
    if (fn === 'delete_all_logs') return deleteAllLogs();
    if (fn === 'full_catalog_wipe') return fullCatalogWipe();
    if (fn === 'delete_all_prices') return deleteAllPrices();
    if (fn === 'delete_all_products') return deleteAllProducts();
    return { data: null, error: { message: `Unknown RPC function: ${fn}` } };
  },
};
