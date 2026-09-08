const Product = require('../models/product');
const { LEGACY_CATEGORY_MAP } = require('../data/categories');

/**
 * Remap older category labels onto the expanded handmade marketplace list.
 * Safe to run repeatedly.
 */
async function migrateProductCategories() {
  const legacyNames = Object.keys(LEGACY_CATEGORY_MAP);
  const pending = await Product.countDocuments({ category: { $in: legacyNames } });
  if (!pending) return { updated: 0 };

  let updated = 0;
  for (const [from, to] of Object.entries(LEGACY_CATEGORY_MAP)) {
    const result = await Product.updateMany(
      { category: from },
      { $set: { category: to } }
    );
    updated += result.modifiedCount || 0;
  }
  return { updated };
}

module.exports = { migrateProductCategories };
