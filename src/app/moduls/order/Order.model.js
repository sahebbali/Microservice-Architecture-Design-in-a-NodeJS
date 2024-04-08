const mongoose = require('mongoose');
// Define Order Schema
const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    productIds: { type: String, required: true },
    quantities: { type: Number, required: true },
    paymentInfo: { type: String, required: true },
    date: String,
    time: String,
});

const Order = mongoose.model('Order', orderSchema);
module.exports={Order}
