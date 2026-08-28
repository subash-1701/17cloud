#npm init -y

#npm install express cors multer express-session mysql2


CREATE DATABASE IF NOT EXISTS 17cloud;

USE 17cloud;

-- =========================
-- SIGNUP USERS TABLE
-- =========================

CREATE TABLE signup_users (
    id INT AUTO_INCREMENT PRIMARY KEY,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    email VARCHAR(150) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,

    dob DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,

    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- LOGIN HISTORY TABLE
-- =========================

CREATE TABLE login_history (
    id INT AUTO_INCREMENT PRIMARY KEY,

    username VARCHAR(100) NOT NULL,

    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);