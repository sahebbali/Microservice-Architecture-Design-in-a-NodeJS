import express from 'express'
import OrderCollection from './Order.controller'
const router = express.Router()

router.post('/create-order',OrderCollection.CreateOrder )

export default router