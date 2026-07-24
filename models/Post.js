const mongoose = require("mongoose");

const postImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true }, // S3 object key, needed to delete later
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    postId: {
      type: String,
      unique: true,
      required: true,
    },

    // References User.userId (the app uses a custom uuid, not the Mongo _id)
    author: {
      type: String,
      required: true,
      index: true,
    },

    body: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    images: {
      type: [postImageSchema],
      default: [],
    },

    likedBy: {
      type: [String], // userIds
      default: [],
    },

      sharedBy: {         
    type: [String],   
    default: [],
  },

    sharesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

// A post needs either text or at least one image
postSchema.pre("validate", function (next) {
  if (!this.body?.trim() && this.images.length === 0) {
    return next(new Error("Post must contain text or at least one image"));
  }
  next();
});

module.exports = mongoose.model("Post", postSchema);