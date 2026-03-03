#!/usr/bin/env python3
"""
Singapore Senior Facilities Scraper
====================================
Uses Google Places API (New) to search for all senior-related hard assets in Singapore.
Outputs both JSON (for seeding the database) and CSV (for spreadsheet review).

Categories searched:
  - Active Ageing Centres
  - Senior Day Care
  - Day Rehabilitation Centres
  - Nursing Homes
  - Senior Activity Centres
  - Community Hospitals
  - Polyclinics
  - Eldercare Centres
  - Hospices
  - Senior Care Centres

Required: Google Places API key (set as GOOGLE_PLACES_API_KEY env var or in .env)

Usage:
  pip install requests python-dotenv
  export GOOGLE_PLACES_API_KEY="your_key_here"
  python scrape_sg_senior_facilities.py
"""

import os
import sys
import json
import csv
import time
import hashlib
import requests
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional

# ─── Configuration ──────────────────────────────────────────────────────────────

API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

# Google Places API (New) endpoints
TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"

# Singapore bounding box for locationRestriction
SG_BOUNDS = {
    "rectangle": {
        "low": {"latitude": 1.1500, "longitude": 103.5900},   # SW corner
        "high": {"latitude": 1.4800, "longitude": 104.0500}   # NE corner
    }
}

# Singapore Planning Areas for granular searching
# This helps bypass Google's result caps by searching neighborhood-by-neighborhood
SG_AREAS = [
    "Ang Mo Kio", "Bedok", "Bishan", "Bukit Batok", "Bukit Merah", 
    "Bukit Panjang", "Bukit Timah", "Choa Chu Kang", "Clementi", 
    "Geylang", "Hougang", "Jurong East", "Jurong West", "Kallang", 
    "Marine Parade", "Novena", "Pasir Ris", "Punggol", "Queenstown", 
    "Sembawang", "Sengkang", "Serangoon", "Tampines", "Toa Payoh", 
    "Woodlands", "Yishun", "Tiong Bahru", "Chinatown", "Little India",
    "Kovan", "Potong Pasir", "Mountbatten"
]

# Search queries grouped by subcategory
SEARCH_QUERIES = [
    # Active Ageing / Senior Activity
    {"query": "Active Ageing Centre", "subCategory": "Active Ageing Centre"},
    {"query": "AAC senior", "subCategory": "Active Ageing Centre"},
    {"query": "Senior Activity Centre", "subCategory": "Active Ageing Centre"},
    
    # Day Care
    {"query": "Senior Day Care", "subCategory": "Day Care"},
    {"query": "Eldercare Centre", "subCategory": "Day Care"},
    
    # Nursing Homes & Rehab
    {"query": "Nursing Home", "subCategory": "Nursing Home"},
    {"query": "Day Rehabilitation Centre", "subCategory": "Day Rehabilitation"},
    
    # Health & Social
    {"query": "Polyclinic", "subCategory": "Polyclinic"},
    {"query": "HCA Hospice", "subCategory": "Hospice"},
    {"query": "Community Hospital", "subCategory": "Community Hospital"}
]

# Fields to request from Google Places API (New)
# See: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.addressComponents",
    "places.location",
    "places.internationalPhoneNumber",
    "places.nationalPhoneNumber",
    "places.regularOpeningHours",
    "places.websiteUri",
    "places.googleMapsUri",
    "places.types",
    "places.editorialSummary",
    "places.primaryTypeDisplayName",
    "places.shortFormattedAddress",
])

DETAIL_FIELD_MASK = ",".join([
    "id",
    "displayName",
    "formattedAddress",
    "addressComponents",
    "location",
    "internationalPhoneNumber",
    "nationalPhoneNumber",
    "regularOpeningHours",
    "websiteUri",
    "googleMapsUri",
    "types",
    "editorialSummary",
    "primaryTypeDisplayName",
    "shortFormattedAddress",
])


# ─── API Functions ──────────────────────────────────────────────────────────────

