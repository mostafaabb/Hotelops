// Typed fetch wrapper + API surface for the HotelOps backend.
// All requests go through /api/v1 (from NEXT_PUBLIC_API_URL).
// Access token is taken from localStorage (auth store), refreshed on 401.

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export class ApiError extends Error {
  status: number;
  errors?: unknown;

  constructor(message: string, status: number, errors?: unknown) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.name = 'ApiError';
  }
}

// Public deployment URLs are not secrets - the browser must know where the API
// lives. They are used as fallbacks so the build works without dashboard env
// vars; setting NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL still overrides them.
const PRODUCTION_API_URL = 'https://hotelops-1-x605.onrender.com/api/v1';
const PRODUCTION_WS_URL = 'https://hotelops-1-x605.onrender.com';
const LOCAL_API_URL = 'http://localhost:4000/api/v1';
const LOCAL_WS_URL = 'http://localhost:4000';

const isProduction = process.env.NODE_ENV === 'production';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || (isProduction ? PRODUCTION_API_URL : LOCAL_API_URL);

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || (isProduction ? PRODUCTION_WS_URL : LOCAL_WS_URL);

const TOKEN_KEY = 'hotelops.access_token';
const REFRESH_KEY = 'hotelops.refresh_token';

export function getTokens(): { access: string | null; refresh: string | null } {
  if (typeof window === 'undefined') return { access: null, refresh: null };
  return { access: localStorage.getItem(TOKEN_KEY), refresh: localStorage.getItem(REFRESH_KEY) };
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function buildUrl(path: string, query?: QueryParams): string {
  const q = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `${API_URL}${path}${q ? `?${q}` : ''}`;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const { refresh } = getTokens();
  if (!refresh) return false;
  if (!refreshing) {
    refreshing = fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request<T>(method: string, path: string, options: { body?: unknown; query?: QueryParams } = {}): Promise<T> {
  const { access } = getTokens();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(method, path, options);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotelops:unauthorized'));
    }
    throw new ApiError('Unauthorized', 401);
  }

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      data?.message || data?.error || (typeof data === 'string' ? data : `Request failed (${res.status})`);
    throw new ApiError(message, res.status, data?.errors);
  }

  return data as T;
}

export const get = <T>(path: string, query?: QueryParams) => request<T>('GET', path, { query });
export const post = <T>(path: string, body?: unknown, query?: QueryParams) => request<T>('POST', path, { body, query });
export const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body });
export const del = <T>(path: string) => request<T>('DELETE', path);

// ============ AUTH ============
export const authApi = {
  login: (email: string, password: string) =>
    post<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', { email, password }),
  logout: (refreshToken?: string) => post('/auth/logout', { refreshToken }),
  me: () => get<any>('/auth/me'),
  forgotPassword: (email: string) => post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => post('/auth/reset-password', { token, password }),
  changePassword: (body: { currentPassword: string; newPassword: string }) => patch('/auth/change-password', body),
};

// ============ ORGANIZATION & HOTELS ============
export const organizationApi = {
  me: () => get<any>('/organizations/me'),
  update: (body: any) => patch('/organizations/me', body),
};

export const hotelsApi = {
  list: (includeStats = true) => get<any[]>('/hotels', { includeStats: String(includeStats) }),
  get: (id: string) => get<any>(`/hotels/${id}`),
  create: (body: any) => post('/hotels', body),
  update: (id: string, body: any) => patch(`/hotels/${id}`, body),
};

// ============ USERS / STAFF / DEPARTMENTS ============
export const usersApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/users', query),
  get: (id: string) => get<any>(`/users/${id}`),
  create: (body: any) => post('/users', body),
  update: (id: string, body: any) => patch(`/users/${id}`, body),
};

export const staffApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/staff', query),
  get: (id: string) => get<any>(`/staff/${id}`),
  create: (body: any) => post('/staff', body),
  update: (id: string, body: any) => patch(`/staff/${id}`, body),
  setStatus: (id: string, status: string) => patch(`/staff/${id}/status`, { status }),
};

