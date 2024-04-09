const { validationResult } = require("express-validator");
const { body } = require("express-validator");

const validateCreateOrder = [
  // Validate userId
  body("userId")
    .notEmpty()
    .withMessage("User ID cannot be empty")
    .isString()
    .withMessage("User ID must be a string"),

  // Validate productIds
  body("productIds")
    .notEmpty()
    .withMessage("Product IDs cannot be empty")
    .isString({ min: 1 })
    .withMessage("At least one product ID is required"),

  // Validate quantities
  body("quantities")
    .notEmpty()
    .withMessage("Quantities cannot be empty")
    .isNumeric({ min: 1 })
    .withMessage("At least one quantity is required"),

  // Validate paymentInfo
  body("paymentInfo")
    .notEmpty()
    .withMessage("Payment info cannot be empty")
    .isString()
    .withMessage("Payment info must be an object"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = { validateCreateOrder };