def search_places(query, sub_category, page_token=None):
    """Search for places using Google Places API (New) Text Search."""
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }
    
    body = {
        "textQuery": query,
        "locationRestriction": SG_BOUNDS,
        "languageCode": "en",
        "maxResultCount": 20,
    }
    
    if page_token:
        body["pageToken"] = page_token
    
    try:
        response = requests.post(TEXT_SEARCH_URL, headers=headers, json=body, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data
    except requests.exceptions.RequestException as e:
        print(f"  ❌ API error for query '{query}': {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"     Response: {e.response.text[:500]}")
        return None


def get_place_details(place_id):
    """Get detailed information for a specific place."""
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": DETAIL_FIELD_MASK,
    }
    
    url = PLACE_DETAILS_URL.format(place_id=place_id)
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Details API error for {place_id}: {e}")
        return None


# ─── Data Extraction Helpers ────────────────────────────────────────────────────

def extract_postal_code(place):
    """Extract Singapore postal code from address components."""
    components = place.get("addressComponents", [])
    for comp in components:
        types = comp.get("types", [])
        if "postal_code" in types:
            return comp.get("longText", "")
    
    # Fallback: try to extract 6-digit postal code from formatted address
    import re
    address = place.get("formattedAddress", "")
    match = re.search(r'\b(\d{6})\b', address)
    if match:
        return match.group(1)
    
    return ""


def extract_hours(place):
    """Extract formatted opening hours string."""
    hours_data = place.get("regularOpeningHours", {})
    
    # Try weekday descriptions first (most human-readable)
    descriptions = hours_data.get("weekdayDescriptions", [])
    if descriptions:
        return "; ".join(descriptions)
    
    # Fallback to periods
    periods = hours_data.get("periods", [])
    if periods:
        days_map = {0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat"}
        parts = []
        for period in periods:
            open_info = period.get("open", {})
            close_info = period.get("close", {})
            day = days_map.get(open_info.get("day", 0), "?")
            open_time = f"{open_info.get('hour', 0):02d}:{open_info.get('minute', 0):02d}"
            close_time = f"{close_info.get('hour', 0):02d}:{close_info.get('minute', 0):02d}" if close_info else "?"
            parts.append(f"{day} {open_time}-{close_time}")
        return "; ".join(parts)
    
    return ""


def build_description(place):
    """Build a description including editorial summary and website URL."""
    parts = []
    
    # Editorial summary
    summary = place.get("editorialSummary", {})
    if isinstance(summary, dict):
        text = summary.get("text", "")
        if text:
            parts.append(text)
    elif isinstance(summary, str) and summary:
        parts.append(summary)
    
    # Primary type
    primary_type = place.get("primaryTypeDisplayName", {})
    if isinstance(primary_type, dict):
        type_text = primary_type.get("text", "")
        if type_text and not any(type_text.lower() in p.lower() for p in parts):
            parts.append(f"Type: {type_text}")
    
    # Website URL
    website = place.get("websiteUri", "")
    if website:
        parts.append(f"Website: {website}")
    
    # Google Maps link as fallback
    maps_uri = place.get("googleMapsUri", "")
    if maps_uri and not website:
        parts.append(f"Google Maps: {maps_uri}")
    
    return " | ".join(parts) if parts else ""


def parse_place(place, sub_category):
    """Parse a Google Places API result into our schema format."""
    display_name = place.get("displayName", {})
    name = display_name.get("text", "") if isinstance(display_name, dict) else str(display_name)
    
    location = place.get("location", {})
    lat = location.get("latitude", 0)
    lng = location.get("longitude", 0)
    
    # Get phone - prefer international format
    phone = place.get("internationalPhoneNumber", "") or place.get("nationalPhoneNumber", "")
    
    return {
        "googlePlaceId": place.get("id", ""),
        "name": name,
        "subCategory": sub_category,
        "lat": lat,
        "lng": lng,
        "address": place.get("formattedAddress", ""),
        "country": "SG",
        "postalCode": extract_postal_code(place),
        "phone": phone,
        "hours": extract_hours(place),
        "description": build_description(place),
    }


# ─── Main Scraping Logic ───────────────────────────────────────────────────────

def deduplicate_results(all_results):
    """Deduplicate results based on Google Place ID, keeping first occurrence."""
    seen_ids = set()
    unique = []
    
    for item in all_results:
        place_id = item.get("googlePlaceId", "")
        if place_id and place_id not in seen_ids:
            seen_ids.add(place_id)
            unique.append(item)
        elif not place_id:
            # Fallback dedup by name + postal code
            key = f"{item['name']}_{item['postalCode']}"
            if key not in seen_ids:
                seen_ids.add(key)
                unique.append(item)
    
    return unique


def run_scraper():
    """Main scraper entry point."""
    if not API_KEY:
        # ... (error handling remains same)
        sys.exit(1)
    
    print("=" * 70)
    print("🔍  Singapore Senior Facilities DEEP SCRAPER")
    print(f"    Searching {len(SG_AREAS)} neighborhoods x {len(SEARCH_QUERIES)} categories...")
    print(f"    Total target combinations: {len(SG_AREAS) * len(SEARCH_QUERIES)}")
    print(f"    Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    print()
    
    all_results = []
    total_api_calls = 0
    combinations_processed = 0
    
    for area in SG_AREAS:
        print(f"\n🏘️  Focusing on: {area.upper()}")
        print("-" * 30)
        
        for search in SEARCH_QUERIES:
            query = f"{search['query']} {area}"
            sub_cat = search["subCategory"]
            combinations_processed += 1
            
            print(f"[{combinations_processed}/{len(SG_AREAS) * len(SEARCH_QUERIES)}] 🔎 Searching: \"{query}\"")
            
            page_token = None
            page_count = 0
            
            while True:
                data = search_places(query, sub_cat, page_token)
                total_api_calls += 1
                
                if not data or "places" not in data:
                    break
                
                places = data.get("places", [])
                page_count += 1
                
                for place in places:
                    parsed = parse_place(place, sub_cat)
                    all_results.append(parsed)
                
                print(f"   📍 Found {len(places)} places")
                
                # Check for next page
                page_token = data.get("nextPageToken")
                if not page_token:
                    break
                
                time.sleep(1.0) # Rate limiting
            
            time.sleep(0.3)
    
    print()
    print(f"📊 Raw results: {len(all_results)} total entries")
    
    # Deduplicate
    unique_results = deduplicate_results(all_results)
    print(f"✨ After deduplication: {len(unique_results)} unique places")
    
    # Sort by subCategory then name
    unique_results.sort(key=lambda x: (x["subCategory"], x["name"]))
    
    return unique_results


def enrich_with_details(results, max_enrichments=None):
    """Optionally enrich results with Place Details API for more data."""
    if max_enrichments is None:
        max_enrichments = len(results)  # Enrich all by default
    
    enriched_count = 0
    for i, item in enumerate(results):
        if enriched_count >= max_enrichments:
            break
        
        # Only enrich if missing key data
        if item["phone"] and item["hours"] and item["description"]:
            continue
        
        place_id = item.get("googlePlaceId", "")
        if not place_id:
            continue
        
        print(f"  🔄 Enriching [{i+1}/{len(results)}]: {item['name'][:50]}...")
        details = get_place_details(place_id)
        
        if details:
            # Fill in missing fields
            if not item["phone"]:
                item["phone"] = details.get("internationalPhoneNumber", "") or details.get("nationalPhoneNumber", "")
            
            if not item["hours"]:
                item["hours"] = extract_hours(details)
            
            if not item["description"]:
                item["description"] = build_description(details)
            
            if not item["postalCode"]:
                item["postalCode"] = extract_postal_code(details)
            
            enriched_count += 1
        
        time.sleep(0.3)  # Rate limiting
    
    if enriched_count > 0:
        print(f"  ✅ Enriched {enriched_count} places with additional details")


def save_results(results):
    """Save results to JSON and CSV files."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # ─── Save JSON (for database seeding) ───
    json_file = os.path.join(script_dir, "sg_senior_facilities.json")
    
    # Remove googlePlaceId from the JSON output (not needed for DB)
    clean_results = []
    for r in results:
        clean = {k: v for k, v in r.items() if k != "googlePlaceId"}
        clean_results.append(clean)
    
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(clean_results, f, indent=2, ensure_ascii=False)
    print(f"💾 JSON saved: {json_file}")
    
    # ─── Save CSV (for spreadsheet review) ───
    csv_file = os.path.join(script_dir, f"sg_senior_facilities.csv")
    
    fieldnames = ["name", "subCategory", "address", "postalCode", "phone", "hours", "description"]
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for r in results:
            writer.writerow(r)
    print(f"📄 CSV saved: {csv_file}")
    
    # ─── Save full JSON with Place IDs (for reference/debugging) ───
    full_json_file = os.path.join(script_dir, f"sg_senior_facilities_full.json")
    with open(full_json_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"📋 Full JSON (with Place IDs): {full_json_file}")
    
    # ─── Print summary stats ───
    print()
    print("=" * 70)
    print("📊  SUMMARY BY CATEGORY")
    print("=" * 70)
    
    category_counts = {}
    for r in results:
        cat = r["subCategory"]
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    for cat in sorted(category_counts.keys()):
        count = category_counts[cat]
        bar = "█" * min(count, 40)
        print(f"  {cat:<25} {count:>4}  {bar}")
    
    print(f"  {'─' * 25}  {'─' * 4}")
    print(f"  {'TOTAL':<25} {len(results):>4}")
    print()
    
    # ─── Data completeness report ───
    print("📋  DATA COMPLETENESS")
    print("=" * 70)
    fields_to_check = ["phone", "hours", "description", "postalCode"]
    for field in fields_to_check:
        filled = sum(1 for r in results if r.get(field))
        pct = (filled / len(results) * 100) if results else 0
        bar = "█" * int(pct / 2.5)
        print(f"  {field:<15} {filled:>4}/{len(results)}  ({pct:.0f}%)  {bar}")
    print()


# ─── Entry Point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    results = run_scraper()
    
    if results:
        # Enrich places that are missing phone/hours/description
        print()
        print("🔄 Enriching results with Place Details API...")
        enrich_with_details(results)
        
        save_results(results)
        
        print(f"✅ Done! Scraped {len(results)} senior facilities in Singapore.")
        print()
        print("Next steps:")
        print("  1. Review the CSV in a spreadsheet")
        print("  2. Run the seed script to import into the database:")
        print("     node server/scripts/seed_sg_facilities.js")
    else:
        print("❌ No results found. Check your API key and internet connection.")
