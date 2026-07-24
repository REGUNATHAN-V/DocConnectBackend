const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const s3Client = require("../config/s3"); // same shared client used in handlers/privateAttachment.js

// Same env var your attachment handler already uses (AWS_BUCKET_NAME, not AWS_S3_BUCKET)
const BUCKET = process.env.AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION || "ap-south-1";

function buildUrl(key) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

/**
 * Resizes an image buffer to a square avatar and uploads it to S3
 * under the "profile-picture" folder - matches the folder-per-type
 * convention your attachment handler uses (image/, video/, document/, etc).
 * Returns { fileUrl, fileKey }.
 */
async function uploadProfilePic(buffer) {
  const resized = await sharp(buffer)
    .resize(400, 400, { fit: "cover" })
    .toFormat("jpeg", { quality: 80 })
    .toBuffer();

  const fileKey = `profile-picture/${Date.now()}_${uuidv4()}.jpg`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
      Body: resized,
      ContentType: "image/jpeg",
    })
  );

  return { fileUrl: buildUrl(fileKey), fileKey };
}

/**
 * Uploads without forcing a square crop - for group pics etc.
 * Defaults to a "group-picture" folder, same naming convention.
 */
async function uploadImage(buffer, folder = "group-picture", maxWidth = 1080) {
  const resized = await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .toFormat("jpeg", { quality: 80 })
    .toBuffer();

  const fileKey = `${folder}/${Date.now()}_${uuidv4()}.jpg`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
      Body: resized,
      ContentType: "image/jpeg",
    })
  );

  return { fileUrl: buildUrl(fileKey), fileKey };
}

async function deleteObject(fileKey) {
  if (!fileKey) return;
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }));
}

module.exports = { uploadProfilePic, uploadImage, deleteObject };