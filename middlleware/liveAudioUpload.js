require("dotenv").config();
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = require("../config/s3")


// Upload audio → return ONLY fileKey
// async function uploadVoiceToS3(base64Audio, sender, receiver) {
//   try {
//     const cleanBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, "");
//     const audioBuffer = Buffer.from(cleanBase64, "base64");

//     const fileKey = `${Date.now()}_${sender}_${receiver}.mp4`;

//     const uploadCommand = new PutObjectCommand({
//       Bucket: process.env.AWS_BUCKET_NAME,
//       Key: fileKey,
//       Body: audioBuffer,
//       ContentType: "audio/mp4",
//     });

//     await s3Client.send(uploadCommand);

//     return { fileKey };
//   } catch (error) {
//     console.error("❌ S3 Upload Error:", error);
//     throw error;
//   }
// }


async function uploadVoiceToS3(base64Audio, sender, receiver) {
  console.log("📥 uploadVoiceToS3 called");

  try {
    console.log("➡️ Sender:", sender);
    console.log("➡️ Receiver:", receiver);

    if (!base64Audio) {
      console.error("❌ No base64Audio provided");
      throw new Error("Missing audio data");
    }

    console.log("📏 Original base64 length:", base64Audio.length);

    // Remove base64 prefix
    const cleanBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, "");
    console.log("🧹 Cleaned base64 length:", cleanBase64.length);

    // Convert to buffer
    const audioBuffer = Buffer.from(cleanBase64, "base64");
    console.log("📦 Buffer size (bytes):", audioBuffer.length);

    // Generate file key
    const fileKey = `${Date.now()}_${sender}_${receiver}.opus`;
    console.log("🗂️ Generated fileKey:", fileKey);

    // Log bucket info (safe)
    console.log("🪣 Bucket:", process.env.AWS_BUCKET_NAME);

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      Body: audioBuffer,
      ContentType: "audio/ogg",
    });

    console.log("🚀 Uploading to S3...");

    const response = await s3Client.send(uploadCommand);

    console.log("✅ Upload successful");
    console.log("📄 S3 Response:", response);

    return { fileKey };

  } catch (error) {
    console.error("❌ S3 Upload Error:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    throw error;
  }
}

module.exports = { uploadVoiceToS3 };
