const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    CreateBucketCommand,
    HeadBucketCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const bucketName = process.env.BUCKET_NAME;
const bucketRegion =
    process.env.BUCKET_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    'us-east-1';
const accessKey =
    process.env.ACCESS_KEY ||
    process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
    process.env.SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY;
const s3Endpoint = (process.env.S3_ENDPOINT || '').trim();

const hasCredentials = Boolean(bucketName && accessKey && secretAccessKey);
const usingPlaceholderCreds =
    String(accessKey || '').startsWith('local-dev') ||
    String(accessKey || '') === 'minioadmin' ||
    String(secretAccessKey || '').startsWith('local-dev') ||
    String(secretAccessKey || '') === 'minioadmin';

// Enabled when credentials exist and either a custom endpoint (MinIO) is set
// or real (non-placeholder) AWS credentials are provided.
const s3Configured = hasCredentials && (Boolean(s3Endpoint) || !usingPlaceholderCreds);

const s3 = s3Configured
    ? new S3Client({
        region: bucketRegion,
        credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretAccessKey
        },
        ...(s3Endpoint
            ? {
                endpoint: s3Endpoint,
                forcePathStyle: true
            }
            : {})
    })
    : null;

let bucketReady = false;

async function ensureBucket() {
    if (!s3 || bucketReady) return;
    try {
        await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
        bucketReady = true;
    } catch (error) {
        const status = error?.$metadata?.httpStatusCode;
        // Only auto-create for local MinIO. On AWS, the bucket should already exist.
        if (
            s3Endpoint &&
            (status === 404 || error.name === 'NotFound' || error.Code === 'NoSuchBucket')
        ) {
            await s3.send(
                new CreateBucketCommand({
                    Bucket: bucketName
                })
            );
            bucketReady = true;
            console.log(`Created S3 bucket: ${bucketName}`);
        } else if (status === 301 || status === 403 || status === 404) {
            bucketReady = true;
            if (!s3Endpoint && status === 404) {
                console.log(
                    `S3 bucket "${bucketName}" was not found. Create it in AWS (region ${bucketRegion}) before uploading images.`
                );
            }
        } else {
            throw error;
        }
    }
}

async function attachImageUrls(products) {
    if (!s3) return products;
    await ensureBucket();
    for (const prod of products) {
        if (!prod.Image) continue;
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
            'Image upload is unavailable. Set AWS credentials (ACCESS_KEY / SECRET_ACCESS_KEY) and BUCKET_NAME in config/config.env or environment secrets.'
        );
        err.status = 503;
        throw err;
    }
    await ensureBucket();
    const safeName = String(file.originalname || 'image').replace(/[^\w.\-]+/g, '_');
    const fileName = `${Date.now()}-${safeName}`;
    await s3.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype || 'application/octet-stream'
        })
    );
    return fileName;
}

async function deleteProductImage(key) {
    if (!key || !s3) return;
    try {
        await ensureBucket();
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
    ensureBucket,
    attachImageUrls,
    uploadProductImage,
    deleteProductImage
};
