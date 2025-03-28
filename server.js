import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import session from "express-session";
import bcrypt from 'bcrypt';

const port = 3000;
const host = "localhost";
const dbHost = "localhost";
const dbName = "feedback_support";
const dbUser = "root";
const dbPwd = "";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use("/includes", express.static(path.join(__dirname, "includes")));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect("/login");
  }
}


function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.admin) {
    return next();
  } else {
    res.redirect("/login");
  }
}

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.get("/", (req, res) => {
  res.redirect("/customer-users");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { identifier, password } = req.body;
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPwd,
      database: dbName,
    });

    console.log("Login attempt with identifier:", identifier);

    const [rows] = await connection.execute(
      "SELECT * FROM system_user WHERE id = ? OR email = ?",
      [identifier, identifier]
    );

    if (rows.length > 0) {
      const user = rows[0];
      console.log("User found:", user);

      if (!user.password) {
        console.error("Password is NULL for user:", user.email);
        return res.render("login", {
          error: "Virheelliset tunnistetiedot tai ei järjestelmänvalvoja",
        });
      }

      const match = await bcrypt.compare(password, user.password);
      console.log("Password match:", match);

      if (match && user.admin) {
        console.log("Login successful for user:", user.email);
        req.session.user = user;
        res.redirect("/customer-users");
      } else {
        console.log("Login failed: Invalid credentials or not an admin.");
        res.render("login", {
          error: "Virheelliset tunnistetiedot tai ei järjestelmänvalvoja",
        });
      }
    } else {
      console.log("No user found with identifier:", identifier);
      res.render("login", {
        error: "Virheelliset tunnistetiedot tai ei järjestelmänvalvoja",
      });
    }
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) await connection.end();
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

app.get("/customer-users", isAuthenticated, isAdmin, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPwd,
      database: dbName,
    });

    console.log("Database connection established");

    const [customers] = await connection.execute("SELECT id, name FROM customer");
    console.log("Customer fetched:", customers);

    const [users] = await connection.execute("SELECT id, fullname, email, mailing_list, customer_id, admin FROM system_user");
    console.log("Users fetched:", users);

    res.render("customers-users", {
      user: req.session.user,
      customers: customers,
      users: users,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) await connection.end();
  }
});

async function createDatabaseIfNotExists() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPwd,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.changeUser({ database: dbName });

    // Create customer table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      );
    `);
  } catch (err) {
    console.error("Database creation error:", err);
  } finally {
    if (connection) await connection.end();
  }
}

createDatabaseIfNotExists().then(() => {
  app.listen(port, host, () => console.log(`${host}:${port} kuuntelee...`));
});