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

async function attachImageUrls(products) {
    for (const prod of products) {
        if (!prod.Image || !s3) continue;
        try {
            prod.ImageUrl = await getSignedUrl(
                s3,
                new GetObjectCommand({
                    Bucket: bucketName,
                    Key: prod.Image
                }),
                { expiresIn: 3600 }
            );
        } catch (error) {
            console.log('Signed URL skipped:', error.message);
        }
    }
    return products;
}

async function uploadProductImage(file) {
    if (!s3) {
        const err = new Error(
            'Image upload is unavailable until AWS S3 is configured. List without an image, or add real AWS credentials.'
        );
        err.status = 503;
        throw err;
    }
    const fileName = `${Date.now()}-${file.originalname}`;
    await s3.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype
        })
    );
    return fileName;
}

async function deleteProductImage(key) {
    if (!key || !s3) return;
    try {
        await s3.send(
            new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key
            })
        );
    } catch (error) {
        console.log(`S3 image cleanup failed for ${key}:`, error.message);
    }
}

module.exports = {
    s3Configured,
    attachImageUrls,
    uploadProductImage,
    deleteProductImage
};
