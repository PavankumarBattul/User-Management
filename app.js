const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');

const app = express();
app.set('view engine', 'ejs'); 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('uploads')); // Serve uploaded files

// Set up file upload with multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

let otpStore = {};

// Connect to MySQL
// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: 'Anil@123',
//   database: 'user_management',
// });

// db.connect(err => {
//   if (err) {
//     console.error('Error connecting to MySQL:', err);
//     return;
//   }
//   console.log('Connected to MySQL');
// });

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./user_management.db', (err) => {
  if (err) {
    console.error('Failed to connect to the SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');

    // Create table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        username TEXT,
        email TEXT UNIQUE,
        password TEXT,
        phone_number TEXT,
        dob TEXT,
        age INTEGER,
        company_name TEXT,
        image_url TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Table "users" is ready.');
      }
    });
  }
});

module.exports = db;



const axios = require('axios');

async function sendOTP(phoneNumber, otp) {
  const apiKey = "valpYdHSTunAwq0W3UPFxt5DXOCb7kVeryN1GBsfQ9jJ26MRco5lSK0k7bXVsZGUhgJeA9tvw1BOoPEu"
  const payload = {
    route: 'otp',               // Use the OTP route
    numbers: Number(phoneNumber),       // Recipient's phone number
    message: Number(otp),               // OTP (must be numeric)
    language: 'english',
    sender_id: 'FSTSMS',        // Replace with your approved sender ID
  };

  console.log("data",payload)

  try {
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=valpYdHSTunAwq0W3UPFxt5DXOCb7kVeryN1GBsfQ9jJ26MRco5lSK0k7bXVsZGUhgJeA9tvw1BOoPEu&route=otp&variables_values=${otp}&flash=0&numbers=${phoneNumber}`
    );
    console.log('OTP sent:', response.data, payload);
    return true;
  } catch (error) {
    console.error('Error sending OTP:', error.response?.data || error.message);
    return false;
  }
}



function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
} 

// Routes
app.get('/', (req, res) => {
  res.render('login'); // This will render the login page as the default
});

// // app.js
// const express = require('express');
// const bodyParser = require('body-parser');
// db = require('./db'); // Import SQLite connection

const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/signup', (req, res) => {
  res.render('signup'); // Render the signup view (signup.ejs)
});
app.post('/signup', upload.single('profile_image'), (req, res) => {
  const { name, email, password,mobile_number, company_name, dob, age } = req.body;
  const profile_image = req.file ? req.file.filename : null;

  // Validate email and password
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/; // Minimum 8 characters, at least one letter and one number
  if (!emailRegex.test(email)) {
    return res.send('Invalid email format.');
  }
  if (!passwordRegex.test(password)) {
    return res.send('Password must be at least 8 characters long, with at least one letter and one number.');
  }

  const currentYear = new Date().getFullYear();
  const birthYear = new Date(dob).getFullYear();
  const calculatedAge = currentYear - birthYear;

  // Save to MySQL
  const query = `INSERT INTO users (name,username, email, password, phone_number, dob, age, company_name, image_url) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

db.run(query, [name, email, email, password, mobile_number, dob, calculatedAge, company_name, profile_image], function(err) {
if (err) {
return res.status(500).send('Error signing up user: ' + err.message);
}
res.redirect('/');
});
  // db.query(
  //   'INSERT INTO users (name, username, email, password,phone_number, company_name, dob, age, profile_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  //   [name, email, email, password,mobile_number, company_name, dob, age, profile_image],
  //   (err) => {
  //     if (err) {
  //       return res.send(err);
  //     }
  //     res.redirect('/');
  //   }
  // );
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = `SELECT * FROM users WHERE email = ? AND password = ?`;

  db.get(query, [email, password], (err, row) => {
    if (err) {
      return res.status(500).send('Error logging in: ' + err.message);
    }
    if (!row) {
      return res.status(401).send('Invalid email or password');
    }

    console.log(row)
    // Get the user's phone number from the database
    const phoneNumber = row.phone_number; // Ensure this field exists in your DB

    // Generate OTP
    const otp = generateOTP();
    otpStore[email] = otp; // Store OTP with the email as the key

    // Send OTP via SMS
    const isSent = sendOTP(phoneNumber, otp);
    if (isSent) {
      res.render('otp', { email });
    } else {
      res.send('Failed to send OTP. Please try again.');
    }
  });
});



app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] === otp) {
    delete otpStore[email]; // Clear OTP after successful verification
    res.render('thankyou', {email });
  } else {
    res.send('Invalid OTP. Please try again.');
  }
});


// Delete account route
app.post('/delete-account', (req, res) => {
  const { email } = req.body;

  const query = `DELETE FROM users WHERE email = ?`;

  db.run(query, [email], function(err) {
    if (err) {
      return res.status(500).send('Error deleting account: ' + err.message);
    }
    if (this.changes === 0) {
      return res.status(404).send('Account not found');
    }
    res.status(200).send('Account deleted successfully');
  });
});



app.get('/thankyou', (req, res) => {
  res.render('thankyou');
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
