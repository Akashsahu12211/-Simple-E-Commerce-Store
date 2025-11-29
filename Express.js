// server.js - Main Express.js Backend
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// ==================== SCHEMAS ====================

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  addresses: [{
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    isDefault: Boolean
  }],
  createdAt: { type: Date, default: Date.now }
});

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  inventory: {
    quantity: { type: Number, required: true, default: 0 },
    reserved: { type: Number, default: 0 },
    available: { type: Number }
  },
  images: [{ url: String, alt: String }],
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  tags: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Calculate available inventory
productSchema.pre('save', function(next) {
  this.inventory.available = this.inventory.quantity - this.inventory.reserved;
  next();
});

// Review Schema
const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, required: true },
  comment: { type: String, required: true },
  verified: { type: Boolean, default: false },
  helpful: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderNumber: { type: String, required: true, unique: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: Number,
    quantity: Number
  }],
  totalAmount: { type: Number, required: true },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed', 'refunded'], 
    default: 'pending' 
  },
  paymentMethod: { type: String, required: true },
  paymentIntentId: String,
  orderStatus: { 
    type: String, 
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], 
    default: 'pending' 
  },
  tracking: {
    carrier: String,
    trackingNumber: String,
    url: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Review = mongoose.model('Review', reviewSchema);
const Order = mongoose.model('Order', orderSchema);

// ==================== MIDDLEWARE ====================

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Admin Middleware
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword
    });
    
    await user.save();
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PRODUCT ROUTES ====================

// Get all products with filtering, search, and pagination
app.get('/api/products', async (req, res) => {
  try {
    const { 
      category, 
      search, 
      minPrice, 
      maxPrice, 
      sortBy = 'createdAt', 
      order = 'desc',
      page = 1,
      limit = 12,
      inStock
    } = req.query;
    
    // Build query
    let query = { isActive: true };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    if (inStock === 'true') {
      query['inventory.available'] = { $gt: 0 };
    }
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    
    // Execute query with pagination
    const skip = (page - 1) * limit;
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Product.countDocuments(query);
    
    res.json({
      products,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create product (Admin only)
app.post('/api/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update product (Admin only)
app.put('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete product (Admin only)
app.delete('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update inventory (Admin only)
app.patch('/api/products/:id/inventory', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { quantity, operation } = req.body; // operation: 'add' or 'set'
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (operation === 'add') {
      product.inventory.quantity += quantity;
    } else {
      product.inventory.quantity = quantity;
    }
    
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== REVIEW ROUTES ====================

// Get reviews for a product
app.get('/api/products/:id/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.id })
      .populate('userId', 'name')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create review
app.post('/api/products/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const { rating, title, comment } = req.body;
    
    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      productId: req.params.id,
      userId: req.user.userId
    });
    
    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }
    
    // Check if user purchased this product
    const hasPurchased = await Order.findOne({
      userId: req.user.userId,
      'items.productId': req.params.id,
      paymentStatus: 'paid'
    });
    
    const review = new Review({
      productId: req.params.id,
      userId: req.user.userId,
      rating,
      title,
      comment,
      verified: !!hasPurchased
    });
    
    await review.save();
    
    // Update product rating
    const reviews = await Review.find({ productId: req.params.id });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    await Product.findByIdAndUpdate(req.params.id, {
      'ratings.average': avgRating,
      'ratings.count': reviews.length
    });
    
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ORDER ROUTES ====================

// Create order with payment intent
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    
    // Validate inventory and calculate total
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }
      
      if (product.inventory.available < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient inventory for ${product.name}` 
        });
      }
      
      // Reserve inventory
      product.inventory.reserved += item.quantity;
      await product.save();
      
      orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      });
      
      totalAmount += product.price * item.quantity;
    }
    
    // Generate order number
    const orderNumber = 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
    
    // Create Stripe payment intent
    let paymentIntentId = null;
    if (paymentMethod === 'stripe') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: 'usd',
        metadata: { orderNumber }
      });
      paymentIntentId = paymentIntent.id;
    }
    
    // Create order
    const order = new Order({
      userId: req.user.userId,
      orderNumber,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      paymentIntentId
    });
    
    await order.save();
    
    res.status(201).json({
      order,
      clientSecret: paymentIntentId ? (await stripe.paymentIntents.retrieve(paymentIntentId)).client_secret : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm payment
app.post('/api/orders/:id/confirm-payment', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Verify payment with Stripe
    if (order.paymentMethod === 'stripe') {
      const paymentIntent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ error: 'Payment not completed' });
      }
    }
    
    // Update order status
    order.paymentStatus = 'paid';
    order.orderStatus = 'processing';
    
    // Convert reserved inventory to sold
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      product.inventory.reserved -= item.quantity;
      product.inventory.quantity -= item.quantity;
      await product.save();
    }
    
    await order.save();
    
    res.json({ message: 'Payment confirmed', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user orders
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .populate('items.productId', 'name');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.productId', 'name images');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status (Admin only)
app.patch('/api/orders/:id/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { orderStatus, tracking } = req.body;
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        orderStatus, 
        tracking,
        updatedAt: Date.now() 
      },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all orders (Admin only)
app.get('/api/admin/orders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (status) {
      query.orderStatus = status;
    }
    
    const skip = (page - 1) * limit;
    const orders = await Order.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Order.countDocuments(query);
    
    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS ROUTES (Admin) ====================

app.get('/api/admin/analytics', authenticateToken, isAdmin, async (req, res) => {
  try {
    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({ 
      'inventory.available': { $lt: 10 } 
    });
    
    res.json({
      revenue: totalRevenue[0]?.total || 0,
      orders: totalOrders,
      products: totalProducts,
      lowStock: lowStockProducts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SERVER ====================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});