export const departmentsApi = {
  list: () => get<any[]>('/departments'),
  get: (id: string) => get<any>(`/departments/${id}`),
  create: (body: any) => post('/departments', body),
  update: (id: string, body: any) => patch(`/departments/${id}`, body),
};

// ============ ROOMS & PROPERTY ============
export const roomTypesApi = {
  list: (query?: QueryParams) => get<any[]>(`/room-types`, query),
  get: (id: string) => get<any>(`/room-types/${id}`),
  create: (body: any) => post('/room-types', body),
  update: (id: string, body: any) => patch(`/room-types/${id}`, body),
  remove: (id: string) => del(`/room-types/${id}`),
};

export const amenitiesApi = {
  list: () => get<any[]>('/amenities'),
  create: (body: any) => post('/amenities', body),
  update: (id: string, body: any) => patch(`/amenities/${id}`, body),
  remove: (id: string) => del(`/amenities/${id}`),
};

export const buildingsApi = {
  list: (query?: QueryParams) => get<any[]>(`/buildings`, query),
  get: (id: string) => get<any>(`/buildings/${id}`),
  create: (body: any) => post('/buildings', body),
  update: (id: string, body: any) => patch(`/buildings/${id}`, body),
  remove: (id: string) => del(`/buildings/${id}`),
  listFloors: (id: string) => get<any[]>(`/buildings/${id}/floors`),
  addFloor: (id: string, body: any) => post(`/buildings/${id}/floors`, { ...body, buildingId: id }),
  updateFloor: (floorId: string, body: any) => patch(`/buildings/floors/${floorId}`, body),
  removeFloor: (floorId: string) => del(`/buildings/floors/${floorId}`),
};

export const roomsApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/rooms', query),
  stats: () => get<any>('/rooms/stats'),
  get: (id: string) => get<any>(`/rooms/${id}`),
  update: (id: string, body: any) => patch(`/rooms/${id}`, body),
  setStatus: (id: string, body: any) => patch(`/rooms/${id}/status`, body),
  block: (id: string, body: any) => post(`/rooms/${id}/block`, body),
  unblock: (id: string, blockId: string) => del(`/rooms/${id}/block/${blockId}`),
};

// ============ GUESTS ============
export const guestsApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/guests', query),
  get: (id: string) => get<any>(`/guests/${id}`),
  history: (id: string) => get<any>(`/guests/${id}/history`),
  create: (body: any) => post('/guests', body),
  update: (id: string, body: any) => patch(`/guests/${id}`, body),
  remove: (id: string) => del(`/guests/${id}`),
  setVip: (id: string, body: any) => post(`/guests/${id}/vip`, body),
};

// ============ RATE PLANS ============
export const ratePlansApi = {
  list: (query?: QueryParams) => get<any[]>('/rate-plans', query),
  get: (id: string) => get<any>(`/rate-plans/${id}`),
  create: (body: any) => post('/rate-plans', body),
  update: (id: string, body: any) => patch(`/rate-plans/${id}`, body),
  remove: (id: string) => del(`/rate-plans/${id}`),
  // taxes / promos / seasonal
  taxes: { list: (query?: QueryParams) => get<any[]>('/rate-plans/taxes/list', query), create: (b: any) => post('/rate-plans/taxes', b), update: (id: string, b: any) => patch(`/rate-plans/taxes/${id}`, b), remove: (id: string) => del(`/rate-plans/taxes/${id}`) },
  promoCodes: { list: (query?: QueryParams) => get<any[]>('/rate-plans/promo-codes/list', query), create: (b: any) => post('/rate-plans/promo-codes', b), update: (id: string, b: any) => patch(`/rate-plans/promo-codes/${id}`, b), remove: (id: string) => del(`/rate-plans/promo-codes/${id}`) },
  seasonal: { list: (query?: QueryParams) => get<any[]>('/rate-plans/seasonal/list', query), create: (b: any) => post('/rate-plans/seasonal', b), update: (id: string, b: any) => patch(`/rate-plans/seasonal/${id}`, b), remove: (id: string) => del(`/rate-plans/seasonal/${id}`) },
};

