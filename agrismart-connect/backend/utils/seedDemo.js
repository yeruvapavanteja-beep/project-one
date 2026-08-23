// ============================================================
// Demo Seed Script
// Run with: npm run seed
// Populates sample farmers, customers, farms, crops, and one
// pre-booking so the app has something to look at on first run.
// Safe to re-run — uses INSERT IGNORE / existence checks where practical.
// ============================================================
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function seed() {
  console.log('🌱 Seeding demo data...');
  const passwordHash = await bcrypt.hash('Password123', 12);

  try {
    // ---- Admin ----
    const [adminExists] = await pool.query("SELECT id FROM users WHERE email = 'admin@agrismart.test'");
    let adminId;
    if (adminExists.length === 0) {
      const [r] = await pool.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ('Platform Admin','admin@agrismart.test','9999999999',:pw,'admin')`,
        { pw: passwordHash }
      );
      adminId = r.insertId;
      console.log('  ✓ Admin created: admin@agrismart.test / Password123');
    } else {
      console.log('  · Admin already exists, skipping.');
    }

    // ---- Farmer ----
    const [farmerExists] = await pool.query("SELECT id FROM users WHERE email = 'ramesh@agrismart.test'");
    let farmerUserId, farmerId;
    if (farmerExists.length === 0) {
      const [r] = await pool.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ('Ramesh Kumar','ramesh@agrismart.test','9876500001',:pw,'farmer')`,
        { pw: passwordHash }
      );
      farmerUserId = r.insertId;
      const [fr] = await pool.query(
        `INSERT INTO farmers (user_id, location, district, state, farm_area, farmer_type, verified)
         VALUES (:userId, 'Rambedu Village', 'Karimnagar', 'Telangana', 3.5, 'smallholder', TRUE)`,
        { userId: farmerUserId }
      );
      farmerId = fr.insertId;
      console.log('  ✓ Farmer created: ramesh@agrismart.test / Password123');
    } else {
      farmerUserId = farmerExists[0].id;
      const [fr] = await pool.query('SELECT id FROM farmers WHERE user_id = :id', { id: farmerUserId });
      farmerId = fr[0].id;
      console.log('  · Farmer already exists, skipping.');
    }

    // ---- Customer ----
    const [customerExists] = await pool.query("SELECT id FROM users WHERE email = 'sana@agrismart.test'");
    let customerUserId, customerId;
    if (customerExists.length === 0) {
      const [r] = await pool.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ('Sana Patel','sana@agrismart.test','9876500002',:pw,'customer')`,
        { pw: passwordHash }
      );
      customerUserId = r.insertId;
      const [cr] = await pool.query(
        `INSERT INTO customers (user_id, location, address) VALUES (:userId, 'Hyderabad', '12-3-456, Banjara Hills, Hyderabad')`,
        { userId: customerUserId }
      );
      customerId = cr.insertId;
      console.log('  ✓ Customer created: sana@agrismart.test / Password123');
    } else {
      customerUserId = customerExists[0].id;
      const [cr] = await pool.query('SELECT id FROM customers WHERE user_id = :id', { id: customerUserId });
      customerId = cr[0].id;
      console.log('  · Customer already exists, skipping.');
    }

    // ---- Farm ----
    const [farmExists] = await pool.query('SELECT id FROM farms WHERE farmer_id = :farmerId', { farmerId });
    let farmId;
    if (farmExists.length === 0) {
      const [r] = await pool.query(
        `INSERT INTO farms (farmer_id, farm_name, location, district, state, farm_area, soil_type, irrigation_type, water_availability, farming_experience_years)
         VALUES (:farmerId, 'Rambedu Farms', 'Rambedu Village', 'Karimnagar', 'Telangana', 3.5, 'loamy', 'drip', 'medium', 8)`,
        { farmerId }
      );
      farmId = r.insertId;
      console.log('  ✓ Farm created: Rambedu Farms');
    } else {
      farmId = farmExists[0].id;
      console.log('  · Farm already exists, skipping.');
    }

    // ---- Crop (Tomato, growing, open for pre-booking) ----
    const [cropExists] = await pool.query("SELECT id FROM crops WHERE farmer_id = :farmerId AND crop_name = 'Tomato'", { farmerId });
    let cropId;
    if (cropExists.length === 0) {
      const [cm] = await pool.query("SELECT id FROM crop_master WHERE crop_name = 'Tomato'");
      const harvestDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const plantDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [r] = await pool.query(
        `INSERT INTO crops
          (farmer_id, farm_id, crop_master_id, crop_name, variety, area_cultivated, planting_date, expected_harvest_date,
           estimated_quantity_kg, expected_price_per_kg, available_for_prebooking_kg, description, status, growth_percentage, growth_stage, is_public)
         VALUES (:farmerId, :farmId, :cmId, 'Tomato', 'Hybrid Desi', 1.2, :plantDate, :harvestDate, 500, 28, 350,
                 'Fresh vine-ripened tomatoes grown with drip irrigation.', 'growing', 55, 'flowering', TRUE)`,
        { farmerId, farmId, cmId: cm[0]?.id || null, plantDate, harvestDate }
      );
      cropId = r.insertId;
      console.log('  ✓ Crop created: Tomato (growing, open for pre-booking)');

      // Sync marketplace product listing
      const ProductModel = require('../models/productModel');
      await ProductModel.syncFromCrop(cropId);

      // One growth update
      await pool.query(
        `INSERT INTO crop_growth_updates (crop_id, growth_percentage, growth_stage, health_status, notes, update_date)
         VALUES (:cropId, 55, 'flowering', 'good', 'Flowering well after last week\\'s irrigation cycle.', CURDATE())`,
        { cropId }
      );
    } else {
      cropId = cropExists[0].id;
      console.log('  · Demo crop already exists, skipping.');
    }

    // ---- A sample pre-booking ----
    const [pbExists] = await pool.query('SELECT id FROM pre_bookings WHERE crop_id = :cropId AND customer_id = :customerId', { cropId, customerId });
    if (pbExists.length === 0) {
      await pool.query(
        `INSERT INTO pre_bookings (customer_id, crop_id, farmer_id, quantity_kg, price_per_kg_at_booking, status, expected_harvest_date)
         SELECT :customerId, :cropId, :farmerId, 20, 28, 'pending', expected_harvest_date FROM crops WHERE id = :cropId`,
        { customerId, cropId, farmerId }
      );
      await pool.query('UPDATE crops SET prebooked_quantity_kg = prebooked_quantity_kg + 20 WHERE id = :cropId', { cropId });
      console.log('  ✓ Sample pre-booking created (20kg Tomato)');
    } else {
      console.log('  · Sample pre-booking already exists, skipping.');
    }

    // ---- Sample market demand rows (flagged as sample data) ----
    const [demandExists] = await pool.query('SELECT id FROM market_demand LIMIT 1');
    if (demandExists.length === 0) {
      const [crops] = await pool.query('SELECT id FROM crop_master');
      for (const c of crops) {
        await pool.query(
          `INSERT INTO market_demand (crop_master_id, district, season, demand_score, search_count, view_count, order_count, is_sample_data)
           VALUES (:cmId, 'Karimnagar', 'kharif', :score, 0, 0, 0, TRUE)`,
          { cmId: c.id, score: (Math.random() * 4 + 5).toFixed(2) }
        );
      }
      console.log('  ✓ Sample market demand rows seeded (flagged is_sample_data = TRUE)');
    }

    console.log('\n✅ Seeding complete.\n');
    console.log('Demo logins (password: Password123):');
    console.log('  Admin:    admin@agrismart.test');
    console.log('  Farmer:   ramesh@agrismart.test');
    console.log('  Customer: sana@agrismart.test');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    process.exit(0);
  }
}

seed();
