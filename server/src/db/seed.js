

import bcrypt from 'bcryptjs';
import db from './index.js';
import { users, hardAssets, softAssets, tags, hardAssetTags, softAssetTags, softAssetLocations, subCategories } from './schema.js';

async function seed() {
    console.log('🌱 Starting database seed...');

    try {
        // Clear existing data (order matters for FK constraints)
        console.log('🧹 Clearing existing data...');
        await db.delete(softAssetLocations);
        await db.delete(softAssetTags);
        await db.delete(hardAssetTags);
        await db.delete(softAssets);
        await db.delete(hardAssets);
        await db.delete(tags);
        await db.delete(subCategories);
        await db.delete(users);

        // 1. Create Users
        console.log('👤 Creating users...');
        const adminPasswordHash = await bcrypt.hash('admin123', 12);
        const partnerPasswordHash = await bcrypt.hash('partner123', 12);

        const createdUsers = await db.insert(users).values([
            {
                email: 'admin@seniorcare.com',
                passwordHash: adminPasswordHash,
                name: 'System Admin',
                role: 'admin',
                phone: '+65 6123 4567'
            },
            {
                email: 'fitlife@example.com',
                passwordHash: partnerPasswordHash,
                name: 'FitLife Senior Hub',
                role: 'partner',
                phone: '+65 6888 9999'
            },
            {
                email: 'info@silverfitness.sg',
                passwordHash: partnerPasswordHash,
                name: 'Silver Fitness SG',
                role: 'partner',
                phone: '+65 6777 8888'
            },
            {
                email: 'hello@ntuchealth.sg',
                passwordHash: partnerPasswordHash,
                name: 'NTUC Health',
                role: 'partner',
                phone: '+65 6590 0000'
            },
            {
                email: 'contact@sata.com.sg',
                passwordHash: partnerPasswordHash,
                name: 'SATA CommHealth',
                role: 'partner',
                phone: '+65 6244 6688'
            },
            {
                email: 'user@example.com',
                passwordHash: await bcrypt.hash('user123', 12),
                name: 'Demo User',
                role: 'user',
                phone: '+65 9123 4567'
            }
        ]).returning();

        const partner1Id = createdUsers[1].id;
        const partner2Id = createdUsers[2].id;
        const partner3Id = createdUsers[3].id;
        const partner4Id = createdUsers[4].id;

        // 1.5 Create SubCategories
        console.log('🗂️  Creating sub categories...');
        await db.insert(subCategories).values([
            { name: 'Polyclinic', type: 'hard', color: '#10b981' }, // emerald
            { name: 'Active Ageing Centre', type: 'hard', color: '#f59e0b' }, // amber
            { name: 'Community Hospital', type: 'hard', color: '#ef4444' }, // red
            { name: 'Gym', type: 'hard', color: '#3b82f6' }, // blue
            { name: 'Day Care', type: 'hard', color: '#8b5cf6' }, // violet
            { name: 'Event Space', type: 'hard', color: '#ec4899' }, // pink
            { name: 'Programmes', type: 'soft', color: '#0ea5e9' }, // sky
            { name: 'Services', type: 'soft', color: '#6366f1' }, // indigo
            { name: 'Promotions', type: 'soft', color: '#f43f5e' }, // rose
            { name: 'Workshops', type: 'soft', color: '#eab308' }, // yellow
            { name: 'Health Screenings', type: 'soft', color: '#14b8a6' }, // teal
        ]);

        // 2. Create Tags
        console.log('🏷️  Creating tags...');
        const createdTags = await db.insert(tags).values([
            { name: 'Healthcare' },
            { name: 'Fitness' },
            { name: 'Social' },
            { name: 'Day Care' },
            { name: 'Polyclinic' },
            { name: 'Gym' },
            { name: 'Community' },
            { name: 'Wellness' },
        ]).returning();

        const tagMap = {};
        createdTags.forEach(t => { tagMap[t.name] = t.id; });

        // 3. Create Hard Assets (Locations)
        console.log('📍 Creating hard assets (locations)...');
        const locations = await db.insert(hardAssets).values([
            {
                partnerId: partner4Id, // SATA CommHealth
                name: 'Toa Payoh Polyclinic',
                subCategory: 'Polyclinic',
                lat: '1.3328',
                lng: '103.8502',
                address: '2009 Lor 8 Toa Payoh, Singapore 319111',
                country: 'SG',
                postalCode: '319111',
                phone: '+65 6355 3000',
                hours: 'Mon-Fri 8am-4:30pm, Sat 8am-12:30pm',
                description: 'Comprehensive public healthcare services for general ailments and chronic conditions management.'
            },
            {
                partnerId: partner1Id, // FitLife
                name: 'Bishan Community Club',
                subCategory: 'Event Space',
                lat: '1.3491',
                lng: '103.8490',
                address: '51 Bishan Street 13, Singapore 579799',
                country: 'SG',
                postalCode: '579799',
                phone: '+65 6259 4720',
                hours: 'Daily 9am-10pm',
                description: 'A vibrant community hub focused on engaging seniors through arts, crafts, and social wellness programs.'
            },
            {
                partnerId: partner2Id, // Silver Fitness SG
                name: 'Jurong East ActiveSG Gym',
                subCategory: 'Gym',
                lat: '1.3465',
                lng: '103.7317',
                address: '21 Jurong East Street 31, Singapore 609626',
                country: 'SG',
                postalCode: '609626',
                phone: '+65 6563 5052',
                hours: 'Daily 7am-10pm',
                description: 'Public gym equipped with senior-friendly resistance machines and specialized active aging workout classes.'
            },
            {
                partnerId: partner3Id, // NTUC Health
                name: 'Bedok Senior Care Centre',
                subCategory: 'Day Care',
                lat: '1.3262',
                lng: '103.9328',
                address: 'Bedok North Street 2, Blk 211, Singapore 462211',
                country: 'SG',
                postalCode: '462211',
                phone: '+65 6442 1122',
                hours: 'Mon-Fri 9am-6pm',
                description: 'Day care center for seniors requiring daily nursing assistance and physiotherapy.'
            },
            {
                partnerId: partner3Id, // NTUC Health
                name: 'NTUC Health Day Centre (Taman Jurong)',
                subCategory: 'Day Care',
                lat: '1.3332',
                lng: '103.7222',
                address: 'Blk 116 Ho Ching Road, Singapore 618496',
                country: 'SG',
                postalCode: '618496',
                phone: '+65 6265 1251',
                hours: 'Mon-Fri 7:30am-6:30pm',
                description: 'Provides structured day care routines including meals, exercises, and social interactive games.'
            },
            {
                partnerId: partner1Id, // FitLife
                name: 'Ang Mo Kio Senior Activity Centre',
                subCategory: 'Active Ageing Centre',
                lat: '1.3693',
                lng: '103.8499',
                address: '53 Ang Mo Kio Ave 3, AMK Hub, Singapore 569922',
                country: 'SG',
                postalCode: '569922',
                phone: '+65 6455 1205',
                hours: 'Daily 8am-8pm',
                description: 'Community activity centre offering exercise classes, health screenings, and social gatherings for seniors.'
            }
        ]).returning();

        // 4. Tag the Hard Assets
        console.log('🏷️  Tagging locations...');
        await db.insert(hardAssetTags).values([
            { hardAssetId: locations[0].id, tagId: tagMap['Healthcare'] },
            { hardAssetId: locations[0].id, tagId: tagMap['Polyclinic'] },
            { hardAssetId: locations[1].id, tagId: tagMap['Social'] },
            { hardAssetId: locations[1].id, tagId: tagMap['Community'] },
            { hardAssetId: locations[2].id, tagId: tagMap['Fitness'] },
            { hardAssetId: locations[2].id, tagId: tagMap['Gym'] },
            { hardAssetId: locations[3].id, tagId: tagMap['Healthcare'] },
            { hardAssetId: locations[3].id, tagId: tagMap['Day Care'] },
            { hardAssetId: locations[4].id, tagId: tagMap['Day Care'] },
            { hardAssetId: locations[4].id, tagId: tagMap['Social'] },
            { hardAssetId: locations[5].id, tagId: tagMap['Wellness'] },
            { hardAssetId: locations[5].id, tagId: tagMap['Community'] },
        ]);

        // 5. Create Soft Assets (Programs)
        console.log('📋 Creating soft assets (programs)...');
        const programs = await db.insert(softAssets).values([
            {
                partnerId: partner4Id, // SATA
                name: 'Chronic Disease Management',
                subCategory: 'Programmes',
                description: 'Weekly group sessions on managing diabetes, hypertension, and high cholesterol. Includes free glucose monitoring.',
                schedule: 'Every Wednesday, 10am-12pm',
            },
            {
                partnerId: partner1Id, // FitLife
                name: 'Silver Canvas Art Class',
                subCategory: 'Workshops',
                description: 'Guided painting and watercolor sessions for seniors. All materials provided. Great for relaxation and creativity.',
                schedule: 'Tuesdays & Thursdays, 2pm-4pm',
            },
            {
                partnerId: partner2Id, // Silver Fitness SG
                name: 'Active Aging Strength Training',
                subCategory: 'Programmes',
                description: 'Low-impact strength and balance training designed specifically for seniors aged 55+. Certified trainers on-site.',
                schedule: 'Mon/Wed/Fri, 9am-10am',
            },
            {
                partnerId: partner3Id, // NTUC Health
                name: 'Daily Physiotherapy Sessions',
                subCategory: 'Services',
                description: 'One-on-one physiotherapy for seniors recovering from surgery or managing mobility issues.',
                schedule: 'Mon-Fri, 10am-4pm (by appointment)',
            },
            {
                partnerId: partner1Id, // FitLife
                name: 'Morning Tai Chi',
                subCategory: 'Programmes',
                description: 'Gentle Tai Chi sessions to improve balance, flexibility, and mental calmness. Open to all fitness levels.',
                schedule: 'Daily, 7:30am-8:30am',
            },
            {
                partnerId: partner4Id, // SATA
                name: 'Comprehensive Health Screening Package',
                subCategory: 'Health Screenings',
                description: 'Discounted monthly health screenings including blood pressure, BMI, and basic hearing tests for seniors.',
                schedule: 'First Saturday of every month, 9am-1pm',
            },
            {
                partnerId: partner2Id,
                name: 'Senior Discount: 50% Off Gym Pass',
                subCategory: 'Promotions',
                description: 'Get an active aging gym pass at half price! Valid for new members above 60.',
                schedule: 'Valid until December 2026',
            }
        ]).returning();

        // 5.5 Map Programs to Locations
        console.log('🔗 Linking programs to locations...');
        await db.insert(softAssetLocations).values([
            { softAssetId: programs[0].id, hardAssetId: locations[0].id }, // SATA -> Polyclinic
            { softAssetId: programs[1].id, hardAssetId: locations[1].id }, // FitLife -> Bishan
            { softAssetId: programs[2].id, hardAssetId: locations[2].id }, // Silver Fitness -> Jurong Gym
            { softAssetId: programs[3].id, hardAssetId: locations[3].id }, // NTUC -> Bedok
            { softAssetId: programs[3].id, hardAssetId: locations[4].id }, // NTUC -> Taman Jurong
            { softAssetId: programs[4].id, hardAssetId: locations[5].id }, // FitLife -> AMK Activity
            { softAssetId: programs[5].id, hardAssetId: locations[0].id }, // SATA -> Polyclinic
            { softAssetId: programs[6].id, hardAssetId: locations[2].id }, // Silver fitness promo at Gym
        ]);

        // 6. Tag the Soft Assets
        console.log('🏷️  Tagging programs...');
        await db.insert(softAssetTags).values([
            { softAssetId: programs[0].id, tagId: tagMap['Healthcare'] },
            { softAssetId: programs[0].id, tagId: tagMap['Wellness'] },
            { softAssetId: programs[1].id, tagId: tagMap['Social'] },
            { softAssetId: programs[1].id, tagId: tagMap['Community'] },
            { softAssetId: programs[2].id, tagId: tagMap['Fitness'] },
            { softAssetId: programs[2].id, tagId: tagMap['Wellness'] },
            { softAssetId: programs[3].id, tagId: tagMap['Healthcare'] },
            { softAssetId: programs[4].id, tagId: tagMap['Fitness'] },
            { softAssetId: programs[4].id, tagId: tagMap['Wellness'] },
            { softAssetId: programs[5].id, tagId: tagMap['Healthcare'] },
            { softAssetId: programs[5].id, tagId: tagMap['Community'] },
        ]);

        console.log('');
        console.log('✅ Seeding complete!');
        console.log('');
        console.log('📋 Demo Accounts:');
        console.log('   Admin:   admin@seniorcare.com / admin123');
        console.log('   Partner: fitlife@example.com  / partner123');
        console.log('   Partner: info@silverfitness.sg / partner123');
        console.log('   Partner: hello@ntuchealth.sg / partner123');
        console.log('   Partner: contact@sata.com.sg / partner123');
        console.log('');
        console.log(`📍 Created ${locations.length} locations and ${programs.length} offerings/programs`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seed();
