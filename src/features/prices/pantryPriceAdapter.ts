import type { NewPantryItem, PantryItem } from '../../types/domain';
import type { PriceStock } from './types';

export function stockToPantry(stock: PriceStock): PantryItem {
  return { id: stock.id, userId: 'personal-user', item: stock.itemName, amount: Number(stock.amount), unit: stock.unit, price: stock.priceMajor, expirationDate: stock.expirationDate, category: stock.category, notes: stock.notes, isActive: stock.isActive, catalogItemId: stock.itemId };
}

export function pantryToStock(input: NewPantryItem | PantryItem, id = 'stock'): PriceStock {
  return { id, itemId: id, itemName: input.item, brand: null, packageQuantity: null, packageUnit: null, amount: String(input.amount), unit: input.unit, priceMajor: input.price, expirationDate: input.expirationDate, category: input.category, notes: input.notes, isActive: input.isActive };
}

export function minorToMajor(minor: number, currency: string): number {
  return minor / (currency.toUpperCase() === 'JPY' ? 1 : 100);
}
