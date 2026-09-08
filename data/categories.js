/**
 * Product categories aligned with major handmade marketplaces (Etsy top-level),
 * plus Food & Drink for edible handmade goods and Other as a catch-all.
 * https://www.etsy.com/help/categories/seller
 */
const PRODUCT_CATEGORIES = [
  'Accessories',
  'Art & Collectibles',
  'Bags & Purses',
  'Bath & Beauty',
  'Books, Movies & Music',
  'Clothing',
  'Craft Supplies & Tools',
  'Electronics & Accessories',
  'Food & Drink',
  'Home & Living',
  'Jewelry',
  'Paper & Party Supplies',
  'Pet Supplies',
  'Shoes',
  'Toys & Games',
  'Weddings',
  'Other',
];

/** Map older Violet category values onto the expanded list. */
const LEGACY_CATEGORY_MAP = {
  Home: 'Home & Living',
  Fashion: 'Clothing',
  Art: 'Art & Collectibles',
  Food: 'Food & Drink',
};

module.exports = {
  PRODUCT_CATEGORIES,
  LEGACY_CATEGORY_MAP,
};
