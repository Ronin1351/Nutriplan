import type { NewPantryItem, PantryCategory, PantryItem } from '../../types/domain';

export type PriceId = string;
export type PriceSource = 'receipt' | 'photo' | 'manual';
export type PriceKind = 'purchase' | 'quote';

export interface CatalogItem {
  id: PriceId;
  name: string;
  brand: string | null;
  packageQuantity: string | null;
  packageUnit: string | null;
  category: PantryCategory | string;
  createdAt: string;
}

export interface ItemAlias {
  id: PriceId;
  itemId: PriceId;
  merchantId: PriceId | null;
  value: string;
}

export interface Merchant {
  id: PriceId;
  name: string;
}

export interface CaptureLine {
  lineId: string;
  ordinal: number;
  itemId?: PriceId;
  itemName: string;
  brand?: string | null;
  category?: string;
  quantity: string;
  unit: string;
  paidMinor: number;
  packageQuantity?: string | null;
  packageUnit?: string | null;
}

export interface PriceCapture {
  operationId: string;
  kind: PriceKind;
  source: PriceSource;
  occurredOn: string;
  dateEstimated: boolean;
  capturedAt: string;
  currency: string;
  merchantName?: string | null;
  receiptNumber?: string | null;
  lines: CaptureLine[];
}

export interface PriceEvent {
  id: PriceId;
  operationId: string;
  kind: PriceKind;
  source: PriceSource;
  occurredOn: string;
  dateEstimated: boolean;
  capturedAt: string;
  currency: string;
  merchantId: PriceId | null;
  receiptNumber: string | null;
  fingerprint: string;
  revision: number;
}

export interface PriceObservation {
  id: PriceId;
  eventId: PriceId;
  itemId: PriceId;
  lineId: string;
  ordinal: number;
  quantity: string;
  unit: string;
  paidMinor: number;
  packageQuantity: string | null;
  packageUnit: string | null;
  revision: number;
}

export interface PriceStock {
  id: PriceId;
  itemId: PriceId;
  itemName: string;
  brand: string | null;
  packageQuantity: string | null;
  packageUnit: string | null;
  amount: string;
  unit: string;
  priceMajor: number;
  expirationDate: string | null;
  category: string;
  notes: string | null;
  isActive: boolean;
  currency?: string;
}

export interface PriceHistoryQuery {
  from?: string;
  to?: string;
  currency?: string;
  source?: PriceKind;
  basis?: 'package' | 'kg' | 'l' | 'each';
}

export interface PriceHistoryPoint {
  observationId: PriceId;
  eventId: PriceId;
  itemId: PriceId;
  occurredOn: string;
  capturedAt: string;
  currency: string;
  kind: PriceKind;
  dateEstimated: boolean;
  paidMinor: number;
  quantity: string;
  unit: string;
  packageQuantity: string | null;
  packageUnit: string | null;
  merchantName: string | null;
}

export interface PriceSummary {
  latest: PriceHistoryPoint;
  previous: PriceHistoryPoint | null;
  changeMinor: number | null;
  changePercent: number | null;
}

export interface ComparablePrice {
  minor: number;
  basis: 'package' | 'kg' | 'l' | 'each';
  currency: string;
}

export interface ObservationCorrection {
  paidMinor?: number;
  quantity?: string;
  unit?: string;
  packageQuantity?: string | null;
  packageUnit?: string | null;
}

export interface EventCorrection {
  occurredOn?: string;
  dateEstimated?: boolean;
  merchantName?: string | null;
}

export interface PriceExport {
  schemaVersion: 2;
  items: CatalogItem[];
  aliases: ItemAlias[];
  merchants: Merchant[];
  events: PriceEvent[];
  observations: PriceObservation[];
  stock: PriceStock[];
}

export interface SaveCaptureResult {
  status: 'saved' | 'duplicate';
  eventId: PriceId;
  matchedCatalogIds: PriceId[];
  affectedStockIds: PriceId[];
}

export interface PriceStore {
  saveCapture(input: PriceCapture): Promise<SaveCaptureResult>;
  getHistory(itemId: PriceId, query?: PriceHistoryQuery): Promise<PriceHistoryPoint[]>;
  getLatest(itemId: PriceId, currency?: string): Promise<PriceSummary | null>;
  correctObservation(id: PriceId, expectedRevision: number, changes: ObservationCorrection): Promise<PriceObservation>;
  correctEvent(id: PriceId, expectedRevision: number, changes: EventCorrection): Promise<PriceEvent>;
  exportRecords(): Promise<PriceExport>;
  listStock(): Promise<PantryItem[]>;
  createStock(input: NewPantryItem): Promise<PantryItem>;
  updateStock(item: PantryItem): Promise<PantryItem>;
  findStockCollision(item: PantryItem): Promise<PantryItem | null>;
  mergeStockInto(sourceId: string, targetId: string): Promise<PantryItem>;
  removeStock(id: string | number): Promise<void>;
  saveStockNotes(id: string | number, notes: string | null): Promise<void>;
}
