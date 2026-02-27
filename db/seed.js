import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import db from './index.js';
import { users, resources } from './schema.js';

async function seed() {
    console.log('🌱 Starting database seed...');

    try {
        // Clear existing data
        console.log('🧹 Clearing existing data...');
        await db.delete(resources);
        await db.delete(users);

        // 1. Create Users
        console.log('👤 Creating users...');
        const adminPasswordHash = await bcrypt.hash('admin123', 12);
        const partnerPasswordHash = await bcrypt.hash('partner123', 12);

        const createdUsers = await db.insert(users).values([
            {
                email: 'admin@seniorcare.sg',
                passwordHash: adminPasswordHash,
                name: 'System Admin',
                role: 'admin',
                phone: '+65 6123 4567'
            },
            {
                email: 'contact@sgactiveaging.org',
                passwordHash: partnerPasswordHash,
                name: 'SG Active Aging Hub',
                role: 'partner',
                phone: '+65 6888 9999'
            },
            {
                email: 'info@silverfitness.sg',
                passwordHash: partnerPasswordHash,
                name: 'Silver Fitness SG',
                role: 'partner',
                phone: '+65 6777 8888'
            }
        ]).returning();

        const partner1Id = createdUsers[1].id;
        const partner2Id = createdUsers[2].id;

        // 2. Create Resources (Singapore Focused)
        console.log('🏥 Creating resources...');
        const sgResources = [
            {
                partnerId: partner1Id,
                name: 'Toa Payoh Polyclinic',
                category: 'Healthcare',
                country: 'SG',
                postalCode: '319111',
                lat: '1.3328',
                lng: '103.8502',
                address: '2009 Lor 8 Toa Payoh',
                phone: '+65 6355 3000',
                hours: 'Mon-Fri 8am-4:30pm, Sat 8am-12:30pm',
                description: 'Comprehensive public healthcare services for general ailments and chronic conditions management.'
            },
            {
                partnerId: partner1Id,
                name: 'Silver Generation Community Club (Bishan)',
                category: 'Social',
                country: 'SG',
                postalCode: '579799',
                lat: '1.3491',
                lng: '103.8490',
                address: '51 Bishan Street 13',
                phone: '+65 6259 4720',
                hours: 'Daily 9am-10pm',
                description: 'A vibrant community hub focused on engaging seniors through arts, crafts, and social wellness programs.'
            },
            {
                partnerId: partner2Id,
                name: 'Jurong East ActiveSG Gym',
                category: 'Fitness',
                country: 'SG',
                postalCode: '609626',
                lat: '1.3465',
                lng: '103.7317',
                address: '21 Jurong East Street 31',
                phone: '+65 6563 5052',
                hours: 'Daily 7am-10pm',
                description: 'Public gym equipped with senior-friendly resistance machines and specialized active aging workout classes.'
            },
            {
                partnerId: partner2Id,
                name: 'Bedok Senior Care Centre',
                category: 'Healthcare',
                country: 'SG',
                postalCode: '462211',
                lat: '1.3262',
                lng: '103.9328',
                address: 'Bedok North Street 2, Blk 211',
                phone: '+65 6442 1122',
                hours: 'Mon-Fri 9am-6pm',
                description: 'Day care center for seniors requiring daily nursing assistance and physiotherapy.'
            },
            {
                partnerId: partner1Id,
                name: 'NTUC Health Day Centre (Taman Jurong)',
                category: 'Social',
                country: 'SG',
                postalCode: '618496',
                lat: '1.3332',
                lng: '103.7222',
                address: 'Blk 116 Ho Ching Road',
                phone: '+65 6265 1251',
                hours: 'Mon-Fri 7:30am-6:30pm',
                description: 'Provides structured day care routines including meals, exercises, and social interactive games.'
            },
            {
                partnerId: partner2Id,
                name: 'Seniors Discount - FairPrice Xtra (Ang Mo Kio)',
                category: 'Promotions',
                country: 'SG',
                postalCode: '569922',
                lat: '1.3693',
                lng: '103.8499',
                address: '53 Ang Mo Kio Ave 3, AMK Hub',
                phone: '+65 6455 1205',
                hours: 'Daily 8am-10:30pm',
                description: '3% discount for Pioneer and Merdeka generation cards every Tuesday and Wednesday.'
            }
        ];

        await db.insert(resources).values(sgResources);

        console.log('✅ Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seed();
