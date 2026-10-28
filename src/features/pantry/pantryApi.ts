import type { SupabaseClient } from '@supabase/supabase-js';
import { mapPantryRow, toPantryInsert, toPantryRow } from '../../lib/mappers';
import { getSupabaseClient, unwrapSupabase } from '../../lib/supabase/client';
import type { DatabasePantryRow } from '../../types/database';
import type { NewPantryItem, PantryItem } from '../../types/domain';

export async function listPantry(
  client: SupabaseClient = getSupabaseClient(),
  userId: string | number,
): Promise<PantryItem[]> {
  const rows = await unwrapSupabase<DatabasePantryRow[]>(
    client.from('pantry').select('*').eq('user_id', userId).order('item', { ascending: true }),
    'List pantry',
  );
  return rows.map(mapPantryRow);
}

export async function createPantryItem(
  client: SupabaseClient,
  item: NewPantryItem,
): Promise<PantryItem> {
  const rows = await unwrapSupabase<DatabasePantryRow[]>(
    client.from('pantry').insert(toPantryInsert(item)).select(),
    'Create pantry item',
  );
  const row = rows[0];
  if (!row) throw new Error('Create pantry item: Supabase returned no item.');
  return mapPantryRow(row);
}

export async function updatePantryItem(client: SupabaseClient, item: PantryItem): Promise<PantryItem> {
  const rows = await unwrapSupabase<DatabasePantryRow[]>(
    client.from('pantry').update(toPantryRow(item)).eq('id', item.id).select(),
    'Update pantry item',
  );
  const row = rows[0];
  if (!row) throw new Error('Update pantry item: Supabase returned no item.');
  return mapPantryRow(row);
}

export async function archivePantryItem(client: SupabaseClient, itemId: string | number): Promise<void> {
  await unwrapSupabase<DatabasePantryRow[]>(
    client.from('pantry').update({ amount: 0, is_active: false }).eq('id', itemId),
    'Archive pantry item',
  );
}

export async function deletePantryItem(client: SupabaseClient, itemId: string | number): Promise<void> {
  await unwrapSupabase<DatabasePantryRow[]>(
    client.from('pantry').delete().eq('id', itemId),
    'Delete pantry item',
  );
}

export async function savePantryNotes(
  client: SupabaseClient,
  itemId: string | number,
  notes: string | null,
): Promise<void> {
  await unwrapSupabase<DatabasePantryRow[]>(
    client.from('pantry').update({ notes }).eq('id', itemId),
    'Save pantry notes',
  );
}
