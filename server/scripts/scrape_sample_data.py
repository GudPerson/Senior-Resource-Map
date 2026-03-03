import json
import random

# Realistic Singapore Active Ageing Centres and Senior Care Facilities
SG_LOCATIONS = [
    {
        "property_name": "Lions Befrienders Active Ageing Centre (Clementi)",
        "address": "Blk 420A Clementi Ave 1",
        "zip_code": "121420",
        "community_area": "Clementi",
        "phone_number": "+65 6777 5881",
        "latitude": 1.3090,
        "longitude": 103.7686,
        "management_company": "Lions Befrienders Service Association",
        "property_type": "Active Ageing Centre"
    },
    {
        "property_name": "NTUC Health Senior Day Care (Jurong Spring)",
        "address": "Blk 527 Jurong West St 52",
        "zip_code": "640527",
        "community_area": "Jurong West",
        "phone_number": "+65 6316 9331",
        "latitude": 1.3482,
        "longitude": 103.7201,
        "management_company": "NTUC Health Co-operative",
        "property_type": "Day Care Centre"
    },
    {
        "property_name": "AWWA Dementia Day Care Centre (Ang Mo Kio)",
        "address": "Blk 123 Ang Mo Kio Ave 6",
        "zip_code": "560123",
        "community_area": "Ang Mo Kio",
        "phone_number": "+65 6511 5200",
        "latitude": 1.3739,
        "longitude": 103.8502,
        "management_company": "Asian Women's Welfare Association",
        "property_type": "Specialised Care"
    },
    {
        "property_name": "St. Luke's ElderCare (Hougang)",
        "address": "212 Hougang Street 21",
        "zip_code": "530212",
        "community_area": "Hougang",
        "phone_number": "+65 6282 1012",
        "latitude": 1.3585,
        "longitude": 103.8860,
        "management_company": "St. Luke's ElderCare Ltd",
        "property_type": "ElderCare Centre"
    },
    {
        "property_name": "TOUCH Active Ageing (Toa Payoh)",
        "address": "Blk 149 Toa Payoh Lorong 1",
        "zip_code": "310149",
        "community_area": "Toa Payoh",
        "phone_number": "+65 6251 3432",
        "latitude": 1.3323,
        "longitude": 103.8465,
        "management_company": "TOUCH Community Services",
        "property_type": "Active Ageing Centre"
    },
    {
        "property_name": "Fei Yue Active Ageing Centre (Bukit Batok)",
        "address": "Blk 183 Bukit Batok West Ave 8",
        "zip_code": "650183",
        "community_area": "Bukit Batok",
        "phone_number": "+65 6561 2341",
        "latitude": 1.3456,
        "longitude": 103.7432,
        "management_company": "Fei Yue Community Services",
        "property_type": "Active Ageing Centre"
    },
    {
        "property_name": "SARAH Seniors Activity Centre",
        "address": "Blk 105 Jalan Bukit Merah",
        "zip_code": "160105",
        "community_area": "Bukit Merah",
        "phone_number": "+65 6271 1230",
        "latitude": 1.2801,
        "longitude": 103.8275,
        "management_company": "Presbyterian Community Services",
        "property_type": "Activity Centre"
    },
    {
        "property_name": "Thye Hua Kwan Senior Care Centre (MacPherson)",
        "address": "Blk 91 MacPherson Ave",
        "zip_code": "360091",
        "community_area": "MacPherson",
        "phone_number": "+65 6745 5431",
        "latitude": 1.3289,
        "longitude": 103.8856,
        "management_company": "Thye Hua Kwan Moral Charities",
        "property_type": "Senior Care Centre"
    },
    {
        "property_name": "Vanguard Healthcare (Tampines Care Home)",
        "address": "299 Tampines Street 22",
        "zip_code": "529299",
        "community_area": "Tampines",
        "phone_number": "+65 6788 1290",
        "latitude": 1.3468,
        "longitude": 103.9515,
        "management_company": "Vanguard Healthcare",
        "property_type": "Nursing Home"
    },
    {
        "property_name": "Care Corner Active Ageing Centre (Woodlands)",
        "address": "Blk 567 Woodlands Drive 16",
        "zip_code": "730567",
        "community_area": "Woodlands",
        "phone_number": "+65 6363 4321",
        "latitude": 1.4320,
        "longitude": 103.7915,
        "management_company": "Care Corner Singapore",
        "property_type": "Active Ageing Centre"
    },
    {
        "property_name": "Active Ageing Hub (Tiong Bahru)",
        "address": "Blk 23 Tiong Bahru Rd",
        "zip_code": "163023",
        "community_area": "Tiong Bahru",
        "phone_number": "+65 6222 1345",
        "latitude": 1.2858,
        "longitude": 103.8315,
        "management_company": "Henderson-Dawson Constituency",
        "property_type": "Active Ageing Hub"
    },
    {
        "property_name": "Sree Narayana Mission Senior Care Centre (Yishun)",
        "address": "12 Yishun Ave 5",
        "zip_code": "768392",
        "community_area": "Yishun",
        "phone_number": "+65 6752 5214",
        "latitude": 1.4294,
        "longitude": 103.8350,
        "management_company": "Sree Narayana Mission",
        "property_type": "Senior Care Centre"
    },
    {
        "property_name": "Metta Day Rehabilitation Centre for the Elderly",
        "address": "32 Simei Street 1",
        "zip_code": "529950",
        "community_area": "Simei",
        "phone_number": "+65 6580 4688",
        "latitude": 1.3423,
        "longitude": 103.9518,
        "management_company": "Metta Welfare Association",
        "property_type": "Rehabilitation Centre"
    },
    {
        "property_name": "NTUC Health Nursing Home (Geylang East)",
        "address": "25 Geylang East Central",
        "zip_code": "389708",
        "community_area": "Geylang",
        "phone_number": "+65 6316 2341",
        "latitude": 1.3185,
        "longitude": 103.8872,
        "management_company": "NTUC Health Co-operative",
        "property_type": "Nursing Home"
    },
    {
        "property_name": "Lions Home for the Elders (Bishan)",
        "address": "9 Bishan Street 13",
        "zip_code": "579804",
        "community_area": "Bishan",
        "phone_number": "+65 6258 1234",
        "latitude": 1.3495,
        "longitude": 103.8505,
        "management_company": "Lions Clubs of Singapore",
        "property_type": "Nursing Home"
    },
    {
        "property_name": "O'Joy Care Services",
        "address": "Blk 5 Upper Boon Keng Road",
        "zip_code": "380005",
        "community_area": "Kallang",
        "phone_number": "+65 6386 2311",
        "latitude": 1.3135,
        "longitude": 103.8715,
        "management_company": "O'Joy Limited",
        "property_type": "Counselling Centre"
    },
    {
        "property_name": "Sunlove Senior Activity Centre",
        "address": "Blk 72 Chai Chee Street",
        "zip_code": "460072",
        "community_area": "Bedok",
        "phone_number": "+65 6445 1255",
        "latitude": 1.3255,
        "longitude": 103.9235,
        "management_company": "Sunlove Abode for Intellectually-Infirmed Ltd",
        "property_type": "Activity Centre"
    },
    {
        "property_name": "Radin Mas Active Ageing Centre",
        "address": "Blk 123 Bukit Merah View",
        "zip_code": "150123",
        "community_area": "Bukit Merah",
        "phone_number": "+65 6272 5432",
        "latitude": 1.2825,
        "longitude": 103.8220,
        "management_company": "Radin Mas Constituency",
        "property_type": "Active Ageing Centre"
    },
    {
        "property_name": "Orange Valley Nursing Home (Marsiling)",
        "address": "20 Marsiling Lane",
        "zip_code": "739152",
        "community_area": "Woodlands",
        "phone_number": "+65 6363 1256",
        "latitude": 1.4445,
        "longitude": 103.7758,
        "management_company": "Orange Valley Healthcare",
        "property_type": "Nursing Home"
    },
    {
        "property_name": "Ren Ci @ Ang Mo Kio",
        "address": "Ang Mo Kio Ave 8",
        "zip_code": "569812",
        "community_area": "Ang Mo Kio",
        "phone_number": "+65 6355 1321",
        "latitude": 1.3715,
        "longitude": 103.8485,
        "management_company": "Ren Ci Hospital",
        "property_type": "Nursing Home"
    }
]

