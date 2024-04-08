require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const port = 2024;
const app = express();
const router = require("./src/app/moduls/order/Order.routes")
// const { notFound, errorHandler } = require("./src/middleware/errorMiddleware");

const corsOptions = {
  origin: [
    "http://localhost:3000", // localhost
  ],
  optionsSuccessStatus: 200,
};
// Middleware
const middleware = [
  cors(corsOptions),
  express.json(),
  express.urlencoded({ extended: true }),
];
app.use(middleware);
connectDB();

// Application routes
app.use('/api/v1/orders/', router)

app.get("/", (req, res) => {
  return res.status(200).json({
    message: "Hello Microservice Architecture Design",
    version: "1.0.0",
  });
});

// app.use(notFound);
// app.use(errorHandler);

app.listen(port, () => {
  console.log("Server is running at port ", port);
});
