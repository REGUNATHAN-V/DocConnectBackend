const { v4: uuidv4 } = require("uuid");
const Post = require("../models/Post");
const User = require("../models/User");
const { uploadImage, deleteObject } = require("../services/S3service");
const { broadcastAll } = require("../socket/broadcast");


async function attachAuthors(posts, viewerUserId) {
  const authorIds = [...new Set(posts.map((p) => p.author))];
  const authors = await User.find({ userId: { $in: authorIds } }).select(
    "userId name role profilePic"
  );
  const authorMap = new Map(authors.map((a) => [a.userId, a]));

  return posts.map((p) => {
    const author = authorMap.get(p.author);
    return {
      id: p.postId,
      body: p.body,
      images: p.images.map((img) => img.url),
      likesCount: p.likedBy.length,
      likedByMe: viewerUserId ? p.likedBy.includes(viewerUserId) : false,
      sharesCount: p.sharesCount,
      createdAt: p.createdAt,
      author: author
        ? {
            userId: author.userId,
            name: author.name,
            role: author.role,
            profilePic: author.profilePic,
          }
        : { userId: p.author, name: "Unknown user", role: "", profilePic: "" },
    };
  });
}


exports.createPost = async (req, res) => {
  try {
    const { userId } = req.user;
    const body = (req.body.body || "").trim();
    const files = req.files || [];

    if (!body && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Write something or attach at least one image",
      });
    }

    let uploadedImages = [];
    if (files.length > 0) {
      try {
        uploadedImages = await Promise.all(
          files.map(async (file) => {
            const result = await uploadImage(file.buffer, "posts");
            return { url: result.fileUrl, key: result.fileKey };
          })
        );
      } catch (uploadError) {
        console.error("Post image upload error:", uploadError);
        return res.status(500).json({ success: false, message: "Image upload failed" });
      }
    }

    const post = await Post.create({
      postId: uuidv4(),
      author: userId,
      body,
      images: uploadedImages,
    });

    const [formatted] = await attachAuthors([post], userId);

    broadcastAll({ type: "new_post", post: formatted });

    res.status(201).json({ success: true, message: "Post created", post: formatted });
  } catch (error) {
    console.error("createPost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getFeed = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 20);
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasNext = posts.length > limit;
    const pagePosts = posts.slice(0, limit);

    const viewerUserId = req.user?.userId;
    const formatted = await attachAuthors(pagePosts, viewerUserId);

    res.status(200).json({
      success: true,
      posts: formatted,
      page,
      limit,
      hasNext,
      hasPrevious: page > 1,
      hasMore: hasNext, 
    });
  } catch (error) {
    console.error("getFeed error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.toggleLike = async (req, res) => {
  try {
    const { userId } = req.user;
    const { postId } = req.params;

    const post = await Post.findOne({ postId });
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const alreadyLiked = post.likedBy.includes(userId);
    if (alreadyLiked) {
      post.likedBy = post.likedBy.filter((id) => id !== userId);
    } else {
      post.likedBy.push(userId);
    }
    await post.save();

    broadcastAll({
      type: "post_like_updated",
      postId,
      likesCount: post.likedBy.length,
    });

    res.status(200).json({
      success: true,
      likesCount: post.likedBy.length,
      likedByMe: !alreadyLiked,
    });
  } catch (error) {
    console.error("toggleLike error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.incrementShareCount = async (req, res) => {
  try {
    const { userId } = req.user;
    const { postId } = req.params;
 
    const post = await Post.findOneAndUpdate(
      { postId },
      {
        $inc: { sharesCount: 1 },
        $addToSet: { sharedBy: userId }, 
      },
      { new: true }
    );
 
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
 
    broadcastAll({
      type: "post_share_updated",
      postId,
      sharesCount: post.sharesCount,
    });
 
    res.status(200).json({
      success: true,
      sharesCount: post.sharesCount,
      sharedByMe: true,
    });
  } catch (error) {
    console.error("incrementShareCount error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.deletePost = async (req, res) => {
  try {
    const { userId } = req.user;
    const { postId } = req.params;

    const post = await Post.findOne({ postId });
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    if (post.author !== userId) {
      return res.status(403).json({ success: false, message: "Not your post" });
    }

    await Promise.all(
      post.images.map((img) => deleteObject(img.key).catch((err) => console.error(err)))
    );
    await post.deleteOne();

    broadcastAll({ type: "post_deleted", postId });

    res.status(200).json({ success: true, message: "Post deleted" });
  } catch (error) {
    console.error("deletePost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};