def generate_programs(location_name):
    programs = [
        {"name": "Morning Tai Chi", "description": "Gentle Tai Chi session focusing on mobility and fall prevention.", "schedule": "Every Tuesday, 8:00 AM", "tags": ["Fitness", "Wellness", "Fall Prevention"]},
        {"name": "Digital Literacy for Seniors", "description": "Learn how to use Singpass, WhatsApp, and Zoom.", "schedule": "Thursdays, 2:00 PM - 4:00 PM", "tags": ["Education", "Technology", "SkillsFuture"]},
        {"name": "Rummikub & Mahjong Kaki", "description": "Weekly gathering for mental stimulation and socialization.", "schedule": "Fridays, 2:00 PM", "tags": ["Social", "Games", "Dementia Prevention"]},
        {"name": "Community Health Screening", "description": "Subsidised blood pressure, cholesterol, and diabetes screening.", "schedule": "First Monday of the month", "tags": ["Healthcare", "Screening"]},
        {"name": "Kopitiam Kopi Talk", "description": "Casual morning coffee sessions to chat and make friends.", "schedule": "Wednesdays, 10:30 AM", "tags": ["Social"]}
    ]
    # Pick 1 to 3 random programs
    selected = random.sample(programs, k=random.randint(1, 3))
    return selected

def format_assets():
    formatted = []
    
    for item in SG_LOCATIONS:
        # Hard Asset (Location)
        property_name = item.get("property_name")
        
        asset = {
            "name": property_name,
            "lat": item.get("latitude"),
            "lng": item.get("longitude"),
            "address": item.get("address", ""),
            "country": "SG",
            "postalCode": item.get("zip_code", ""),
            "phone": item.get("phone_number", ""),
            "hours": "Mon-Fri 9am-6pm", # Standardized SG operating hours
            "description": f"A dedicated {item.get('property_type').lower()} located in {item.get('community_area')}, managed by {item.get('management_company')}.",
            "tags": ["Senior Care", "Singapore", item.get("property_type")],
            "programs": generate_programs(property_name)
        }
        
        formatted.append(asset)
            
    return formatted

def main():
    try:
        assets = format_assets()
        output_file = "scripts/scraped_assets.json"
        with open(output_file, 'w') as f:
            json.dump(assets, f, indent=2)
            
        print(f"Successfully generated and formatted {len(assets)} SG Hard Assets (and nested Soft Assets).")
        print(f"Saved to {output_file}")
    except Exception as e:
        print(f"Error generating data: {e}")

if __name__ == "__main__":
    main()
