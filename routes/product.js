const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Favorite = require('../models/favorite');
const user_jwt = require('../middleware/user_jwt');
const { isValidPrice } = require('../middleware/validate');
const multer = require('multer');
const {
  attachImageUrls,
  uploadProductImages
} = require('../utils/s3');
const { requireMongo, mongoFailure } = require('../utils/mongo');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(requireMongo);

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a tolerant name query: exact regex + optional text index + character-class fuzzy. */
function buildNameFilter(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  const tokens = raw.split(/\s+/).filter(Boolean).slice(0, 6);
  const or = [
    { Product_Name: { $regex: escapeRegex(raw), $options: 'i' } },
    { Product_Detail: { $regex: escapeRegex(raw), $options: 'i' } },
  ];
  // Soft typo tolerance: allow one optional char between letters for short tokens.
  for (const token of tokens) {
    if (token.length < 3 || token.length > 12) continue;
    const soft = token
      .split('')
      .map((ch) => escapeRegex(ch))
      .join('.?');
    or.push({ Product_Name: { $regex: soft, $options: 'i' } });
  }
  try {
    or.push({ $text: { $search: raw } });
  } catch {
    /* text index may be missing on fresh DB */
  }
  return { $or: or };
}

function buildListQuery(query, { includeDeleted = false } = {}) {
  const queryObject = {};
  if (!includeDeleted) {
    queryObject.status = { $ne: 'deleted' };
  }
  if (query.status === 'active' || query.status === 'sold') {
    queryObject.status = query.status;
  }
  if (query.name) {
    const nameFilter = buildNameFilter(query.name);
    if (nameFilter) Object.assign(queryObject, nameFilter);
  }
  if (query.category && Product.CATEGORIES.includes(query.category)) {
    queryObject.category = query.category;
  }
  if (query.colour && Product.COLOURS.includes(query.colour)) {
    queryObject.colour = query.colour;
  }
  const min = query.minPrice !== undefined ? Number(query.minPrice) : null;
  const max = query.maxPrice !== undefined ? Number(query.maxPrice) : null;
  if ((min !== null && Number.isFinite(min)) || (max !== null && Number.isFinite(max))) {
    const priceExpr = { $toDouble: { $ifNull: ['$Price', '0'] } };
    const and = [];
    if (min !== null && Number.isFinite(min)) and.push({ $gte: [priceExpr, min] });
    if (max !== null && Number.isFinite(max)) and.push({ $lte: [priceExpr, max] });
    queryObject.$expr = and.length === 1 ? and[0] : { $and: and };
  }
  return queryObject;
}

function sortSpec(sort) {
  switch (sort) {
    case 'price_asc':
      return { Price: 1 };
    case 'price_desc':
      return { Price: -1 };
    case 'oldest':
      return { _id: 1 };
    case 'popular':
      return { favoriteCount: -1, _id: -1 };
    case 'newest':
    default:
      return { _id: -1 };
  }
}

router.get('/meta/categories', (req, res) => {
  return res.status(200).json({
    success: true,
    categories: Product.CATEGORIES,
    colours: Product.COLOURS
  });
});

router.get('/', async (req, res) => {
  try {
    const queryObject = buildListQuery(req.query);
    const { page, limit, skip } = parsePagination(req.query);
    const sortKey = req.query.sort || 'newest';
    const sort = sortSpec(sortKey);

    let products;
    let total;
    const needsAggregate =
      sortKey === 'price_asc' ||
      sortKey === 'price_desc' ||
      sortKey === 'popular';

    if (needsAggregate) {
      const pipeline = [{ $match: queryObject }];

      if (sortKey === 'price_asc' || sortKey === 'price_desc') {
        const direction = sortKey === 'price_asc' ? 1 : -1;
        pipeline.push({
          $addFields: { priceNum: { $toDouble: { $ifNull: ['$Price', '0'] } } }
        });
        pipeline.push({ $sort: { priceNum: direction } });
      } else if (sortKey === 'popular') {
        pipeline.push({
          $addFields: { productIdStr: { $toString: '$_id' } }
        });
        pipeline.push({
          $lookup: {
            from: Favorite.collection.name,
            localField: 'productIdStr',
            foreignField: 'product_id',
            as: '_favorites'
          }
        });
        pipeline.push({
          $addFields: { favoriteCount: { $size: '$_favorites' } }
        });
        pipeline.push({ $project: { _favorites: 0, productIdStr: 0 } });
        pipeline.push({ $sort: sort });
      }

      pipeline.push({
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }]
        }
      });

      const [result] = await Product.aggregate(pipeline);
      products = result.data || [];
      total = result.total?.[0]?.count || 0;
    } else {
      [products, total] = await Promise.all([
        Product.find(queryObject).sort(sort).skip(skip).limit(limit),
        Product.countDocuments(queryObject)
      ]);
    }

    await attachImageUrls(products);

    return res.status(200).json({
      success: true,
      product: products,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      categories: Product.CATEGORIES,
      colours: Product.COLOURS
    });
  } catch (error) {
    console.log(error);
    return mongoFailure(res, error, 'Failed to load products');
  }
});

