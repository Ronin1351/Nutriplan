const VOLUME_TO_ML: Record<string, number> = {
  teaspoon: 4.93, tsp: 4.93, t: 4.93,
  tablespoon: 14.79, tbsp: 14.79, T: 14.79, Tbl: 14.79,
  fluid_ounce: 29.57, floz: 29.57, oz_fl: 29.57,
  cup: 236.59, cups: 236.59, pint: 473.18, pt: 473.18,
  quart: 946.35, qt: 946.35, gallon: 3785.41, gal: 3785.41,
  milliliter: 1, ml: 1, liter: 1000, l: 1000, L: 1000,
  dash: 0.62, pinch: 0.31, smidgen: 0.15,
  tablespoon_metric: 15, tablespoon_au: 20,
};

const MASS_TO_G: Record<string, number> = {
  ounce: 28.35, oz: 28.35, pound: 453.592, lb: 453.592, lbs: 453.592,
  gram: 1, g: 1, kilogram: 1000, kg: 1000,
};

// Ingredient weights are based on the supplied Ingredient_Conversion_Reference.xlsx,
// sheet "5 Ingredients". Volume↔mass results are intentionally marked approximate.
const DENSITIES_G_PER_CUP: Record<string, number> = {
  all_purpose_flour: 120, bread_flour: 120, cake_flour: 120, pastry_flour: 106,
  self_rising_flour: 113, whole_wheat_flour: 113, rye_flour: 103, spelt_flour: 99,
  semolina: 163, almond_flour_meal: 96, coconut_flour: 128, oat_flour: 92,
  rice_flour_white: 142, chickpea_gram_flour: 85, cornmeal: 138, cornstarch: 112,
  potato_starch: 160, rolled_old_fashioned_oats: 89, quick_oats: 89, steel_cut_oats: 160,
  white_rice_uncooked: 185, brown_rice_uncooked: 190, rice_cooked: 158, quinoa_uncooked: 170,
  couscous_uncooked: 173, pasta_dry_small_shapes: 100, pasta_cooked: 140, bread_crumbs_dry: 108,
  panko: 50, granulated_white_sugar: 200, caster_superfine_sugar: 200, brown_sugar_packed: 213,
  powdered_confectioners_sugar: 120, honey: 340, maple_syrup: 312, molasses: 340,
  vegetable_canola_oil: 198, olive_oil: 200, coconut_oil: 200, mayonnaise: 220,
  peanut_butter: 270, almond_butter: 256, tahini: 240, water: 237, milk_any_fat: 244,
  buttermilk: 245, heavy_whipping_cream: 232, yogurt_plain: 245, sour_cream: 230,
  cream_cheese: 227, ricotta: 246, parmesan_grated: 100, eggs_whole_beaten: 243,
  broth_stock: 240, vinegar: 239, lemon_lime_juice: 244, soy_sauce: 255, fish_sauce: 272,
  ketchup: 272, tomato_paste: 262, tomato_sauce_passata: 245, pumpkin_puree: 245,
  baking_powder: 192, baking_soda: 230, gelatin_powdered: 150, salt_table_fine: 288,
  cocoa_powder_unsweetened: 84, vanilla_extract: 208, black_pepper_ground: 110,
  cinnamon_ground: 125, cumin_ground: 100, paprika: 110, garlic_powder: 150,
  dried_oregano: 48, dried_thyme: 48, dried_basil: 34, almonds_whole: 143,
  walnuts_chopped: 113, cashews: 137, chocolate_chips: 170, raisins: 149,
  dried_beans_black_kidney_pinto: 190, lentils_dry: 192, chickpeas_dry: 200,
  tofu_firm_cubed: 252, onion_chopped: 160, garlic_minced: 136, carrot_chopped: 128,
  celery_chopped: 101, bell_pepper_chopped: 149, tomato_chopped: 180, potato_diced_raw: 150,
  mushrooms_sliced: 70, spinach_raw: 30, broccoli_florets: 91, cauliflower_florets: 107,
  cabbage_shredded: 70, cucumber_sliced: 119, zucchini_sliced: 113, corn_kernels: 154,
  peas_frozen: 134, avocado_mashed: 230, apple_chopped: 125, banana_mashed: 225,
  blueberries: 148, strawberries_sliced: 166, mango_diced: 165, parsley_chopped_fresh: 60,
  basil_chopped_fresh: 42, cilantro_chopped_fresh: 16, chicken_cooked_diced: 140,
  ground_meat_raw: 225, tuna_canned_drained: 150,
};

const NON_CONVERTIBLE = new Set([
  'piece', 'pcs', 'slice', 'wedge', 'clove', 'leaf', 'sheet', 'bunch', 'sprig',
  'handful', 'can', 'bag', 'package', 'glass', 'to_taste', 'as_needed',
  'counted_item', 'units', 'unit', 'ea', 'each', 'dozen', 'box', 'bottle',
  'jar', 'pack', 'container',
]);

const CANONICAL: Record<string, string> = {
  t: 'tsp', tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tbsps: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  g: 'g', gr: 'g', gms: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'L', lt: 'L', liter: 'L', liters: 'L',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  clove: 'units', cloves: 'units', can: 'units', cans: 'units',
  slice: 'units', slices: 'units', stick: 'units', sticks: 'units',
  piece: 'units', pieces: 'units', pc: 'units', pcs: 'units',
  pinch: 'units', pinches: 'units', dash: 'units', dashes: 'units',
};

export function normalizeUnit(unit: string | null | undefined): string {
  if (!unit?.trim()) return 'units';
  const normalized = unit.trim().replace(/[().,]/g, '').replace(/\s+/g, ' ').toLowerCase();
  return CANONICAL[normalized] ?? (NON_CONVERTIBLE.has(normalized) ? 'units' : normalized);
}

function densityFor(ingredientName: string): number | undefined {
  const key = ingredientName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
  return DENSITIES_G_PER_CUP[key] ?? Object.entries(DENSITIES_G_PER_CUP).find(
    ([name]) => key.includes(name) || name.includes(key),
  )?.[1];
}

export function convertUnits(amount: number, fromUnit: string, toUnit: string, ingredientName = ''): number {
  return convertUnitsDetailed(amount, fromUnit, toUnit, ingredientName).amount;
}

export interface UnitConversionResult { amount: number; approximate: boolean; convertible: boolean; }

export function convertUnitsDetailed(amount: number, fromUnit: string, toUnit: string, ingredientName = ''): UnitConversionResult {
  if (!amount) return { amount: 0, approximate: false, convertible: true };

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to || from === 'units' || to === 'units') return { amount, approximate: false, convertible: from === to || from === 'units' || to === 'units' };

  const volumeFrom = VOLUME_TO_ML[from];
  const volumeTo = VOLUME_TO_ML[to];
  const massFrom = MASS_TO_G[from];
  const massTo = MASS_TO_G[to];

  if (volumeFrom && volumeTo) return { amount: (amount * volumeFrom) / volumeTo, approximate: false, convertible: true };
  if (massFrom && massTo) return { amount: (amount * massFrom) / massTo, approximate: false, convertible: true };

  const density = ingredientName ? densityFor(ingredientName) : undefined;
  if (density && volumeFrom && massTo) {
    const cups = (amount * volumeFrom) / VOLUME_TO_ML.cup;
    return { amount: (cups * density) / massTo, approximate: true, convertible: true };
  }
  if (density && massFrom && volumeTo) {
    const cups = (amount * massFrom) / density;
    return { amount: (cups * VOLUME_TO_ML.cup) / volumeTo, approximate: true, convertible: true };
  }

  return { amount, approximate: false, convertible: false };
}