// ============ RESERVATIONS ============
export const reservationsApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/reservations', query),
  calendar: (query?: QueryParams) => get<any>('/reservations/calendar', query),
  get: (idOrNumber: string) => get<any>(`/reservations/${idOrNumber}`),
  create: (body: any) => post('/reservations', body),
  update: (id: string, body: any) => patch(`/reservations/${id}`, body),
  walkIn: (body: any) => post('/reservations/walk-in', body),
  assignRoom: (id: string, body: any) => post(`/reservations/${id}/assign-room`, body),
  changeRoom: (id: string, body: any) => post(`/reservations/${id}/change-room`, body),
  cancel: (id: string, body: any) => post(`/reservations/${id}/cancel`, body),
  addNote: (id: string, note: string) => post(`/reservations/${id}/notes`, { note }),
};

// ============ AVAILABILITY ============
export const availabilityApi = {
  findRooms: (query?: QueryParams) => get<any>('/availability/rooms', query),
  calendar: (query?: QueryParams) => get<any>('/availability/calendar', query),
};

// ============ FRONT DESK ============
export const frontDeskApi = {
  board: (query?: QueryParams) => get<any>('/front-desk/board', query),
  checkIn: (reservationId: string) => post('/front-desk/check-in', { reservationId }),
  checkOut: (reservationId: string) => post('/front-desk/check-out', { reservationId }),
  noShow: (reservationId: string, reason?: string) => post('/front-desk/no-show', { reservationId, reason }),
};

// ============ HOUSEKEEPING ============
export const housekeepingApi = {
  board: (query?: QueryParams) => get<any>('/housekeeping/board', query),
  dashboard: (query?: QueryParams) => get<any>('/housekeeping/dashboard', query),
  tasks: (query?: QueryParams) => get<Paginated<any>>('/housekeeping/tasks', query),
  get: (id: string) => get<any>(`/housekeeping/tasks/${id}`),
  create: (body: any) => post('/housekeeping/tasks', body),
  update: (id: string, body: any) => patch(`/housekeeping/tasks/${id}`, body),
  assign: (id: string, body: any) => post(`/housekeeping/tasks/${id}/assign`, body),
  start: (id: string) => post(`/housekeeping/tasks/${id}/start`, {}),
  complete: (id: string) => post(`/housekeeping/tasks/${id}/complete`, {}),
  inspect: (id: string) => post(`/housekeeping/tasks/${id}/inspect`, {}),
  remove: (id: string) => del(`/housekeeping/tasks/${id}`),
  setRoomStatus: (roomId: string, body: any) => post(`/housekeeping/rooms/${roomId}/status`, body),
};

// ============ MAINTENANCE ============
export const maintenanceApi = {
  dashboard: (query?: QueryParams) => get<any>('/maintenance/dashboard', query),
  list: (query?: QueryParams) => get<Paginated<any>>('/maintenance/requests', query),
  get: (id: string) => get<any>(`/maintenance/requests/${id}`),
  create: (body: any) => post('/maintenance/requests', body),
  update: (id: string, body: any) => patch(`/maintenance/requests/${id}`, body),
  assign: (id: string, body: any) => post(`/maintenance/requests/${id}/assign`, body),
  start: (id: string) => post(`/maintenance/requests/${id}/start`, {}),
  resolve: (id: string, body?: any) => post(`/maintenance/requests/${id}/resolve`, body || {}),
  close: (id: string) => post(`/maintenance/requests/${id}/close`, {}),
};

// ============ SERVICES ============
export const servicesApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/services/services', query),
  catalog: () => get<any[]>('/services/services/catalog'),
  create: (body: any) => post('/services/services', body),
  update: (id: string, body: any) => patch(`/services/services/${id}`, body),
  remove: (id: string) => del(`/services/services/${id}`),
  orders: (query?: QueryParams) => get<Paginated<any>>('/services/service-orders', query),
  order: (id: string) => get<any>(`/services/service-orders/${id}`),
  createOrder: (body: any) => post('/services/service-orders', body),
  cancelOrder: (id: string) => post(`/services/service-orders/${id}/cancel`, {}),
};

