// const multer = require("multer");
// const path = require("path");
// const { v4: uuidv4 } = require("uuid");

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/profiles/"); // make sure this folder exists
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, `${uuidv4()}${ext}`); // e.g. uuid.jpg
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowed = ["image/jpeg", "image/png", "image/webp"];
//   if (allowed.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error("Only JPEG, PNG, and WEBP images are allowed"), false);
//   }
// };

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
// });

// module.exports = upload;

const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(), // ← buffer only, no disk write
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WEBP images are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;