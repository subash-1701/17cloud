const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();

app.use(cors());
app.use(express.json());

/* ================= SESSION ================= */
app.use(session({
  secret: process.env.SESSION_SECRET || '17cloud-secret',
  resave: false,
  saveUninitialized: false
}));

/* ================= STATIC ================= */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/trash', express.static(path.join(__dirname, 'trash')));
app.use(express.static('public'));

/* ================= USERS (JSON FILE) ================= */
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'cloud17'
});

db.connect(err => {
  if (err) {
    console.log("MySQL Error:", err);
  } else {
    console.log("✅ MySQL Connected");
  }
});

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

/* ================= PATH HELPERS ================= */
function userUploadPath(user) {
  return path.join(__dirname, 'uploads', user);
}

function userTrashPath(user) {
  return path.join(__dirname, 'trash', user);
}

app.post('/signup', (req, res) => {

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

  // SAFE VALUES
  firstName = (firstName || "").trim();
  lastName  = (lastName || "").trim();
  email     = (email || "").trim();
  phone = phone && phone.trim() !== "" 
  ? phone.trim() 
  : null;
  dob       = (dob || "").trim();
  gender    = (gender || "").trim();

  username  = (username || "").toLowerCase().trim();
  password  = (password || "").trim();

  // DEBUG
  //console.log(req.body);

  db.query(
    'SELECT id FROM signup_users WHERE username=?',
    [username],
    (err, result) => {

      if (err) {
        console.log(err);
        return res.json({
          success:false,
          message:'Database error'
        });
      }

      if (result.length > 0) {
        return res.json({
          success:false,
          message:'Username already exists'
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
        VALUES (?,?,?,?,?,?,?,?)`,

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
            console.log(err2);

            return res.json({
              success:false,
              message:'Insert error'
            });
          }

          res.json({
            success:true
          });

        }

      );

    }

  );

});

/* ================= LOGIN ================= */
app.post('/login', (req, res) => {

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

  username = (username || "").toLowerCase().trim();

  db.query(
    'SELECT * FROM signup_users WHERE username=? AND password=?',
    [username, password],
    (err, result) => {

      if (result.length > 0) {

        req.session.user = username;
        
        db.query(
  'INSERT INTO login_history(username) VALUES(?)',
  [username]
);

        return res.json({
          success:true
        });

      }

      res.json({
        success:false
      });

    }
  );

});

app.get('/check-username/:username', (req, res) => {

  const username = req.params.username.toLowerCase().trim();

  db.query(
    'SELECT id FROM signup_users WHERE username=?',
    [username],
    (err, result) => {

      res.json({
        exists: result.length > 0
      });

    }
  );

});


/* ================= GET USER ================= */
app.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

/* ================= AUTH ================= */
function checkAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

/* ================= STORAGE ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = userUploadPath(req.session.user);
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

/* ================= UPLOAD ================= */
app.post('/upload', checkAuth, upload.single('photo'), (req, res) => {
  res.json({ file: req.file.filename });
});

/* ================= GET FILES ================= */
app.get('/photos', checkAuth, (req, res) => {
  const folder = userUploadPath(req.session.user);
  fs.mkdirSync(folder, { recursive: true });
  res.json(fs.readdirSync(folder));
});

/* ================= DELETE → TRASH ================= */
app.delete('/photo/:name', checkAuth, (req, res) => {
  const user = req.session.user;

  const filePath = path.join(userUploadPath(user), req.params.name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Not found' });
  }

  const trashFolder = userTrashPath(user);
  fs.mkdirSync(trashFolder, { recursive: true });

  const newName = Date.now() + '__' + req.params.name;

  fs.renameSync(filePath, path.join(trashFolder, newName));

  res.json({ message: 'Moved to trash' });
});

/* ================= GET TRASH ================= */
app.get('/trash', checkAuth, (req, res) => {
  const folder = userTrashPath(req.session.user);
  fs.mkdirSync(folder, { recursive: true });
  res.json(fs.readdirSync(folder));
});

/* ================= RESTORE ================= */
app.post('/restore', checkAuth, (req, res) => {
  const user = req.session.user;
  const { name } = req.body;

  const trashPath = path.join(userTrashPath(user), name);

  const original = name.split('__').slice(1).join('__');
  const uploadPath = path.join(userUploadPath(user), original);

  fs.renameSync(trashPath, uploadPath);

  res.json({ message: 'Restored' });
});

/* ================= PERMANENT DELETE ================= */
app.delete('/permanent', checkAuth, (req, res) => {
  const user = req.session.user;
  const { name } = req.body;

  const filePath = path.join(userTrashPath(user), name);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.json({ message: 'Deleted forever' });
});

/* ================= AUTO DELETE (30 DAYS) ================= */
setInterval(() => {
  const base = path.join(__dirname, 'trash');
  if (!fs.existsSync(base)) return;

  fs.readdirSync(base).forEach(user => {
    const userFolder = path.join(base, user);

    fs.readdirSync(userFolder).forEach(file => {
      const timestamp = parseInt(file.split('__')[0]);

      if (Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000) {
        fs.unlinkSync(path.join(userFolder, file));
      }
    });
  });
}, 24 * 60 * 60 * 1000);

/* ================= START ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🚀 Running on port ' + PORT);
});