const CreateOrder = async (req, res) => {
  try {
    const { userId, productIds, quantities, paymentInfo } = req.body;

    // Validate request body
    if (!userId || !productIds || !quantities || !paymentInfo) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create new order
    const order = new Order({
      userId,
      productIds,
      quantities,
      paymentInfo,
    });

    // Save the order to the database
    await order.save();

    // Respond with success message and created order
    res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Failed to create order" });
  }
};

export default { CreateOrder };