router.get('/detail/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.status === 'deleted') {
      return res.status(404).json({ success: false, msg: 'Product not found' });
    }
    await attachImageUrls([product]);
    const User = require('../models/user');
    const seller = await User.findById(product.user_id).select(
      'username shopName bio avatar',
    );
    return res.status(200).json({
      success: true,
      product,
      seller: seller
        ? {
            _id: seller._id,
            username: seller.username,
            shopName: seller.shopName || seller.username,
            bio: seller.bio || '',
            avatar: seller.avatar,
          }
        : null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load product' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === '1';
    const filter = { user_id: req.params.userId };
    if (!includeDeleted) filter.status = { $ne: 'deleted' };
    const products = await Product.find(filter).sort({ _id: -1 });
    await attachImageUrls(products);
    return res.status(200).json({ success: true, product: products });
  } catch (error) {
    console.log(error);
    return mongoFailure(res, error, 'Failed to load products');
  }
});

router.get('/seller/stats', user_jwt, async (req, res) => {
  try {
    const userId = req.user.id;
    const [active, sold, deleted, products] = await Promise.all([
      Product.countDocuments({ user_id: userId, status: 'active' }),
      Product.countDocuments({ user_id: userId, status: 'sold' }),
      Product.countDocuments({ user_id: userId, status: 'deleted' }),
      Product.find({ user_id: userId, status: { $ne: 'deleted' } })
    ]);
    const revenue = products
      .filter((p) => p.status === 'sold')
      .reduce((sum, p) => sum + (Number(p.Price) || 0), 0);

    return res.status(200).json({
      success: true,
      stats: {
        active,
        sold,
        deleted,
        listings: active + sold,
        revenue: revenue.toFixed(2)
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load seller stats' });
  }
});

router.post('/', user_jwt, upload.array('Product_Image', 8), async (req, res) => {
  try {
    const Name = (req.body.Product_Name || '').trim();
    const Detail = (req.body.Product_Detail || '').trim();
    const Price = (req.body.Price || '').trim();
    const category = (req.body.category || 'Other').trim();
    const colour = (req.body.colour || 'Other').trim();
    const stock = Math.max(0, parseInt(req.body.stock, 10) || 1);

    if (!Name || !Detail || !Price) {
      return res.status(400).json({
        success: false,
        msg: 'Product name, detail, and price are required'
      });
    }
    if (!isValidPrice(Price)) {
      return res.status(400).json({ success: false, msg: 'Price must be a valid number' });
    }
    if (!Product.CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, msg: 'Invalid category' });
    }
    if (!Product.COLOURS.includes(colour)) {
      return res.status(400).json({ success: false, msg: 'Invalid colour' });
    }

    const prod = new Product({
      user_id: req.user.id,
      Product_Name: Name,
      Product_Detail: Detail,
      Price,
      category,
      colour,
      stock,
      status: stock === 0 ? 'sold' : 'active'
    });

    if (req.files?.length) {
      try {
        const keys = await uploadProductImages(req.files);
        prod.Images = keys;
        prod.Image = keys[0];
      } catch (error) {
        return res.status(error.status || 500).json({
          success: false,
          msg: error.message || 'Image upload failed'
        });
      }
    }

    await prod.save();
    return res.status(200).json({
      success: true,
      msg: 'Product added',
      product: prod
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to add product' });
  }
});

router.put('/delete/bulk', user_jwt, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.id) ? req.body.id : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, msg: 'No product ids provided' });
    }

    const deleted = [];
    const errors = [];

    for (const id of ids) {
      const product = await Product.findById(id);
      if (!product || product.status === 'deleted') {
        errors.push({ id, msg: "Product doesn't exist." });
        continue;
      }
      if (String(product.user_id) !== String(req.user.id)) {
        errors.push({ id, msg: 'Not allowed to delete this product' });
        continue;
      }

      product.status = 'deleted';
      product.deletedAt = new Date();
      await product.save();
      deleted.push(id);
      // Keep S3 object for soft-delete recovery; hard cleanup optional later
    }

    if (deleted.length === 0) {
      return res.status(400).json({
        success: false,
        msg: 'No products deleted.',
        errors
      });
    }

    return res.status(200).json({
      success: true,
      msg: 'Product deleted.',
      deleted,
      errors: errors.length ? errors : undefined
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to delete products' });
  }
});

