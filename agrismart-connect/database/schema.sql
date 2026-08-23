-- ============================================================
-- AgriSmart Connect - MySQL Database Schema
-- "Smart Farming. Better Decisions. Direct to Customers."
-- ============================================================
-- Engine: InnoDB (foreign key support), Charset: utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS agrismart_connect
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE agrismart_connect;

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. LOCATIONS (normalized state/district reference data)
-- ------------------------------------------------------------
CREATE TABLE locations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  state         VARCHAR(100) NOT NULL,
  district      VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_state_district (state, district)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. USERS (base auth table for all roles)
-- ------------------------------------------------------------
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  phone           VARCHAR(20) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('farmer','customer','admin') NOT NULL,
  status          ENUM('active','suspended','pending') DEFAULT 'active',
  reset_token     VARCHAR(255) DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  last_login      DATETIME DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. FARMERS (extends users)
-- ------------------------------------------------------------
CREATE TABLE farmers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL UNIQUE,
  location        VARCHAR(150),
  district        VARCHAR(100),
  state           VARCHAR(100),
  farm_area       DECIMAL(10,2) DEFAULT NULL COMMENT 'in acres',
  farmer_type     ENUM('smallholder','commercial','organic','mixed') DEFAULT 'smallholder',
  profile_image   VARCHAR(255) DEFAULT NULL,
  bio             TEXT,
  verified        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_farmers_district (district),
  INDEX idx_farmers_state (state)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. CUSTOMERS (extends users)
-- ------------------------------------------------------------
CREATE TABLE customers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL UNIQUE,
  location        VARCHAR(150),
  address         TEXT,
  profile_image   VARCHAR(255) DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. FARMS
