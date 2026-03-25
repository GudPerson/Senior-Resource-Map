import csv

subregion_id = 186
csv_path = '/Users/sweetbuns/Documents/New project/tmp/SG Postal codes.csv'
output_dir = '/Users/sweetbuns/Documents/New project/tmp/sql_batches/'

import os
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

with open(csv_path, 'r') as f:
    reader = csv.reader(f)
    next(reader) # skip header
    
    postal_codes = set()
    for row in reader:
        if len(row) >= 2:
            code = row[1].strip().zfill(6)
            postal_codes.add(code)
    
    codes_list = sorted(list(postal_codes))
    
    batch_size = 3000
    for i in range(0, len(codes_list), batch_size):
        batch = codes_list[i:i+batch_size]
        filename = f'batch_{i // batch_size}.sql'
        with open(os.path.join(output_dir, filename), 'w') as out:
            values = ", ".join([f"({subregion_id}, '{c}')" for c in batch])
            sql = f"INSERT INTO subregion_postal_codes (subregion_id, postal_code) VALUES {values} ON CONFLICT DO NOTHING;"
            out.write(sql)

print(f"Generated {len(codes_list) // batch_size + 1} batches.")
