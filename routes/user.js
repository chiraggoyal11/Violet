const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Product = require('../models/product');
const bcryptjs = require('bcryptjs');
const user_jwt = require('../middleware/user_jwt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3Configured = Boolean(
    bucketName &&
    bucketRegion &&
    accessKey &&
    secretAccessKey &&
    !String(accessKey).startsWith('local-dev') &&
    !String(secretAccessKey).startsWith('local-dev')
);

const s3 = s3Configured
    ? new S3Client({
        region: bucketRegion,
        credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretAccessKey
        }
    })
    : null;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

function publicUser(user) {
    if (!user) return null;
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.password;
    return obj;
}

async function attachImageUrls(products) {
    for (const prod of products) {
        if (!prod.Image || !s3) continue;
        try {
            const url = await getSignedUrl(
                s3,
                new GetObjectCommand({
                    Bucket: bucketName,
                    Key: prod.Image
                }),
                { expiresIn: 3600 }
            );
            prod.ImageUrl = url;
        } catch (error) {
            console.log('Signed URL skipped:', error.message);
        }
    }
    return products;
}

function signToken(userId) {
    return new Promise((resolve, reject) => {
        jwt.sign(
            { user: { id: userId } },
            process.env.jwtSecret,
            { expiresIn: '7d' },
            (err, token) => (err ? reject(err) : resolve(token))
        );
    });
}

router.get('/', user_jwt, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }
        return res.status(200).json({ success: true, user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
});

router.post('/add', user_jwt, upload.single('Product_Image'), async (req, res) => {
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
            if (!s3) {
                return res.status(503).json({
                    success: false,
                    msg: 'Image upload is unavailable until AWS S3 is configured. List without an image, or add real AWS credentials.'
                });
            }
            const fileName = `${Date.now()}-${req.file.originalname}`;
            await s3.send(
                new PutObjectCommand({
                    Bucket: bucketName,
                    Key: fileName,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype
                })
            );
            prod.Image = fileName;
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

router.get('/get/:id', async (req, res) => {
    try {
        const products = await Product.find({ user_id: req.params.id });
        await attachImageUrls(products);
        return res.status(200).json({ success: true, product: products });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed to load products' });
    }
});

router.get('/get', async (req, res) => {
    try {
        const queryObject = {};
        if (req.query.name) {
            queryObject.Product_Name = { $regex: req.query.name, $options: 'i' };
        }
        const products = await Product.find(queryObject);
        await attachImageUrls(products);
        return res.status(200).json({ success: true, product: products });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed to load products' });
    }
});

router.put('/update/:id', user_jwt, async (req, res) => {
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

router.put('/delete', user_jwt, async (req, res) => {
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

            if (product.Image && s3) {
                try {
                    await s3.send(
                        new DeleteObjectCommand({
                            Bucket: bucketName,
                            Key: product.Image
                        })
                    );
                } catch (error) {
                    console.log(`S3 image cleanup failed for ${id}:`, error.message);
                }
            }
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

router.post('/register', async (req, res) => {
    const username = (req.body.username || '').trim();
    const phone_no = (req.body.phone_no || '').trim();
    const password = req.body.password || '';

    try {
        if (!username || !phone_no || !password) {
            return res.status(400).json({
                success: false,
                msg: 'Username, phone number, and password are required'
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                msg: 'Password must be at least 6 characters'
            });
        }

        const user_exist = await User.findOne({ phone_no });
        if (user_exist) {
            return res.status(409).json({
                success: false,
                msg: 'user already exist'
            });
        }

        const user = new User({
            username,
            phone_no,
            password: await bcryptjs.hash(password, await bcryptjs.genSalt(10)),
            avatar: 'https://gravatar.com/avatar/?s=200&d=retro'
        });

        await user.save();
        const token = await signToken(user.id);

        return res.status(200).json({
            success: true,
            token,
            user: publicUser(user)
        });
    } catch (err) {
        console.log(err);
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                msg: 'user already exist'
            });
        }
        return res.status(500).json({ success: false, msg: 'Registration failed' });
    }
});

router.post('/login', async (req, res) => {
    const phone_no = (req.body.phone_no || '').trim();
    const password = req.body.password || '';

    try {
        if (!phone_no || !password) {
            return res.status(400).json({
                success: false,
                msg: 'Phone number and password are required'
            });
        }

        const user = await User.findOne({ phone_no });
        if (!user) {
            return res.status(400).json({
                success: false,
                msg: "Invalid Phone number , doesn't exist. "
            });
        }

        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                msg: 'Invalid password'
            });
        }

        const token = await signToken(user.id);
        return res.status(200).json({
            success: true,
            token,
            user: publicUser(user)
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed' });
    }
});

module.exports = router;