-- ------------------------------------------------------------
CREATE TABLE farms (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id         INT NOT NULL,
  farm_name         VARCHAR(150) NOT NULL,
  location          VARCHAR(150),
  district          VARCHAR(100),
  state             VARCHAR(100),
  farm_area         DECIMAL(10,2) NOT NULL COMMENT 'in acres',
  soil_type         ENUM('clay','sandy','loamy','silty','peaty','chalky','black','red','alluvial') DEFAULT NULL,
  irrigation_type   ENUM('drip','sprinkler','flood','rainfed','canal','borewell','none') DEFAULT NULL,
  water_availability ENUM('low','medium','high','abundant') DEFAULT 'medium',
  farming_experience_years INT DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  INDEX idx_farms_farmer (farmer_id),
  INDEX idx_farms_district (district)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. SOIL TESTS
-- ------------------------------------------------------------
CREATE TABLE soil_tests (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  farm_id           INT NOT NULL,
  soil_ph           DECIMAL(4,2) NOT NULL,
  nitrogen          DECIMAL(6,2) DEFAULT NULL COMMENT 'kg/ha',
  phosphorus        DECIMAL(6,2) DEFAULT NULL COMMENT 'kg/ha',
  potassium         DECIMAL(6,2) DEFAULT NULL COMMENT 'kg/ha',
  organic_matter    DECIMAL(5,2) DEFAULT NULL COMMENT 'percentage',
  soil_type         VARCHAR(50) DEFAULT NULL,
  water_availability ENUM('low','medium','high','abundant') DEFAULT 'medium',
  farm_area_tested  DECIMAL(10,2) DEFAULT NULL,
  summary_condition VARCHAR(50) DEFAULT NULL COMMENT 'e.g. Good, Moderate, Needs Improvement',
  notes             TEXT,
  tested_at         DATE DEFAULT (CURRENT_DATE),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
  INDEX idx_soil_farm (farm_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. CATEGORIES (crop categories)
-- ------------------------------------------------------------
CREATE TABLE categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  description   VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. CROP_MASTER (reference data used by recommendation engine)
-- ------------------------------------------------------------
CREATE TABLE crop_master (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  crop_name             VARCHAR(100) NOT NULL UNIQUE,
  category_id           INT DEFAULT NULL,
  ideal_ph_min          DECIMAL(4,2) DEFAULT NULL,
  ideal_ph_max          DECIMAL(4,2) DEFAULT NULL,
  ideal_n               DECIMAL(6,2) DEFAULT NULL,
  ideal_p               DECIMAL(6,2) DEFAULT NULL,
  ideal_k               DECIMAL(6,2) DEFAULT NULL,
  water_requirement     ENUM('low','medium','high') DEFAULT 'medium',
  suitable_seasons      SET('kharif','rabi','zaid','summer','winter','monsoon','year-round') DEFAULT NULL,
  suitable_soil_types   VARCHAR(255) DEFAULT NULL COMMENT 'comma separated soil types',
  avg_days_to_harvest   INT DEFAULT NULL,
  base_demand_score     DECIMAL(4,2) DEFAULT 5.00 COMMENT 'fallback demand score 0-10 when no live analytics exist',
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 9. CROPS (farmer's actual planted/planned crops)
-- ------------------------------------------------------------
CREATE TABLE crops (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id             INT NOT NULL,
  farm_id               INT NOT NULL,
  crop_master_id         INT DEFAULT NULL,
  crop_name             VARCHAR(100) NOT NULL,
  variety               VARCHAR(100) DEFAULT NULL,
  category_id           INT DEFAULT NULL,
  area_cultivated        DECIMAL(10,2) DEFAULT NULL COMMENT 'in acres',
  planting_date          DATE DEFAULT NULL,
  expected_harvest_date  DATE DEFAULT NULL,
  actual_harvest_date    DATE DEFAULT NULL,
  estimated_quantity_kg   DECIMAL(10,2) DEFAULT NULL,
  actual_quantity_kg      DECIMAL(10,2) DEFAULT NULL,
  expected_price_per_kg   DECIMAL(10,2) DEFAULT NULL,
  available_for_prebooking_kg DECIMAL(10,2) DEFAULT 0,
  prebooked_quantity_kg    DECIMAL(10,2) DEFAULT 0,
  sold_quantity_kg         DECIMAL(10,2) DEFAULT 0,
  description             TEXT,
  cover_image              VARCHAR(255) DEFAULT NULL,
  status ENUM('planned','growing','ready_for_harvest','harvested','sold','completed') DEFAULT 'planned',
  growth_percentage        TINYINT DEFAULT 0,
  growth_stage ENUM('seedling','vegetative','flowering','fruit_development','ready_for_harvest') DEFAULT 'seedling',
  is_public                BOOLEAN DEFAULT TRUE,
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
  FOREIGN KEY (crop_master_id) REFERENCES crop_master(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_crops_farmer (farmer_id),
  INDEX idx_crops_status (status),
  INDEX idx_crops_harvest_date (expected_harvest_date),
  CONSTRAINT chk_prebook_not_exceed CHECK (prebooked_quantity_kg <= available_for_prebooking_kg)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 10. CROP_GROWTH_UPDATES
-- ------------------------------------------------------------
CREATE TABLE crop_growth_updates (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  crop_id         INT NOT NULL,
  image           VARCHAR(255) DEFAULT NULL,
  growth_percentage TINYINT DEFAULT 0,
  growth_stage    ENUM('seedling','vegetative','flowering','fruit_development','ready_for_harvest') NOT NULL,
  health_status   ENUM('excellent','good','fair','poor','at_risk') DEFAULT 'good',
  notes           TEXT,
  update_date     DATE DEFAULT (CURRENT_DATE),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
  INDEX idx_growth_crop (crop_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 11. CROP_RECOMMENDATIONS (log of AI/rule-based recommendation runs)
-- ------------------------------------------------------------
CREATE TABLE crop_recommendations (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id         INT NOT NULL,
  farm_id           INT DEFAULT NULL,
  soil_test_id      INT DEFAULT NULL,
  season            VARCHAR(50) DEFAULT NULL,
  input_snapshot    JSON DEFAULT NULL COMMENT 'full input payload used for this run',
  results           JSON DEFAULT NULL COMMENT 'ranked crop list with scores and explanations',
  engine_version    VARCHAR(50) DEFAULT 'rule-based-v1',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE SET NULL,
  FOREIGN KEY (soil_test_id) REFERENCES soil_tests(id) ON DELETE SET NULL,
  INDEX idx_reco_farmer (farmer_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 12. MARKET_DEMAND (aggregated/manual demand signal data)
-- ------------------------------------------------------------
CREATE TABLE market_demand (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  crop_master_id  INT NOT NULL,
  district        VARCHAR(100) DEFAULT NULL,
  state           VARCHAR(100) DEFAULT NULL,
  season          VARCHAR(50) DEFAULT NULL,
  demand_score    DECIMAL(4,2) DEFAULT 5.00 COMMENT '0-10 scale',
  search_count    INT DEFAULT 0,
  view_count      INT DEFAULT 0,
  order_count     INT DEFAULT 0,
  is_sample_data  BOOLEAN DEFAULT TRUE COMMENT 'true until replaced with real aggregated data',
  period_month    TINYINT DEFAULT NULL,
  period_year     SMALLINT DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (crop_master_id) REFERENCES crop_master(id) ON DELETE CASCADE,
  INDEX idx_demand_crop (crop_master_id),
  INDEX idx_demand_district (district)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 13. PRODUCTS (marketplace listing derived from a crop; 1 crop -> 1 product listing)
-- ------------------------------------------------------------
CREATE TABLE products (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  crop_id         INT NOT NULL UNIQUE,
  farmer_id       INT NOT NULL,
  category_id     INT DEFAULT NULL,
  title           VARCHAR(150) NOT NULL,
  price_per_kg    DECIMAL(10,2) NOT NULL,
  total_quantity_kg DECIMAL(10,2) NOT NULL,
  available_quantity_kg DECIMAL(10,2) NOT NULL,
  is_upcoming     BOOLEAN DEFAULT FALSE COMMENT 'true if still growing (pre-booking only)',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_products_active (is_active),
  INDEX idx_products_upcoming (is_upcoming)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 14. PRE_BOOKINGS
-- ------------------------------------------------------------
CREATE TABLE pre_bookings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT NOT NULL,
  crop_id         INT NOT NULL,
  farmer_id       INT NOT NULL,
  quantity_kg     DECIMAL(10,2) NOT NULL,
  price_per_kg_at_booking DECIMAL(10,2) NOT NULL,
  status          ENUM('pending','confirmed','cancelled','converted_to_order','expired') DEFAULT 'pending',
  expected_harvest_date DATE DEFAULT NULL,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  INDEX idx_prebook_customer (customer_id),
  INDEX idx_prebook_crop (crop_id),
  INDEX idx_prebook_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 15. ORDERS
-- ------------------------------------------------------------
CREATE TABLE orders (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  order_number      VARCHAR(30) NOT NULL UNIQUE,
  customer_id       INT NOT NULL,
  farmer_id         INT NOT NULL,
  pre_booking_id    INT DEFAULT NULL COMMENT 'set if this order originated from a pre-booking',
  subtotal          DECIMAL(10,2) NOT NULL,
  delivery_fee      DECIMAL(10,2) DEFAULT 0,
  total_amount      DECIMAL(10,2) NOT NULL,
  fulfillment_type  ENUM('delivery','pickup') DEFAULT 'delivery',
  delivery_address  TEXT,
  status ENUM('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled') DEFAULT 'pending',
  payment_status    ENUM('unpaid','pending','paid','refunded') DEFAULT 'unpaid',
  payment_method    VARCHAR(50) DEFAULT NULL COMMENT 'reserved for future payment gateway integration',
  cancelled_reason  VARCHAR(255) DEFAULT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (pre_booking_id) REFERENCES pre_bookings(id) ON DELETE SET NULL,
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_farmer (farmer_id),
  INDEX idx_orders_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 16. ORDER_ITEMS
-- ------------------------------------------------------------
CREATE TABLE order_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  order_id        INT NOT NULL,
  product_id      INT NOT NULL,
  crop_id         INT NOT NULL,
  quantity_kg     DECIMAL(10,2) NOT NULL,
  price_per_kg    DECIMAL(10,2) NOT NULL,
  line_total      DECIMAL(10,2) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
  INDEX idx_order_items_order (order_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 17. NOTIFICATIONS
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  type          VARCHAR(50) NOT NULL COMMENT 'e.g. new_prebooking, order_status, harvest_reminder',
  title         VARCHAR(150) NOT NULL,
  message       TEXT NOT NULL,
  reference_type VARCHAR(50) DEFAULT NULL COMMENT 'e.g. order, prebooking, crop',
  reference_id  INT DEFAULT NULL,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_read (is_read)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 18. REVIEWS
-- ------------------------------------------------------------
CREATE TABLE reviews (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  order_id        INT NOT NULL,
  customer_id     INT NOT NULL,
  farmer_id       INT NOT NULL,
  crop_id         INT DEFAULT NULL,
  rating          TINYINT NOT NULL COMMENT '1-5',
  comment         TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE SET NULL,
  UNIQUE KEY uq_review_per_order (order_id),
  CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5),
  INDEX idx_reviews_farmer (farmer_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 19. SAVED_FARMERS (customer favorites)
-- ------------------------------------------------------------
CREATE TABLE saved_farmers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT NOT NULL,
  farmer_id       INT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  UNIQUE KEY uq_saved (customer_id, farmer_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 20. RECOMMENDATION_WEIGHTS (configurable scoring weights, section 7)
-- ------------------------------------------------------------
CREATE TABLE recommendation_weights (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  weight_key          VARCHAR(50) NOT NULL UNIQUE,
  weight_value        DECIMAL(4,2) NOT NULL COMMENT 'contribution 0-1, all active weights should sum to 1.0',
  description         VARCHAR(255),
  is_active           BOOLEAN DEFAULT TRUE,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 21. COMPLAINTS (admin moderation, section 17)
-- ------------------------------------------------------------
CREATE TABLE complaints (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  raised_by_user_id INT NOT NULL,
  against_user_id   INT DEFAULT NULL,
  order_id          INT DEFAULT NULL,
  subject           VARCHAR(150) NOT NULL,
  description       TEXT NOT NULL,
  status            ENUM('open','investigating','resolved','dismissed') DEFAULT 'open',
  admin_notes       TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (raised_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (against_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED DATA: default recommendation weights (section 7)
-- ============================================================
INSERT INTO recommendation_weights (weight_key, weight_value, description) VALUES
('soil_suitability', 0.30, 'How well soil pH/N/P/K match crop ideal range'),
('season_suitability', 0.20, 'How well current season matches crop suitable seasons'),
('water_suitability', 0.20, 'How well available water matches crop water requirement'),
('weather_suitability', 0.15, 'How well current weather conditions match crop needs'),
('demand_score', 0.15, 'Market demand outlook for the crop');

-- ============================================================
-- SEED DATA: sample categories
-- ============================================================
INSERT INTO categories (name, slug, description) VALUES
('Vegetables', 'vegetables', 'Fresh vegetables'),
('Fruits', 'fruits', 'Fresh fruits'),
('Leafy Vegetables', 'leafy-vegetables', 'Leafy greens'),
('Organic Produce', 'organic-produce', 'Certified/claimed organic produce'),
('Grains & Pulses', 'grains-pulses', 'Grains and pulses');

-- ============================================================
-- SEED DATA: sample crop master reference data (demo, not verified agri data)
-- ============================================================
INSERT INTO crop_master (crop_name, category_id, ideal_ph_min, ideal_ph_max, ideal_n, ideal_p, ideal_k, water_requirement, suitable_seasons, suitable_soil_types, avg_days_to_harvest, base_demand_score) VALUES
('Tomato', 1, 6.0, 6.8, 120, 60, 60, 'medium', 'kharif,rabi,zaid', 'loamy,sandy,black', 75, 8.0),
('Chilli', 1, 6.0, 7.0, 100, 50, 50, 'medium', 'kharif,rabi', 'loamy,red,black', 150, 6.5),
('Okra', 1, 6.0, 6.8, 80, 60, 40, 'medium', 'kharif,zaid', 'loamy,sandy,alluvial', 60, 7.0),
('Potato', 1, 5.0, 6.5, 150, 80, 100, 'medium', 'rabi', 'loamy,sandy,alluvial', 90, 7.5),
('Onion', 1, 6.0, 7.5, 100, 50, 50, 'low', 'rabi,zaid', 'loamy,black,alluvial', 120, 8.0),
('Spinach', 3, 6.0, 7.5, 60, 40, 40, 'medium', 'rabi,winter', 'loamy,alluvial', 40, 6.0),
('Cabbage', 1, 6.0, 6.5, 100, 60, 60, 'medium', 'rabi,winter', 'loamy,clay,alluvial', 90, 5.5),
('Mango', 2, 5.5, 7.5, 100, 50, 100, 'medium', 'summer,year-round', 'loamy,alluvial,red', 365, 9.0),
('Banana', 2, 5.5, 7.0, 200, 60, 200, 'high', 'year-round', 'loamy,alluvial,clay', 300, 8.5),
('Watermelon', 2, 6.0, 6.8, 90, 60, 90, 'high', 'summer,zaid', 'sandy,loamy,alluvial', 90, 7.0);
