export type StorageLocation = 'fridge' | 'freezer';

export interface InwardItem {
  id: string;
  item: string;
  category: string;
  qty_in: number;
  unit: string;
  date_in: string;
  time_in: string;
  donor: string;
  entered_by: string;
  best_before: string;
  storage: StorageLocation;
  total_taken: number;
  total_wasted: number;
  qty_remaining: number;
  status: 'available' | 'partial' | 'gone';
  moved_to: string;
  moved_date: string;
}

export interface OutwardEntry {
  id: number;
  inward_id: string;
  item: string;
  category: string;
  storage: StorageLocation;
  qty_taken: number;
  date_taken: string;
  time_taken: string;
  taken_by: string;
  recorded_by: string;
  source: string;
  donor: string;
}

export interface WastageEntry {
  id: number;
  inward_id: string;
  item: string;
  category: string;
  storage: StorageLocation;
  qty_wasted: number;
  reason: string;
  date_wasted: string;
  reported_by: string;
  notes: string;
  weight_kg: number;
  donor: string;
}

export interface CustomItem {
  id: number;
  name: string;
  category: string;
}

export interface Volunteer {
  id: number;
  name: string;
  initials: string;
}

export interface Donor {
  id: number;
  name: string;
}

export interface ArchivedRecord {
  id: string;
  item: string;
  category: string;
  qty_in: number;
  unit: string;
  date_in: string;
  storage: StorageLocation;
  donor: string;
  best_before: string;
  total_taken: number;
  total_wasted: number;
  archived_date: string;
  outwards_json: string;
  wastage_json: string;
}

export type TabName = 'dashboard' | 'inwards' | 'outwards' | 'wastage' | 'items' | 'reports' | 'history' | 'admin';

export const CATEGORIES = [
  'Bakery', 'Chilled', 'Condiments', 'Dairy', 'Drinks', 'Dry Goods',
  'Frozen', 'Fruit', 'Meat', 'Produce', 'Ready Meals', 'Snacks', 'Vegetables', 'Other'
] as const;

export const CATEGORY_COLOURS: Record<string, string> = {
  'Bakery':      'bg-amber-100 text-amber-800 border-amber-300',
  'Chilled':     'bg-sky-100 text-sky-800 border-sky-300',
  'Dairy':       'bg-blue-100 text-blue-800 border-blue-300',
  'Drinks':      'bg-cyan-100 text-cyan-800 border-cyan-300',
  'Dry Goods':   'bg-stone-100 text-stone-800 border-stone-300',
  'Frozen':      'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Meat':        'bg-red-100 text-red-800 border-red-300',
  'Produce':     'bg-green-100 text-green-800 border-green-300',
  'Ready Meals': 'bg-orange-100 text-orange-800 border-orange-300',
  'Snacks':      'bg-pink-100 text-pink-800 border-pink-300',
  'Fruit':       'bg-lime-100 text-lime-800 border-lime-300',
  'Vegetables':  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Condiments':  'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Other':       'bg-gray-100 text-gray-800 border-gray-300',
};

export const UNITS = ['items', 'kg', 'litres', 'packs', 'loaves', 'bags', 'boxes', 'tins'] as const;

export const WASTAGE_REASONS = [
  'Past Expiry', 'Damaged', 'Spoiled', 'Contaminated', 'Unknown'
] as const;

export const REFERENCE_ITEMS: Record<string, string> = {
  'Whole Milk': 'Dairy',
  'Semi Skimmed Milk': 'Dairy',
  'Skimmed Milk': 'Dairy',
  'Butter': 'Dairy',
  'Cheese': 'Dairy',
  'Yoghurt': 'Dairy',
  'Eggs': 'Dairy',
  'White Bread': 'Bakery',
  'Brown Bread': 'Bakery',
  'Baguette': 'Bakery',
  'Croissants': 'Bakery',
  'Muffins': 'Bakery',
  'Scones': 'Bakery',
  'Rolls': 'Bakery',
  'Chicken Breast': 'Meat',
  'Beef Mince': 'Meat',
  'Pork Chops': 'Meat',
  'Sausages': 'Meat',
  'Bacon': 'Meat',
  'Ham': 'Meat',
  'Lamb Chops': 'Meat',
  'Apples': 'Produce',
  'Bananas': 'Produce',
  'Oranges': 'Produce',
  'Carrots': 'Produce',
  'Potatoes': 'Produce',
  'Onions': 'Produce',
  'Tomatoes': 'Produce',
  'Lettuce': 'Produce',
  'Cucumber': 'Produce',
  'Peppers': 'Produce',
  'Mushrooms': 'Produce',
  'Broccoli': 'Produce',
  'Radishes': 'Produce',
  'Pasta': 'Dry Goods',
  'Rice': 'Dry Goods',
  'Beans': 'Dry Goods',
  'Soup': 'Dry Goods',
  'Cereal': 'Dry Goods',
  'Tea': 'Drinks',
  'Coffee': 'Drinks',
  'Orange Juice': 'Drinks',
  'Water': 'Drinks',
  'Lasagne': 'Ready Meals',
  "Shepherd's Pie": 'Ready Meals',
  'Toad In The Hole': 'Ready Meals',
  'Cottage Pie': 'Ready Meals',
  'Fish Fingers': 'Frozen',
  'Frozen Peas': 'Frozen',
  'Ice Cream': 'Frozen',
  'Pizza': 'Frozen',
  'Crisps': 'Snacks',
  'Biscuits': 'Snacks',
  'Chocolate': 'Snacks',
};
