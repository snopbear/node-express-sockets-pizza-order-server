const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 9090;

const pizzasFilePath = path.join(__dirname, "data", "pizzas.json");
const pizzaOrdersFilePath = path.join(__dirname, "data", "pizzaOrders.json");

// CORS setup for Express
app.use(
  cors({
    origin: "https://snopbear.github.io", // GitHub Pages URL
    methods: ["GET", "POST"],
  })
);

// Create HTTP server and wrap it with Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://snopbear.github.io", // GitHub Pages URL
    methods: ["GET", "POST"],
  },
});

// Pizza namespace for socket connections
io.of("/pizza").on("connection", (socket) => {
  console.log("New client connected to /pizza namespace");

  // Send pizza list to client
  fs.readFile(pizzasFilePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading pizzas.json:", err);
      return;
    }
    const pizzas = JSON.parse(data);
    socket.emit("pizzaList", pizzas);
  });

  // Send pizza orders count to client
  fs.readFile(pizzaOrdersFilePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading pizzaOrders.json:", err);
      return;
    }
    const pizzaOrders = JSON.parse(data);
    const ordersCount = pizzaOrders.reduce((acc, order) => {
      acc[order.pizzaName] = (acc[order.pizzaName] || 0) + 1;
      return acc;
    }, {});

    const ordersCountArray = Object.keys(ordersCount).map((pizzaName) => ({
      _id: pizzaName,
      count: ordersCount[pizzaName],
    }));

    socket.join("orders");
    socket.emit("pizzaOrdersCount", ordersCountArray);
  });

  // Handle new pizza orders from client
  socket.on("newPizzaOrder", (order) => {
    socket.join("orders");

    // Read existing orders
    fs.readFile(pizzaOrdersFilePath, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading pizzaOrders.json:", err);
        return;
      }
      const pizzaOrders = JSON.parse(data);
      pizzaOrders.push(order);

      // Write updated orders back to file
      fs.writeFile(
        pizzaOrdersFilePath,
        JSON.stringify(pizzaOrders, null, 2),
        (err) => {
          if (err) {
            console.error("Error writing to pizzaOrders.json:", err);
            return;
          }

          // Send updated orders count to all clients in "orders" room
          const ordersCount = pizzaOrders.reduce((acc, order) => {
            acc[order.pizzaName] = (acc[order.pizzaName] || 0) + 1;
            return acc;
          }, {});

          const ordersCountArray = Object.keys(ordersCount).map(
            (pizzaName) => ({
              _id: pizzaName,
              count: ordersCount[pizzaName],
            })
          );

          io.of("/pizza")
            .to("orders")
            .emit("pizzaOrdersCount", ordersCountArray);
        }
      );
    });
  });
});

server.listen(port, () =>
  console.log(`Pizza Server is listening on PORT - ${port}`)
);
