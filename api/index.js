const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const mysql = require("mysql2");

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

/* ================= SESSION ================= */

app.use(
  session({
    secret: process.env.SESSION_SECRET || "17cloud-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "none"
    }
  })
);

/* ================= STATIC ================= */

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

app.use(
  "/trash",
  express.static(path.join(__dirname, "trash"))
);

app.use(express.static(path.join(__dirname, "public")));

/* ================= MYSQL ================= */

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ MySQL connection error:", err.message);
  } else {
    console.log("✅ MySQL connection successful");
    connection.release();
  }
});

/* ================= HOME ================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "17Cloud API is running"
  });
});

/* ================= SIGNUP ================= */

app.post("/signup", (req, res) => {
  let {
    firstName,
    lastName,
    email,
    phone,
    dob,
    gender,
    username,
    password
  } = req.body;

  firstName = (firstName || "").trim();
  lastName = (lastName || "").trim();
  email = (email || "").trim();

  phone =
    phone && phone.trim() !== ""
      ? phone.trim()
      : null;

  dob = (dob || "").trim();
  gender = (gender || "").trim();

  username = (username || "").toLowerCase().trim();
  password = (password || "").trim();

  if (!username || !password || !email) {
    return res.json({
      success: false,
      message: "Required fields are missing"
    });
  }

  db.query(
    "SELECT id FROM signup_users WHERE username = ?",
    [username],
    (err, result) => {
      if (err) {
        console.error("Signup SELECT error:", err);

        return res.status(500).json({
          success: false,
          message: "Database error"
        });
      }

      if (result.length > 0) {
        return res.json({
          success: false,
          message: "Username already exists"
        });
      }

      db.query(
        `INSERT INTO signup_users
        (
          first_name,
          last_name,
          email,
          phone,
          dob,
          gender,
          username,
          password
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          firstName,
          lastName,
          email,
          phone,
          dob,
          gender,
          username,
          password
        ],
        (err2) => {
          if (err2) {
            console.error("Signup INSERT error:", err2);

            return res.status(500).json({
              success: false,
              message: "Insert error"
            });
          }

          return res.json({
            success: true
          });
        }
      );
    }
  );
});

/* ================= LOGIN ================= */

app.post("/login", (req, res) => {
  let { username, password } = req.body;

  username = (username || "").toLowerCase().trim();
  password = (password || "").trim();

  if (!username || !password) {
    return res.json({
      success: false,
      message: "Username and password required"
    });
  }

  db.query(
    "SELECT * FROM signup_users WHERE username = ? AND password = ?",
    [username, password],
    (err, result) => {
      if (err) {
        console.error("Login error:", err);

        return res.status(500).json({
          success: false,
          message: "Database error"
        });
      }

      if (result.length === 0) {
        return res.json({
          success: false
        });
      }

      req.session.user = username;

      db.query(
        "INSERT INTO login_history(username) VALUES(?)",
        [username],
        (historyErr) => {
          if (historyErr) {
            console.error("Login history error:", historyErr);
          }
        }
      );

      return res.json({
        success: true
      });
    }
  );
});

/* ================= CHECK USERNAME ================= */

app.get("/check-username/:username", (req, res) => {
  const username = (req.params.username || "")
    .toLowerCase()
    .trim();

  db.query(
    "SELECT id FROM signup_users WHERE username = ?",
    [username],
    (err, result) => {
      if (err) {
        console.error("Username check error:", err);

        return res.status(500).json({
          exists: false,
          message: "Database error"
        });
      }

      return res.json({
        exists: result.length > 0
      });
    }
  );
});

/* ================= CURRENT USER ================= */

app.get("/me", (req, res) => {
  res.json({
    user: req.session.user || null
  });
});

/* ================= AUTH ================= */

function checkAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }

  next();
}

/* ================= STORAGE ================= */

function userUploadPath(user) {
  return path.join(__dirname, "uploads", user);
}

function userTrashPath(user) {
  return path.join(__dirname, "trash", user);
}

/* ================= MULTER ================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const folder = userUploadPath(req.session.user);

      fs.mkdirSync(folder, {
        recursive: true
      });

      cb(null, folder);
    } catch (error) {
      cb(error);
    }
  },

  filename: (req, file, cb) => {
    const safeName = path.basename(file.originalname);

    cb(
      null,
      Date.now() + "-" + safeName
    );
  }
});

const upload = multer({
  storage
});

/* ================= UPLOAD ================= */

app.post(
  "/upload",
  checkAuth,
  upload.single("photo"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded"
      });
    }

    return res.json({
      success: true,
      file: req.file.filename
    });
  }
);

/* ================= GET FILES ================= */

app.get("/photos", checkAuth, (req, res) => {
  try {
    const folder = userUploadPath(
      req.session.user
    );

    fs.mkdirSync(folder, {
      recursive: true
    });

    const files = fs.readdirSync(folder);

    return res.json(files);
  } catch (error) {
    console.error("Photos error:", error);

    return res.status(500).json({
      message: "Unable to read photos"
    });
  }
});

/* ================= DELETE → TRASH ================= */

app.delete(
  "/photo/:name",
  checkAuth,
  (req, res) => {
    try {
      const user = req.session.user;
      const fileName = path.basename(
        req.params.name
      );

      const filePath = path.join(
        userUploadPath(user),
        fileName
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message: "Not found"
        });
      }

      const trashFolder = userTrashPath(user);

      fs.mkdirSync(trashFolder, {
        recursive: true
      });

      const newName =
        Date.now() + "__" + fileName;

      fs.renameSync(
        filePath,
        path.join(trashFolder, newName)
      );

      return res.json({
        message: "Moved to trash"
      });
    } catch (error) {
      console.error("Move to trash error:", error);

      return res.status(500).json({
        message: "Unable to move file"
      });
    }
  }
);

/* ================= GET TRASH ================= */

app.get("/trash", checkAuth, (req, res) => {
  try {
    const folder = userTrashPath(
      req.session.user
    );

    fs.mkdirSync(folder, {
      recursive: true
    });

    const files = fs.readdirSync(folder);

    return res.json(files);
  } catch (error) {
    console.error("Trash error:", error);

    return res.status(500).json({
      message: "Unable to read trash"
    });
  }
});

/* ================= RESTORE ================= */

app.post("/restore", checkAuth, (req, res) => {
  try {
    const user = req.session.user;
    const name = path.basename(
      req.body.name || ""
    );

    if (!name) {
      return res.status(400).json({
        message: "File name required"
      });
    }

    const trashPath = path.join(
      userTrashPath(user),
      name
    );

    if (!fs.existsSync(trashPath)) {
      return res.status(404).json({
        message: "File not found"
      });
    }

    const original = name
      .split("__")
      .slice(1)
      .join("__");

    const uploadFolder =
      userUploadPath(user);

    fs.mkdirSync(uploadFolder, {
      recursive: true
    });

    const uploadPath = path.join(
      uploadFolder,
      original
    );

    fs.renameSync(
      trashPath,
      uploadPath
    );

    return res.json({
      message: "Restored"
    });
  } catch (error) {
    console.error("Restore error:", error);

    return res.status(500).json({
      message: "Unable to restore file"
    });
  }
});

/* ================= PERMANENT DELETE ================= */

app.delete(
  "/permanent",
  checkAuth,
  (req, res) => {
    try {
      const user = req.session.user;
      const name = path.basename(
        req.body.name || ""
      );

      if (!name) {
        return res.status(400).json({
          message: "File name required"
        });
      }

      const filePath = path.join(
        userTrashPath(user),
        name
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return res.json({
        message: "Deleted forever"
      });
    } catch (error) {
      console.error(
        "Permanent delete error:",
        error
      );

      return res.status(500).json({
        message: "Unable to delete file"
      });
    }
  }
);

/* ================= START ================= */

/*
  IMPORTANT:
  Do NOT use app.listen() on Vercel.

  Vercel will start the Express application.
*/

module.exports = app;
