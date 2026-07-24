// const { v4: uuidv4 } = require("uuid");
// const Post = require("../models/Post");
// const User = require("../models/User");
// const { uploadImage, deleteObject } = require("../services/S3service");
// const { broadcastAll } = require("../socket/broadcast");

// // Turns a list of Post docs into the shape the app's feed UI expects,
// // embedding a lightweight author snapshot instead of making the client
// // do a second round trip per post.
// async function attachAuthors(posts, viewerUserId) {
//   const authorIds = [...new Set(posts.map((p) => p.author))];
//   const authors = await User.find({ userId: { $in: authorIds } }).select(
//     "userId name role profilePic"
//   );
//   const authorMap = new Map(authors.map((a) => [a.userId, a]));

//   return posts.map((p) => {
//     const author = authorMap.get(p.author);
//     return {
//       id: p.postId,
//       body: p.body,
//       images: p.images.map((img) => img.url),
//       likesCount: p.likedBy.length,
//       likedByMe: viewerUserId ? p.likedBy.includes(viewerUserId) : false,
//       sharesCount: p.sharesCount,
//       createdAt: p.createdAt,
//       author: author
//         ? {
//             userId: author.userId,
//             name: author.name,
//             role: author.role,
//             profilePic: author.profilePic,
//           }
//         : { userId: p.author, name: "Unknown user", role: "", profilePic: "" },
//     };
//   });
// }

// // ─────────────────────────────────────────
// // Create a post (text + up to 6 images)
// // POST /post/create
// // Headers: Authorization: Bearer <token>
// // Body (multipart/form-data): body (text), images (file[])
// // ─────────────────────────────────────────
// exports.createPost = async (req, res) => {
//   try {
//     const { userId } = req.user;
//     const body = (req.body.body || "").trim();
//     const files = req.files || [];

//     if (!body && files.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Write something or attach at least one image",
//       });
//     }

//     let uploadedImages = [];
//     if (files.length > 0) {
//       try {
//         uploadedImages = await Promise.all(
//           files.map(async (file) => {
//             const result = await uploadImage(file.buffer, "posts");
//             return { url: result.fileUrl, key: result.fileKey };
//           })
//         );
//       } catch (uploadError) {
//         console.error("Post image upload error:", uploadError);
//         return res.status(500).json({ success: false, message: "Image upload failed" });
//       }
//     }

//     const post = await Post.create({
//       postId: uuidv4(),
//       author: userId,
//       body,
//       images: uploadedImages,
//     });

//     const [formatted] = await attachAuthors([post], userId);

//     // Let anyone currently online see the new post land in real time.
//     broadcastAll({ type: "new_post", post: formatted });

//     res.status(201).json({ success: true, message: "Post created", post: formatted });
//   } catch (error) {
//     console.error("createPost error:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ─────────────────────────────────────────
// // Paginated feed
// // GET /post/feed?page=1&limit=5
// // ─────────────────────────────────────────
// exports.getFeed = async (req, res) => {
//   try {
//     const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
//     const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
//     const skip = (page - 1) * limit;

//     const [posts, total] = await Promise.all([
//       Post.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
//       Post.countDocuments(),
//     ]);

//     const viewerUserId = req.user?.userId;
//     const formatted = await attachAuthors(posts, viewerUserId);

//     res.status(200).json({
//       success: true,
//       posts: formatted,
//       page,
//       limit,
//       total,
//       hasMore: skip + posts.length < total,
//     });
//   } catch (error) {
//     console.error("getFeed error:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ─────────────────────────────────────────
// // Toggle like on a post
// // POST /post/:postId/like
// // ─────────────────────────────────────────
// exports.toggleLike = async (req, res) => {
//   try {
//     const { userId } = req.user;
//     const { postId } = req.params;

//     const post = await Post.findOne({ postId });
//     if (!post) {
//       return res.status(404).json({ success: false, message: "Post not found" });
//     }

//     const alreadyLiked = post.likedBy.includes(userId);
//     if (alreadyLiked) {
//       post.likedBy = post.likedBy.filter((id) => id !== userId);
//     } else {
//       post.likedBy.push(userId);
//     }
//     await post.save();

//     broadcastAll({
//       type: "post_like_updated",
//       postId,
//       likesCount: post.likedBy.length,
//     });

//     res.status(200).json({
//       success: true,
//       likesCount: post.likedBy.length,
//       likedByMe: !alreadyLiked,
//     });
//   } catch (error) {
//     console.error("toggleLike error:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ─────────────────────────────────────────
// // Delete a post (author only) — cleans up S3 objects too
// // DELETE /post/:postId
// // ─────────────────────────────────────────
// exports.deletePost = async (req, res) => {
//   try {
//     const { userId } = req.user;
//     const { postId } = req.params;

//     const post = await Post.findOne({ postId });
//     if (!post) {
//       return res.status(404).json({ success: false, message: "Post not found" });
//     }
//     if (post.author !== userId) {
//       return res.status(403).json({ success: false, message: "Not your post" });
//     }

//     await Promise.all(
//       post.images.map((img) => deleteObject(img.key).catch((err) => console.error(err)))
//     );
//     await post.deleteOne();

//     broadcastAll({ type: "post_deleted", postId });

//     res.status(200).json({ success: true, message: "Post deleted" });
//   } catch (error) {
//     console.error("deletePost error:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };




const { v4: uuidv4 } = require("uuid");
const Post = require("../models/Post");
const User = require("../models/User");
const { uploadImage, deleteObject } = require("../services/S3service");
const { broadcastAll } = require("../socket/broadcast");

// Turns a list of Post docs into the shape the app's feed UI expects,
// embedding a lightweight author snapshot instead of making the client
// do a second round trip per post.
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

// ─────────────────────────────────────────
// Create a post (text + up to 6 images)
// POST /post/create
// Headers: Authorization: Bearer <token>
// Body (multipart/form-data): body (text), images (file[])
// ─────────────────────────────────────────
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

    // Let anyone currently online see the new post land in real time.
    broadcastAll({ type: "new_post", post: formatted });

    res.status(201).json({ success: true, message: "Post created", post: formatted });
  } catch (error) {
    console.error("createPost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────
// Paginated feed
// GET /post/feed?page=1&limit=10
//
// Pagination strategy: instead of a separate countDocuments() call to
// figure out hasNext/hasPrevious, we ask Mongo for one MORE document than
// the page size (limit + 1).
//   - If we get back <= limit docs        -> this is the last page (hasNext=false)
//   - If we get back exactly limit+1 docs -> there's at least one more page
//     (hasNext=true); we trim the extra doc off before sending the response.
// e.g. limit=10: fetch 11. If the 11th doc exists, hasNext=true; we only
// return the first 10 to the client either way.
// This avoids a second query and stays correct even if posts are being
// created/deleted between page loads (unlike a stale total count).
// ─────────────────────────────────────────
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
      hasMore: hasNext, // kept alongside hasNext so existing client code (`data?.hasMore`) keeps working
    });
  } catch (error) {
    console.error("getFeed error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────
// Toggle like on a post
// POST /post/:postId/like
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// Delete a post (author only) — cleans up S3 objects too
// DELETE /post/:postId
// ─────────────────────────────────────────
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