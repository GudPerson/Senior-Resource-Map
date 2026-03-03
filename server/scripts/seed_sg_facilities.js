/**
 * Seed Singapore Senior Facilities
 * =================================
 * Seeds the scraped SG senior facilities data (from the Python scraper) into the database.
 * 
 * Prerequisites:
 *   - Run the scraper first: python server/scripts/scrape_sg_senior_facilities.py
 *   - Ensure sg_senior_facilities.json exists in server/scripts/
 * 
 * Usage:
 *   node server/scripts/seed_sg_facilities.js
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from '../src/db/index.js';
import { users, hardAssets, subCategories, tags, hardAssetTags } from '../src/db/schema.js';
import { eq, inArray, and } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sub-category color map for the UI
const SUB_CATEGORY_COLORS = {
    'Active Ageing Centre': '#22c55e',    // green
    'Senior Activity Centre': '#10b981',   // emerald
    'Day Care': '#f59e0b',                 // amber
    'Day Rehabilitation': '#ef4444',       // red
    'Nursing Home': '#8b5cf6',             // violet
    'Eldercare Centre': '#06b6d4',         // cyan
    'Senior Care Centre': '#14b8a6',       // teal
    'Polyclinic': '#3b82f6',              // blue
    'Community Hospital': '#ec4899',       // pink
    'Hospice': '#6366f1',                  // indigo
    'Community Club': '#f97316',           // orange
    'Senior Fitness': '#84cc16',           // lime
    'Gym': '#a3e635',                      // lime-400
    'Event Space': '#d946ef',              // fuchsia
};

async function seedSgFacilities() {
    console.log('🌱 Starting SG Senior Facilities seed...\n');

    try {
        // 1. Read JSON file
        const jsonPath = path.join(__dirname, 'sg_senior_facilities.json');
        if (!fs.existsSync(jsonPath)) {
            throw new Error(
                `sg_senior_facilities.json not found at ${jsonPath}.\n` +
                `Run the scraper first:\n` +
                `  python server/scripts/scrape_sg_senior_facilities.py`
            );
        }
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log(`📄 Loaded ${data.length} facilities from JSON.\n`);

        // 2. Ensure partner user exists
        let partnerId;
        const partnerEmail = 'sg_senior_partner@seniorcare.sg';
        const existingPartner = await db.query.users.findFirst({
            where: eq(users.email, partnerEmail)
        });

        if (existingPartner) {
            partnerId = existingPartner.id;
            console.log(`👤 Using existing partner (ID: ${partnerId})`);
        } else {
            console.log('👤 Creating SG Senior Care partner...');
            const pHash = await bcrypt.hash('partner123', 12);
            const [newPartner] = await db.insert(users).values({
                email: partnerEmail,
                passwordHash: pHash,
                name: 'Singapore Senior Care Network',
                role: 'partner',
                phone: '+65 6355 1000'
            }).returning();
            partnerId = newPartner.id;
            console.log(`   Created partner (ID: ${partnerId})`);
        }

        // 3. Ensure sub-categories exist in the sub_categories table
        console.log('\n🏷️  Syncing sub-categories...');
        const uniqueSubCats = [...new Set(data.map(d => d.subCategory).filter(Boolean))];

        for (const catName of uniqueSubCats) {
            const existing = await db.query.subCategories?.findFirst?.({
                where: and(eq(subCategories.name, catName), eq(subCategories.type, 'hard'))
            });

            if (!existing) {
                try {
                    await db.insert(subCategories).values({
                        name: catName,
                        type: 'hard',
                        color: SUB_CATEGORY_COLORS[catName] || '#3b82f6',
                    });
                    console.log(`   ✅ Added sub-category: ${catName}`);
                } catch (e) {
                    // May already exist
                    console.log(`   ℹ️  Sub-category exists: ${catName}`);
                }
            } else {
                console.log(`   ✓  Sub-category exists: ${catName}`);
            }
        }

        // 4. Tag helper
        async function getOrInsertTags(tagNames) {
            if (!tagNames || tagNames.length === 0) return [];
            const uniqueNames = [...new Set(tagNames.map(t => t.toLowerCase().trim()))].filter(Boolean);
            if (uniqueNames.length === 0) return [];

            const existing = await db.select().from(tags).where(inArray(tags.name, uniqueNames));
            const existingMap = new Map(existing.map(t => [t.name, t.id]));

            const toInsert = uniqueNames.filter(n => !existingMap.has(n));
            let inserted = [];
            if (toInsert.length > 0) {
                inserted = await db.insert(tags).values(toInsert.map(n => ({ name: n }))).returning();
            }

            return [...existing, ...inserted].map(t => t.id);
        }

        // 5. Insert hard assets - Optimized with Bulk Inserts
        console.log('\n🏢 Inserting facilities (Optimized)...');

        // Fetch all existing asset names to avoid individual checks
        const existingAssets = await db.select({ name: hardAssets.name }).from(hardAssets);
        const existingSet = new Set(existingAssets.map(a => a.name));

        const toInsert = data.filter(f => !existingSet.has(f.name));
        const skippedCount = data.length - toInsert.length;

        if (toInsert.length === 0) {
            console.log('   ✅ No new facilities to insert.');
        } else {
            console.log(`   🚀 Found ${toInsert.length} new facilities. Inserting in batches...`);

            // Batch size to avoid hitting memory/stack limits
            const BATCH_SIZE = 50;
            let insertedCount = 0;

            for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
                const batch = toInsert.slice(i, i + BATCH_SIZE);

                // 1. Insert Asset Batch
                const insertedBatch = await db.insert(hardAssets).values(
                    batch.map(f => ({
                        partnerId,
                        name: f.name,
                        subCategory: f.subCategory || 'Active Ageing Centre',
                        lat: f.lat,
                        lng: f.lng,
                        address: f.address,
                        country: f.country || 'SG',
                        postalCode: f.postalCode || '',
                        phone: f.phone || '',
                        hours: f.hours || '',
                        description: f.description || '',
                    }))
                ).returning();

                // 2. Prepare Tags & Junction Records
                const junctionToInsert = [];
                const allBatchTags = new Set();

                batch.forEach(f => {
                    allBatchTags.add('senior care');
                    allBatchTags.add('singapore');
                    if (f.subCategory) allBatchTags.add(f.subCategory.toLowerCase());
                });

                // Get ID mapping for all tags in this batch
                const tagIds = await getOrInsertTags([...allBatchTags]);
                const tagsData = await db.select().from(tags).where(inArray(tags.name, [...allBatchTags]));
                const tagIdMap = new Map(tagsData.map(t => [t.name, t.id]));

                for (let j = 0; j < batch.length; j++) {
                    const f = batch[j];
                    const asset = insertedBatch[j];
                    const facilityTags = ['senior care', 'singapore'];
                    if (f.subCategory) facilityTags.push(f.subCategory.toLowerCase());

                    facilityTags.forEach(tagName => {
                        const tid = tagIdMap.get(tagName);
                        if (tid) junctionToInsert.push({ hardAssetId: asset.id, tagId: tid });
                    });
                }

                if (junctionToInsert.length > 0) {
                    await db.insert(hardAssetTags).values(junctionToInsert);
                }

                insertedCount += batch.length;
                console.log(`   📍 Progress: ${insertedCount}/${toInsert.length} facilities...`);
            }

            console.log(`\n✅ Successfully inserted ${insertedCount} new facilities!`);
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ Seeding complete!`);
        console.log(`   ⏭️  Skipped:  ${skippedCount} existing`);
        console.log(`   📊 Total:    ${data.length} processed`);
        console.log(`${'='.repeat(60)}\n`);

        process.exit(0);

    } catch (err) {
        console.error('\n❌ Seeding failed:', err);
        process.exit(1);
    }
}

seedSgFacilities();
