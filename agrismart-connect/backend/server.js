// ============================================================
// AgriSmart Connect - Backend Server Entrypoint
// "Smart Farming. Better Decisions. Direct to Customers."
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// ---------------- Core middleware ----------------
app.use(helmet({ crossOriginResourcePolicy: false })); // allow serving uploaded images cross-origin
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Static file serving for uploaded crop/growth/profile images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------- Health check ----------------
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'AgriSmart Connect API is running.', timestamp: new Date().toISOString() });
});

// ---------------- API Routes ----------------
// Modules are mounted incrementally as they are built.
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/farms', require('./routes/farmRoutes'));
app.use('/api/soil', require('./routes/soilRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/crops', require('./routes/cropRoutes'));
app.use('/api/growth', require('./routes/growthRoutes'));
app.use('/api/marketplace', require('./routes/marketplaceRoutes'));
app.use('/api/prebookings', require('./routes/prebookingRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// ---------------- 404 + Error handling ----------------
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🌱 AgriSmart Connect API running on http://localhost:${PORT}`);
});

module.exports = app;
