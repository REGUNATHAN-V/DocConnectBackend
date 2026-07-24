const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASS || "",
  database: process.env.MYSQL_DB || "vsolv_chatapp",
  waitForConnections: true,
  connectionLimit: 20,
});

// -------------------------
// All table definitions
// -------------------------

const TABLES = [
  {
    name: "users_metadata",
    query: `
      CREATE TABLE IF NOT EXISTS users_metadata (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) UNIQUE,
        connected BOOLEAN DEFAULT FALSE,
        timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000)
      );
    `,
  },

  // {
  //   name: "live_user_connection",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS live_user_connection (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       code VARCHAR(50) UNIQUE,
  //       connected BOOLEAN DEFAULT FALSE,
  //       lastActive BIGINT,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000)
  //     );
  //   `,
  // },

  // {
  //   name: "private_chat",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS privatechat (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       sender VARCHAR(50),
  //       receiver VARCHAR(50),
  //       senderName VARCHAR(255),
  //       receiverName VARCHAR(255),
  //       message TEXT,
  //       messageType VARCHAR(50) DEFAULT 'chat',
  //       audioUrl TEXT,
  //       duration INT DEFAULT 0,
  //       status VARCHAR(50) DEFAULT 'sent',
  //       deliveredAt BIGINT NULL,
  //       seenAt BIGINT NULL,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000)
  //     );
  //   `,
  // },

  // {
  //   name: "pending_delivery",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS pending_delivery (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       sender VARCHAR(50),
  //       receiver VARCHAR(50),
  //       groupId VARCHAR(50) NULL,
  //       deliveredBy VARCHAR(50) NULL,
  //       messageId BIGINT,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000)
  //     );
  //   `,
  // },

  // {
  //   name: "pending_private_seen",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS pending_private_seen (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       sender VARCHAR(50),
  //       receiver VARCHAR(50),
  //       messageIds TEXT,
  //       count INT DEFAULT 0,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000)
  //     );
  //   `,
  // },

  // // groups
  // {
  //   name: "groups",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS \`groups\` (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       groupId VARCHAR(100) NOT NULL UNIQUE,
  //       name VARCHAR(255) NOT NULL,
  //       admin VARCHAR(50),
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000)
  //     );
  //   `,
  // },

  // {
  //   name: "group_members",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS group_members (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       groupId VARCHAR(100) NOT NULL,
  //       member VARCHAR(50) NOT NULL,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000),
  //       FOREIGN KEY (groupId) REFERENCES \`groups\`(groupId)
  //       ON DELETE CASCADE
  //     );
  //   `,
  // },

  // // group chats
  // {
  //   name: "group_chats",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS group_chats (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       groupId VARCHAR(100) NOT NULL,
  //       sender VARCHAR(50) NOT NULL,
  //       senderName VARCHAR(255) NOT NULL,
  //       message TEXT,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000),
  //       audioUrl TEXT,
  //       duration INT,
  //       messageType VARCHAR(50),
  //       status ENUM('sent','delivered','seen','pending') DEFAULT 'sent'
  //     );
  //   `
  // },

  // {
  //   name: "delivered_to",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS delivered_to (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       messageId BIGINT NOT NULL,
  //       user VARCHAR(50) NOT NULL,
  //       deliveredAt BIGINT NOT NULL,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000),
  //       FOREIGN KEY (messageId) REFERENCES group_chats(id) ON DELETE CASCADE
  //     );
  //   `
  // },

  // {
  //   name: "seen_by",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS seen_by (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       messageId BIGINT NOT NULL,
  //       user VARCHAR(50) NOT NULL,
  //       seenAt BIGINT NOT NULL,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000),
  //       FOREIGN KEY (messageId) REFERENCES group_chats(id) ON DELETE CASCADE
  //     );
  //   `
  // },

  // // pending group seen
  // {
  //   name: "pending_group_seen",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS pending_group_seen (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       sender VARCHAR(50),
  //       groupId VARCHAR(100),
  //       seenBy VARCHAR(50),
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000)
  //     );
  //   `
  // },

  // {
  //   name: "pending_group_seen_messages",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS pending_group_seen_messages (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       pendingId BIGINT NOT NULL,
  //       messageId VARCHAR(255) NOT NULL,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000),
  //       FOREIGN KEY (pendingId) REFERENCES pending_group_seen(id) ON DELETE CASCADE
  //     );
  //   `
  // },

  // // FCM TOKENS
  // {
  //   name: "push_notification_tokens",
  //   query: `
  //     CREATE TABLE IF NOT EXISTS push_notification_tokens (
  //       id BIGINT AUTO_INCREMENT PRIMARY KEY,
  //       userId VARCHAR(100) NOT NULL,
  //       token  VARCHAR(500) NOT NULL,
  //       timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000),
  //       deviceId VARCHAR(200),
  //       deviceName VARCHAR(200),
  //       location VARCHAR(200),
  //       UNIQUE KEY unique_user_token (userId, token)
  //     );
  //   `
  // },

  // new

    {
      name: "code_connected",
      query: `
        CREATE TABLE IF NOT EXISTS code_connected (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(255) UNIQUE NOT NULL,
        connected BOOLEAN DEFAULT FALSE,
        lastActive DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_connected (connected)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    },
  
    {
      name: "chats",
      query: `
        CREATE TABLE IF NOT EXISTS chats (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        sender VARCHAR(255) NOT NULL,
        receiver VARCHAR(255) NOT NULL,
        senderName VARCHAR(255),
        receiverName VARCHAR(255),
        message TEXT,
        audioId VARCHAR(500),
        duration INT,
        timestamp DATETIME NOT NULL,
        status ENUM('sent', 'delivered', 'seen') DEFAULT 'sent',
        deliveredAt DATETIME,
        seenAt DATETIME,
        messageType ENUM('chat', 'voice') DEFAULT 'chat',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sender (sender),
        INDEX idx_receiver (receiver),
        INDEX idx_status (status),
        INDEX idx_timestamp (timestamp),
        INDEX idx_sender_receiver (sender, receiver)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    },
  
    {
      name: "groups",
      query: `
       CREATE TABLE IF NOT EXISTS \`groups\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      groupId VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      adminName VARCHAR(255),
      members TEXT NOT NULL,
      admin VARCHAR(255) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_groupId (groupId),
      INDEX idx_admin (admin)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    },
  
    {
      name: "group_chats",
      query: `
       CREATE TABLE IF NOT EXISTS group_chats (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      groupId VARCHAR(255) NOT NULL,
      sender VARCHAR(255) NOT NULL,
      senderName VARCHAR(255),
      message TEXT,
      audioId VARCHAR(500),
      duration INT,
      timestamp DATETIME NOT NULL,
      status ENUM('sent', 'pending', 'delivered', 'seen') DEFAULT 'sent',
      deliveredAt DATETIME,
      seenAt DATETIME,
      messageType ENUM('chat', 'voice') DEFAULT 'chat',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_groupId (groupId),
      INDEX idx_sender (sender),
      INDEX idx_status (status),
      INDEX idx_timestamp (timestamp),
      FOREIGN KEY (groupId) REFERENCES \`groups\`(groupId) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    },
  
    {
      name: "group_chat_delivered",
      query: `
       CREATE TABLE IF NOT EXISTS group_chat_delivered (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    messageId BIGINT NOT NULL,
    user VARCHAR(255) NOT NULL,
    timestamp DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messageId (messageId),
    INDEX idx_user (user),
    INDEX idx_messageId_user (messageId, user),
    FOREIGN KEY (messageId) REFERENCES group_chats(id) ON DELETE CASCADE,
    UNIQUE KEY unique_delivery (messageId, user)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    },
  
    {
      name: "group_chat_seen",
      query: `
     CREATE TABLE IF NOT EXISTS group_chat_seen (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    messageId BIGINT NOT NULL,
    user VARCHAR(255) NOT NULL,
    timestamp DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messageId (messageId),
    INDEX idx_user (user),
    INDEX idx_messageId_user (messageId, user),
    FOREIGN KEY (messageId) REFERENCES group_chats(id) ON DELETE CASCADE,
    UNIQUE KEY unique_seen (messageId, user)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    },
  
    {
      name: "pending_delivery",
      query: `
     CREATE TABLE IF NOT EXISTS pending_delivery (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      sender VARCHAR(255) NOT NULL,
      receiver VARCHAR(255),
      groupId VARCHAR(255),
      deliveredBy VARCHAR(255),
      messageId BIGINT NOT NULL,
      timestamp DATETIME NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sender (sender),
      INDEX idx_receiver (receiver),
      INDEX idx_groupId (groupId),
      INDEX idx_messageId (messageId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `,
    },
  
    {
      name: "pending_seen",
      query: `
  CREATE TABLE IF NOT EXISTS pending_seen (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender VARCHAR(255) NOT NULL,
    receiver VARCHAR(255) NOT NULL,
    messageIds TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sender (sender),
    INDEX idx_receiver (receiver)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    },
  
    {
      name: "pending_group_seen",
      query: `
  CREATE TABLE IF NOT EXISTS pending_group_seen (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender VARCHAR(255) NOT NULL,
    groupId VARCHAR(255) NOT NULL,
    seenBy VARCHAR(255) NOT NULL,
    messageIds TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sender (sender),
    INDEX idx_groupId (groupId),
    INDEX idx_seenBy (seenBy)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    },
  
    {
      name: "pending_group_notification",
      query: `
        CREATE TABLE IF NOT EXISTS pending_group_notification (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          receiverCode VARCHAR(255) NOT NULL,
          payload JSON NOT NULL,
          delivered TINYINT(1) DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_receiverCode (receiverCode),
          INDEX idx_delivered (delivered)
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci;
      `,
    },

    {
      name: "fcm_tokens",
      query: `
        CREATE TABLE IF NOT EXISTS fcm_tokens(
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      userId VARCHAR(100) NOT NULL,
      token  VARCHAR(500) NOT NULL,
      timestamp BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000),
      deviceId VARCHAR(200),
      deviceName VARCHAR(200),
      location VARCHAR(200),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_token (userId, token)
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci;
      `,
    }

    
    

];


// -------------------------
// TABLE INITIALIZER
// -------------------------

async function checkAndCreateTables() {
  const connection = await pool.getConnection();

  try {
    console.log("🔍 Checking MySQL tables...");

    for (const table of TABLES) {
      console.log(`➡ Creating table if missing: ${table.name}`);
      await connection.query(table.query);
    }

    console.log("✅ All MySQL tables verified/created successfully.");
  } catch (err) {
    console.error("❌ Error creating MySQL tables:", err);
  } finally {
    connection.release();
  }
}

module.exports = { pool, checkAndCreateTables };
