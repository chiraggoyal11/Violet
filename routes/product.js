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

function buildListQuery(query, { includeDeleted = false } = {}) {
  const queryObject = {};
  if (!includeDeleted) {
    queryObject.status = { $ne: 'deleted' };
  }
  if (query.status === 'active' || query.status === 'sold') {
    queryObject.status = query.status;
  }
  if (query.name) {
    queryObject.Product_Name = { $regex: query.name, $options: 'i' };
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
    // Price stored as string — compare numerically via $expr after fetch is heavy;
    // keep simple regex-free filter using $toDouble when possible.
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
    return res.status(200).json({ success: true, product });
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
      product.stock = Math.max(0, Number(product.stock) || 0);
      if (product.stock === 0 && product.status === 'active') product.status = 'sold';
      if (product.stock > 0 && product.status === 'sold') product.status = 'active';
    }

    await product.save();
    return res.status(200).json({ success: true, msg: 'Updated', product });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to update product' });
  }
});

module.exports = router;
