const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Product = require('../models/product');
const bcryptjs = require('bcryptjs');
const user_jwt = require('../middleware/user_jwt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const {S3Client, PutObjectCommand,GetObjectCommand, DeleteObjectCommand}=require('@aws-sdk/client-s3');
const {getSignedUrl} = require('@aws-sdk/s3-request-presigner');


const bucketName=process.env.BUCKET_NAME;
const bucketRegion=process.env.BUCKET_REGION;
const accessKey=process.env.ACCESS_KEY;
const secretAccessKey=process.env.SECRET_ACCESS_KEY;

const s3=new S3Client({
    region : bucketRegion,
    credentials : {
        accessKeyId : accessKey,
        secretAccessKey : secretAccessKey
    }
    
});

const memory=multer.memoryStorage();
const upload=multer({memory : memory});

router.get('/', user_jwt, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json({
            success: true,
            user: user
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "error hogya bhai"
        });
        next();
    }

});

//create
router.post('/add', upload.single('Product_Image'), async(req, res, next)=>{
    try {
        const user=req.body.user_id;
        const Name=req.body.Product_Name;
        const Detail=req.body.Product_Detail;
        const Price=req.body.Price;
        let prod = new Product();
        prod.user_id=user;
        prod.Product_Name=Name;
        prod.Product_Detail=Detail;
        prod.Price=Price;
        if(req.file){
            const fileName=`${Date.now()}-${req.file.originalname}`;
            const params = {
                Bucket : bucketName,
                Key : fileName,
                Body : req.file.buffer,
                ContentType : req.file.mimetype
            }
            const command = new PutObjectCommand(params);
            await s3.send(command);
            prod.Image=fileName;
        }
        await prod.save();
        res.status(200).json({
            success : true,
            msg : "Product added"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Failed."
        });
    }
});

//read
router.get('/get/:id', async(req,res,next)=>{
    try {
        const {id} = req.params;
        const product=await Product.find({user_id : id});
        for (const prod of product){
            const getObjectparams={
                Bucket : bucketName,
                Key : prod.Image
            }
            const command=new GetObjectCommand(getObjectparams);
            const url=await getSignedUrl(s3,command);
            prod.ImageUrl=url;
        };
        res.status(200).json({
            success : true,
            product : product
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Failed."
        });
    }
});

//readAll
router.get('/get',async(req,res,next)=>{
    try {
        const{name}=req.query;
        const queryObject={};
        if(name){
            queryObject.Product_Name={$regex : name , $options : "i"};
        }
        const product=await Product.find(queryObject);
        for (const prod of product){
                if(prod.Image){
                const getObjectparams={
                    Bucket : bucketName,
                    Key : prod.Image
                }
                const command=new GetObjectCommand(getObjectparams);
                const url=await getSignedUrl(s3,command);
                prod.ImageUrl=url;
            }
        }
        res.status(200).json({
            success : true,
            product : product
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Failed."
        });
    }
});

//update
router.put('/update/:id',async(req,res,next)=>{
    try {
        const {id}=req.params;
        const product=await Product.findByIdAndUpdate(id, req.body);
        if(!product){
            return res.status(500).json({
                success:false,
                msg : "Product doesn't exist."
                });
        }
        res.status(200).json({
            success : true,
            msg : "Updated"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Failed."
        });
    }
});

//delete
router.put('/delete',async(req,res,next)=>{
    try {
        const {id}=req.body;
        let deleteErrors = [];
        for(const i of id){
            const product= await Product.findByIdAndDelete(i);
            if (!product) {
                deleteErrors.push({ id: i, msg: "Product doesn't exist." });
                continue;  // Skip to the next product
            }
            const params={
                Bucket : bucketName,
                Key : product.Image
            };
            try {
                const command = new DeleteObjectCommand(params);
                await s3.send(command);
            } catch (error) {
                deleteErrors.push({ id: i, msg: `Failed to delete image for product ${i}` });
            }

        }
        if (deleteErrors.length > 0) {
            return res.status(500).json({
                success: false,
                msg: "Some products failed to delete.",
                errors: deleteErrors
            });
        }
        res.status(200).json({
            success : true,
            msg : "Product deleted."
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Failed."
        });
    }
});

router.post('/register', async (req, res, next) => {
    const { username, phone_no, password } = req.body;

    try {
        let user_exist = await User.findOne({ phone_no: phone_no });
        if (user_exist) {
            return res.json({
                success: false,
                msg: "user already exist"
            });
        }

        let user = new User();
        user.username = username;
        user.phone_no = phone_no;

        const salt = await bcryptjs.genSalt(10);
        user.password = await bcryptjs.hash(password, salt);

        let size = 200;
        user.avatar = "https://gravatar.com/avatar/?s=" + size + "&d=retro";

        await user.save();

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(payload, process.env.jwtSecret, {
            expiresIn: 3600000
        },
            (err, token) => {
                if (err) throw err;
                res.status(200).json({
                    success: true,
                    token: token,
                    user: user
                });

            }

        );

    }
    catch (err) {
        console.log(err);
    }
});

router.post('/login', async (req, res, next) => {
    const phone_no = req.body.phone_no;
    const password = req.body.password;


    try {
        let user = await User.findOne({
            phone_no: phone_no
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                msg: "Invalid Phone number , doesn't exist. "
            })
        }

        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                msg: "Invalid password"
            });
        }

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(payload, process.env.jwtSecret, {
            expiresIn: 3600000
        },
            (err, token) => {
                if (err) throw err;
                res.status(200).json({
                    success: true,
                    token: token,
                    user : user
                });

            }

        );

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            msg: "Failed"
        });
    }
})

module.exports = router;
