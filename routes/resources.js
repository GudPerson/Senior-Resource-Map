import express from 'express';
import db from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Country code → full name mapping for free-form fallback queries
const COUNTRY_NAMES = {
    US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
    SG: 'Singapore', MY: 'Malaysia', IN: 'India', PH: 'Philippines',
    JP: 'Japan', DE: 'Germany', FR: 'France',
};

// Geocode a postal code + country to lat/lng via OpenStreetMap Nominatim
// Strategy: try structured postalcode param first, fall back to free-form query
async function geocode(postalCode, country) {
    const headers = { 'User-Agent': 'SeniorCareConnect/1.0' };

    // Attempt 1: structured postalcode search
    const url1 = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&country=${encodeURIComponent(country)}&format=json&limit=1`;
    const res1 = await fetch(url1, { headers });
    const data1 = await res1.json();
    if (data1.length) {
        return { lat: parseFloat(data1[0].lat), lng: parseFloat(data1[0].lon) };
    }

    // Attempt 2: free-form query (works better for SG 6-digit postcodes)
    const countryName = COUNTRY_NAMES[country] || country;
    const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postalCode + ' ' + countryName)}&format=json&limit=1`;
    const res2 = await fetch(url2, { headers });
    const data2 = await res2.json();
    if (data2.length) {
        return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };
    }

    return null;
}

function mapRow(r) {
    return {
        id: r.id, partnerId: r.partner_id, name: r.name, category: r.category,
        country: r.country, postalCode: r.postal_code,
        lat: r.lat, lng: r.lng, address: r.address, phone: r.phone,
        hours: r.hours, description: r.description, updatedAt: r.updated_at,
        partnerName: r.partnerName || undefined,
    };
}

// GET /api/resources — public
router.get('/', (req, res) => {
    try {
        const rows = db.prepare(`
      SELECT r.*, u.name as partnerName
      FROM resources r
      LEFT JOIN users u ON r.partner_id = u.id
      ORDER BY r.updated_at DESC
    `).all();
        res.json(rows.map(mapRow));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
});

// GET /api/resources/:id — public
router.get('/:id', (req, res) => {
    try {
        const r = db.prepare(`
      SELECT r.*, u.name as partnerName
      FROM resources r LEFT JOIN users u ON r.partner_id = u.id
      WHERE r.id = ?
    `).get(parseInt(req.params.id));
        if (!r) return res.status(404).json({ error: 'Not found' });
        res.json(mapRow(r));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch resource' });
    }
});

// POST /api/resources — partner or admin
router.post('/', authenticateToken, requireRole('partner', 'admin'), async (req, res) => {
    try {
        const { name, category, country, postalCode, address, phone, hours, description } = req.body;
        if (!name || !category || !country || !postalCode || !address) {
            return res.status(400).json({ error: 'name, category, country, postalCode, address are required' });
        }
        // Geocode postal code → lat/lng
        const coords = await geocode(postalCode, country);
        if (!coords) {
            return res.status(400).json({ error: `Could not find location for postal code "${postalCode}" in "${country}". Please check and try again.` });
        }
        const result = db.prepare(
            'INSERT INTO resources (partner_id, name, category, country, postal_code, lat, lng, address, phone, hours, description) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        ).run(req.user.id, name, category, country, postalCode, coords.lat, coords.lng, address, phone || null, hours || null, description || null);
        const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(mapRow(resource));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create resource' });
    }
});

// PUT /api/resources/:id — partner (own) or admin (any)
router.put('/:id', authenticateToken, requireRole('partner', 'admin'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'admin' && existing.partner_id !== req.user.id) {
            return res.status(403).json({ error: "Cannot edit another partner's resource" });
        }
        const { name, category, country, postalCode, address, phone, hours, description } = req.body;
        // Re-geocode if postal code or country changed
        let lat = existing.lat;
        let lng = existing.lng;
        if (postalCode !== existing.postal_code || country !== existing.country) {
            const coords = await geocode(postalCode, country);
            if (!coords) {
                return res.status(400).json({ error: `Could not find location for postal code "${postalCode}" in "${country}". Please check and try again.` });
            }
            lat = coords.lat;
            lng = coords.lng;
        }
        db.prepare(
            'UPDATE resources SET name=?, category=?, country=?, postal_code=?, lat=?, lng=?, address=?, phone=?, hours=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
        ).run(name, category, country, postalCode, lat, lng, address, phone || null, hours || null, description || null, id);
        const updated = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
        res.json(mapRow(updated));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update resource' });
    }
});

// DELETE /api/resources/:id — partner (own) or admin (any)
router.delete('/:id', authenticateToken, requireRole('partner', 'admin'), (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'admin' && existing.partner_id !== req.user.id) {
            return res.status(403).json({ error: "Cannot delete another partner's resource" });
        }
        db.prepare('DELETE FROM resources WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete resource' });
    }
});

export default router;
