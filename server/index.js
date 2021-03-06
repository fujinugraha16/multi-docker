import redis from "redis";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pkg from "pg";

import keys from "./keys.js";

const { Pool } = pkg;

// Express App Setup
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});
pgClient.on("error", () => console.log("lost PG connection ..."));

pgClient
  .query("CREATE TABLE IF NOT EXISTS values (number INT)")
  .catch((err) => console.log(err));

// Redis Client Setup
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});

const redisPublisher = redisClient.duplicate();

// Express rouete handlers
app.get("/", (req, res) => {
  res.send("Hi :)");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * FROM values");

  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  redisClient.hgetall("values", (err, values) => {
    res.send(values);
  });
});

app.post("/values", async (req, res) => {
  const { index } = req.body;

  if (+index > 40) {
    return res.status(422).send("Index too high");
  }

  redisClient.hset("values", index, "Nothing yet!");
  redisPublisher.publish("insert", index);
  pgClient.query("INSERT INTO values(number) VALUES($1)", [+index]);

  res.send({ working: true });
});

// App Listening
app.listen(5000, () => console.log("server listening ..."));
