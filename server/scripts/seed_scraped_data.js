import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from '../src/db/index.js';
import { users, hardAssets, softAssets, tags, hardAssetTags, softAssetTags, softAssetLocations } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedScrapedData() {
    console.log('🌱 Starting scraped data seed...');

    try {
        // 1. Read JSON file
        const jsonPath = path.join(__dirname, 'scraped_assets.json');
        if (!fs.existsSync(jsonPath)) {
            throw new Error(`scraped_assets.json not found at ${jsonPath}. Run scraper.py first.`);
        }
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log(`📄 Loaded ${data.length} scraped locations.`);

        // 2. Ensure Partner User Exists
        let partnerId;
        const existingPartner = await db.query.users.findFirst({
            where: eq(users.email, 'chicago_partner@seniorcare.org')
        });

        if (existingPartner) {
            partnerId = existingPartner.id;
        } else {
            console.log('👤 Creating specialized Chicago Partner...');
            const pHash = await bcrypt.hash('partner123', 12);
            const [newPartner] = await db.insert(users).values({
                email: 'chicago_partner@seniorcare.org',
                passwordHash: pHash,
                name: 'City of Chicago Senior Care',
                role: 'partner',
                phone: '312-744-4016'
            }).returning();
            partnerId = newPartner.id;
        }

        // 3. Process tags
        console.log('🏷️ Processing Tags...');
        async function getOrInsertTags(tagNames) {
            if (!tagNames || tagNames.length === 0) return [];

            // Normalize Names
            const uniqueNames = [...new Set(tagNames.map(t => t.toLowerCase().trim()))].filter(Boolean);
            if (uniqueNames.length === 0) return [];

            const existing = await db.select().from(tags).where(inArray(tags.name, uniqueNames));
            const existingMap = new Map(existing.map(t => [t.name, t.id]));

            const toInsert = uniqueNames.filter(n => !existingMap.has(n));
            let inserted = [];
            if (toInsert.length > 0) {
                inserted = await db.insert(tags).values(toInsert.map(n => ({ name: n }))).returning();
            }

            const allTags = [...existing, ...inserted];
            // Return just the IDs for easy mapping
            return allTags.map(t => t.id);
        }


        // 4. Insert Hard Assets
        console.log('🏢 Inserting Hard Assets (Locations)...');
        for (const asset of data) {
            const [insertedHard] = await db.insert(hardAssets).values({
                partnerId,
                name: asset.name,
                lat: asset.lat,
                lng: asset.lng,
                address: asset.address,
                country: asset.country,
                postalCode: asset.postalCode,
                phone: asset.phone,
                hours: asset.hours,
                description: asset.description
            }).returning();

            // Link Hard Asset Tags
            if (asset.tags && asset.tags.length > 0) {
                const tagIds = await getOrInsertTags(asset.tags);
                if (tagIds.length > 0) {
                    await db.insert(hardAssetTags).values(
                        tagIds.map(tid => ({ hardAssetId: insertedHard.id, tagId: tid }))
                    );
                }
            }

            // Insert nested Soft Assets
            if (asset.programs && asset.programs.length > 0) {
                for (const prog of asset.programs) {
                    const [insertedSoft] = await db.insert(softAssets).values({
                        partnerId,
                        name: prog.name,
                        description: prog.description,
                        schedule: prog.schedule
                    }).returning();

                    await db.insert(softAssetLocations).values({
                        softAssetId: insertedSoft.id,
                        hardAssetId: insertedHard.id
                    });

                    // Link Soft Asset Tags
                    if (prog.tags && prog.tags.length > 0) {
                        const sTagIds = await getOrInsertTags(prog.tags);
                        if (sTagIds.length > 0) {
                            await db.insert(softAssetTags).values(
                                sTagIds.map(tid => ({ softAssetId: insertedSoft.id, tagId: tid }))
                            );
                        }
                    }
                }
            }
        }

        console.log('✅ Scraped data seeded successfully!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seedScrapedData();