// ============ PAYMENTS / FOLIOS / INVOICES ============
export const paymentsApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/payments', query),
  summary: (query?: QueryParams) => get<any>('/payments/summary', query),
  get: (id: string) => get<any>(`/payments/${id}`),
  create: (body: any) => post('/payments', body),
  refund: (id: string, amount: number, reason?: string) => post(`/payments/${id}/refund`, { amount, reason }),
};

export const foliosApi = {
  list: (query?: QueryParams) => get<any>('/folios', query),
  get: (id: string) => get<any>(`/folios/${id}`),
  byReservation: (reservationId: string) => get<any>(`/folios/reservation/${reservationId}`),
  addEntry: (folioId: string, body: any) => post(`/folios/${folioId}/entries`, body),
};

export const invoicesApi = {
  list: (query?: QueryParams) => get<any>('/invoices', query),
  get: (id: string) => get<any>(`/invoices/${id}`),
  void: (id: string, reason: string) => patch(`/invoices/${id}/void`, { reason }),
  generateFromFolio: (folioId: string) => post(`/invoices/from-folio/${folioId}`, {}),
};

// ============ EXPENSES / VENDORS / INVENTORY ============
export const expensesApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/expenses', query),
  summary: (query?: QueryParams) => get<any>('/expenses/summary', query),
  get: (id: string) => get<any>(`/expenses/${id}`),
  create: (body: any) => post('/expenses', body),
  update: (id: string, body: any) => patch(`/expenses/${id}`, body),
  remove: (id: string) => del(`/expenses/${id}`),
};

export const vendorsApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/vendors', query),
  get: (id: string) => get<any>(`/vendors/${id}`),
  create: (body: any) => post('/vendors', body),
  update: (id: string, body: any) => patch(`/vendors/${id}`, body),
  remove: (id: string) => del(`/vendors/${id}`),
};

export const inventoryApi = {
  products: (query?: QueryParams) => get<Paginated<any>>('/inventory/products', query),
  product: (id: string) => get<any>(`/inventory/products/${id}`),
  createProduct: (body: any) => post('/inventory/products', body),
  updateProduct: (id: string, body: any) => patch(`/inventory/products/${id}`, body),
  removeProduct: (id: string) => del(`/inventory/products/${id}`),
  movements: (query?: QueryParams) => get<Paginated<any>>('/inventory/movements', query),
  createMovement: (body: any) => post('/inventory/movements', body),
};

// ============ REPORTS ============
export const reportsApi = {
  overview: (query?: QueryParams) => get<any>('/reports/overview', query),
  daily: (query?: QueryParams) => get<any>('/reports/daily', query),
  revenue: (query?: QueryParams) => get<any>('/reports/revenue', query),
  sources: (query?: QueryParams) => get<any>('/reports/sources', query),
  topGuests: (query?: QueryParams) => get<any>('/reports/top-guests', query),
  housekeepingEfficiency: (query?: QueryParams) => get<any>('/reports/housekeeping-efficiency', query),
};

// ============ NOTIFICATIONS / AUDIT ============
export const notificationsApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/notifications', query),
  unreadCount: () => get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => patch(`/notifications/${id}/read`, {}),
  markAllRead: () => patch('/notifications/read-all', {}),
};

export const auditApi = {
  list: (query?: QueryParams) => get<Paginated<any>>('/audit-log', query),
};

// ============ WEBSOCKET (realtime notifications) ============
export function connectRealtime(onNotification: (n: any) => void): () => void {
  const { access } = getTokens();
  if (!access) return () => {};
  const wsBase = WS_URL.replace(/^http/, 'ws');
  const socket = new WebSocket(`${wsBase}/realtime?token=${encodeURIComponent(access)}`);
  socket.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.event === 'notification:new') onNotification(data.data);
    } catch {
      /* ignore */
    }
  };
  return () => socket.close();
}