router.put('/:id/sold', user_jwt, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.status === 'deleted') {
      return res.status(404).json({ success: false, msg: "Product doesn't exist." });
    }
    if (String(product.user_id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, msg: 'Not allowed' });
    }
    product.status = 'sold';
    product.stock = 0;
    await product.save();
    return res.status(200).json({ success: true, msg: 'Marked as sold', product });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to update product' });
  }
});

router.put('/:id', user_jwt, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.status === 'deleted') {
      return res.status(404).json({ success: false, msg: "Product doesn't exist." });
    }
    if (String(product.user_id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        msg: 'Not allowed to update this product'
      });
    }

    const allowed = ['Product_Name', 'Product_Detail', 'Price', 'category', 'colour', 'stock', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        product[key] = typeof req.body[key] === 'string' ? String(req.body[key]).trim() : req.body[key];
      }
    }

    if (!product.Product_Name || !product.Product_Detail || !product.Price) {
      return res.status(400).json({
        success: false,
        msg: 'Product name, detail, and price are required'
      });
    }
    if (!isValidPrice(product.Price)) {
      return res.status(400).json({ success: false, msg: 'Price must be a valid number' });
    }
    if (product.category && !Product.CATEGORIES.includes(product.category)) {
      return res.status(400).json({ success: false, msg: 'Invalid category' });
    }
    if (product.colour && !Product.COLOURS.includes(product.colour)) {
      return res.status(400).json({ success: false, msg: 'Invalid colour' });
    }
    if (product.stock !== undefined) {
      const prevStock = product.stock;
      product.stock = Math.max(0, Number(product.stock) || 0);
      if (product.stock === 0 && product.status === 'active') product.status = 'sold';
      if (product.stock > 0 && product.status === 'sold') product.status = 'active';
      // Inventory alert when crossing below threshold
      const threshold = Number(product.lowStockThreshold) || 2;
      if (prevStock > threshold && product.stock <= threshold) {
        const User = require('../models/user');
        const { notifyUser } = require('../utils/notifications');
        const seller = await User.findById(product.user_id).select('settings');
        if (seller?.settings?.stockAlerts !== false) {
          await notifyUser({
            user_id: product.user_id,
            type: 'system',
            title: 'Low stock alert',
            body: `${product.Product_Name} has ${product.stock} left`,
            link: '/mine',
          });
        }
      }
    }

    await product.save();
    return res.status(200).json({ success: true, msg: 'Updated', product });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to update product' });
  }
});

/** Reorder gallery images (cover = first). */
router.put('/:id/images/order', user_jwt, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.status === 'deleted') {
      return res.status(404).json({ success: false, msg: "Product doesn't exist." });
    }
    if (String(product.user_id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, msg: 'Not allowed' });
    }
    const order = Array.isArray(req.body.images) ? req.body.images.map(String) : [];
    if (!order.length) {
      return res.status(400).json({ success: false, msg: 'images array required' });
    }
    const current = Array.isArray(product.Images) && product.Images.length
      ? product.Images.map(String)
      : product.Image
        ? [String(product.Image)]
        : [];
    const set = new Set(current);
    if (order.length !== current.length || order.some((k) => !set.has(k))) {
      return res.status(400).json({ success: false, msg: 'Image list must match existing keys' });
    }
    product.Images = order;
    product.Image = order[0] || product.Image;
    await product.save();
    await attachImageUrls([product]);
    return res.status(200).json({ success: true, product });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to reorder images' });
  }
});

module.exports = router;
