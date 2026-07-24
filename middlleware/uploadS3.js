const multer = require("multer");
const multerS3 = require("multer-s3");
const s3 = require("../config/s3");
require("dotenv").config();

// Log S3 config for debugging
console.log("S3 Config:", s3);
console.log("Bucket Name:", process.env.AWS_BUCKET_NAME);

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: "public-read",
    
    metadata: function (req, file, cb) {
      console.log("Uploading file metadata:");
      console.log("Field Name:", file.fieldname);
      console.log("Original Name:", file.originalname);
      console.log("MIME Type:", file.mimetype);
      cb(null, { fieldName: file.fieldname });
    },

    key: function (req, file, cb) {
      const fileName = Date.now() + "_" + file.originalname;
      console.log("Uploading file key/path:", "uploads/" + fileName);
      cb(null, "uploads/" + fileName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // optional: limit file size to 10MB
  fileFilter: function (req, file, cb) {
    console.log("File Filter Check:");
    console.log("Original Name:", file.originalname);
    console.log("MIME Type:", file.mimetype);
    // accept all files for now
    cb(null, true);
  },
});

console.log("Multer Upload Configured:", upload);

module.exports = upload;
