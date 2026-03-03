import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'seniorcare.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🌱 Creating tables...');
db.exec(`
  DROP TABLE IF EXISTS resources;
  DROP TABLE IF EXISTS users;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'partner' CHECK(role IN ('admin', 'partner')),
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Healthcare', 'Fitness', 'Social', 'Promotions')),
    country TEXT NOT NULL DEFAULT 'SG',
    postal_code TEXT NOT NULL DEFAULT '',
    lat REAL,
    lng REAL,
    address TEXT NOT NULL,
    phone TEXT,
    hours TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('👤 Seeding users...');
const adminHash = bcrypt.hashSync('admin123', 12);
const partnerHash = bcrypt.hashSync('partner123', 12);

const insertUser = db.prepare(`INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?) RETURNING id`);

const admin = insertUser.get('admin@seniorcare.sg', adminHash, 'SeniorCare SG Admin', 'admin');
const partner1 = insertUser.get('aic@example.sg', partnerHash, 'Agency for Integrated Care', 'partner');
const partner2 = insertUser.get('activesg@example.sg', partnerHash, 'ActiveSG Senior Programmes', 'partner');

// Geocode via Nominatim
async function geocode(postalCode, country) {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&country=${encodeURIComponent(country)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'SeniorCareConnect/1.0' } });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// Singapore-specific seed resources
const seedResources = [
    // Healthcare
    [partner1.id, 'Singapore General Hospital — Senior Clinic', 'Healthcare', 'SG', '169608', 'Outram Rd, Singapore 169608', '+65 6222 3322', 'Mon–Fri 8am–5pm, Sat 8am–12pm', 'Geriatric medicine and chronic disease management for seniors 60+.'],
    [partner1.id, 'Tan Tock Seng Hospital — Centre for Geriatric Medicine', 'Healthcare', 'SG', '308433', '11 Jln Tan Tock Seng, Singapore 308433', '+65 6256 6011', 'Mon–Fri 8:30am–5:30pm', 'Specialist geriatric assessments, memory clinic, and falls prevention.'],
    [partner1.id, 'Khoo Teck Puat Hospital — Senior Care Centre', 'Healthcare', 'SG', '768828', '90 Yishun Central, Singapore 768828', '+65 6555 8000', 'Mon–Fri 8am–5pm', 'Outpatient rehabilitation, physiotherapy, and senior wellness screening.'],

    // Fitness
    [partner2.id, 'ActiveSG Gym @ Heartbeat@Bedok', 'Fitness', 'SG', '469662', '11 Bedok North St 1, Singapore 469662', '+65 6443 5275', 'Daily 7am–9:30pm', 'Seniors-friendly gym with guided exercise programmes and pool access.'],
    [partner2.id, 'ActiveSG Gym @ Our Tampines Hub', 'Fitness', 'SG', '528523', '1 Tampines Walk, Singapore 528523', '+65 6788 0123', 'Daily 7am–9:30pm', 'Multi-sport complex with tai chi and aqua aerobics for seniors.'],
    [partner2.id, 'Bishan ActiveSG Swimming Complex', 'Fitness', 'SG', '579837', '5 Bishan St 14, Singapore 579837', '+65 6259 0234', 'Daily 6:30am–9:30pm', 'Senior swim sessions every weekday morning with lifeguard support.'],

    // Social
    [partner1.id, 'NTUC Health Senior Activity Centre — Kampung Admiralty', 'Social', 'SG', '738907', '676 Woodlands Dr 71, Singapore 738907', '+65 6363 3100', 'Mon–Fri 9am–5pm', 'Day care, befriending programmes, and intergenerational activities.'],
    [partner1.id, 'Lions Befrienders @ Toa Payoh', 'Social', 'SG', '310089', 'Blk 89 Toa Payoh Lorong 4, Singapore 310089', '+65 6252 5522', 'Mon–Sat 9am–5pm', 'Befriending service for isolated seniors, weekly group outings and meals.'],
    [partner1.id, 'SAGE Counselling Centre @ Chinatown', 'Social', 'SG', '058357', '10 Smith St, #03-01 Chinatown Complex, Singapore 058357', '+65 1800 555 5555', 'Mon–Fri 9am–6pm', 'Free counselling, caregiver support, and elder abuse helpline.'],

    // Promotions
    [partner2.id, 'FairPrice — Pioneer Generation Discounts', 'Promotions', 'SG', '238840', '290 Orchard Rd, #B1-01, Singapore 238840', '+65 6456 0233', 'Daily 7am–11pm', '3% storewide discount for Pioneer and Merdeka Generation card holders.'],
    [partner2.id, 'Unity Pharmacy — Senior Wellness Day', 'Promotions', 'SG', '530101', 'Blk 101 Toa Payoh Lorong 1, Singapore 530101', '+65 6250 3456', 'Mon–Sat 8:30am–10pm', '20% off health supplements for seniors every first Wednesday.'],
    [partner1.id, 'National Library — SilverACE Programme', 'Promotions', 'SG', '179098', '100 Victoria St, Singapore 179098', '+65 6332 3255', 'Daily 10am–9pm', 'Free digital literacy workshops and one-on-one tech help for seniors.'],
];

console.log('🗺️  Geocoding & seeding resources (Singapore)...');
const insertResource = db.prepare(
    'INSERT INTO resources (partner_id, name, category, country, postal_code, lat, lng, address, phone, hours, description) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
);

async function seedAll() {
    for (const [partnerId, name, category, country, postalCode, address, phone, hours, desc] of seedResources) {
        const coords = await geocode(postalCode, country);
        if (coords) {
            insertResource.run(partnerId, name, category, country, postalCode, coords.lat, coords.lng, address, phone, hours, desc);
            console.log(`  ✓ ${name} → ${postalCode} → (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
        } else {
            console.log(`  ✗ ${name} → Could not geocode ${postalCode}, ${country}`);
        }
        // Nominatim rate limit: max 1 request/sec
        await new Promise(r => setTimeout(r, 1100));
    }
}

await seedAll();

const count = db.prepare('SELECT COUNT(*) as c FROM resources').get();
console.log(`\n✅ Seed complete! ${count.c} resources in database.`);
console.log('   Admin:   admin@seniorcare.sg / admin123');
console.log('   Partner: aic@example.sg / partner123');
console.log('   Partner: activesg@example.sg / partner123');

db.close();
