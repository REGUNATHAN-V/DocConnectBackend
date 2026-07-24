const express = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const s3 = require("../config/s3");
require("dotenv").config();
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = require("../config/s3")

const router = express.Router();

router.get("/get-audio-url", async (req, res) => {
  try {
    const { key } = req.query;

    // const url = await getSignedUrl(
    //   s3Client,
    //   new GetObjectCommand({
    //     Bucket: process.env.AWS_BUCKET_NAME,
    //     Key: key
    //   }),
    //   { expiresIn: 60 } // 1 minute
    // );
    const url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-south-1.amazonaws.com/${s3Data.fileKey}`;

    res.json({ url });
  } catch (err) {
    console.error("GetAudio Error:", err);
    res.status(500).json({ error: "Failed" });
  }
});


module.exports = router;
