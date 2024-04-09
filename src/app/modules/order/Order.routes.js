const express = require("express");
const OrderCollection = require("./Order.controller");
const { validateCreateOrder } = require("./Validator");
const router = express.Router();

router.post("/create-order", validateCreateOrder, OrderCollection.CreateOrder);
router.get("/get-all-order",  OrderCollection.getAllOrders);
router.get("/get-order-by-id/:id", OrderCollection.getOrderById);
router.put("/update-order/:id", OrderCollection.updateOrder);
router.patch("/partial-update-order/:id", OrderCollection.partialUpdateOrder);
router.delete("/delete-order/:id", OrderCollection.deleteOrder);

module.exports = router;
