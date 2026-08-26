const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const user_jwt = require('../middleware/user_jwt');
const multer = require('multer');
const {
    attachImageUrls,
    uploadProductImage,
    deleteProductImage
} = require('../utils/s3');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

router.get('/', async (req, res) => {
    try {
        const queryObject = {};
        if (req.query.name) {
            queryObject.Product_Name = { $regex: req.query.name, $options: 'i' };
        }

        const { page, limit, skip } = parsePagination(req.query);
        const [products, total] = await Promise.all([
            Product.find(queryObject).sort({ _id: -1 }).skip(skip).limit(limit),
            Product.countDocuments(queryObject)
        ]);

        await attachImageUrls(products);

        return res.status(200).json({
            success: true,
            product: products,
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed to load products' });
    }
});

router.get('/detail/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
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
        const products = await Product.find({ user_id: req.params.userId }).sort({ _id: -1 });
        await attachImageUrls(products);
        return res.status(200).json({ success: true, product: products });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed to load products' });
    }
});

router.post('/', user_jwt, upload.single('Product_Image'), async (req, res) => {
    try {
        const Name = (req.body.Product_Name || '').trim();
        const Detail = (req.body.Product_Detail || '').trim();
        const Price = (req.body.Price || '').trim();

        if (!Name || !Detail || !Price) {
            return res.status(400).json({
                success: false,
                msg: 'Product name, detail, and price are required'
            });
        }

        const prod = new Product({
            user_id: req.user.id,
            Product_Name: Name,
            Product_Detail: Detail,
            Price
        });

        if (req.file) {
            try {
                prod.Image = await uploadProductImage(req.file);
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
            if (!product) {
                errors.push({ id, msg: "Product doesn't exist." });
                continue;
            }
            if (String(product.user_id) !== String(req.user.id)) {
                errors.push({ id, msg: 'Not allowed to delete this product' });
                continue;
            }

            await Product.findByIdAndDelete(id);
            deleted.push(id);
            await deleteProductImage(product.Image);
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

router.put('/:id', user_jwt, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, msg: "Product doesn't exist." });
        }
        if (String(product.user_id) !== String(req.user.id)) {
            return res.status(403).json({ success: false, msg: 'Not allowed to update this product' });
        }

        const allowed = ['Product_Name', 'Product_Detail', 'Price'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                product[key] = String(req.body[key]).trim();
            }
        }

        if (!product.Product_Name || !product.Product_Detail || !product.Price) {
            return res.status(400).json({
                success: false,
                msg: 'Product name, detail, and price are required'
            });
        }

        await product.save();
        return res.status(200).json({ success: true, msg: 'Updated', product });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed to update product' });
    }
});

module.exports = router;
