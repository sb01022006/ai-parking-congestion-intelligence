import csv
import json
import sqlite3
import os
from datetime import datetime, timedelta

db_path = os.path.join(os.path.dirname(__file__), "violations.db")

# Split CSV parts
csv_paths = [
    os.path.join(os.path.dirname(__file__), "jan to may police violation_part1.csv"),
    os.path.join(os.path.dirname(__file__), "jan to may police violation_part2.csv")
]

# Remove existing database if it exists to import cleanly
if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create tables
cursor.execute("""
CREATE TABLE IF NOT EXISTS violations (
    id TEXT PRIMARY KEY,
    latitude REAL,
    longitude REAL,
    location TEXT,
    vehicle_type TEXT,
    violation_type TEXT,
    primary_violation TEXT,
    police_station TEXT,
    created_datetime_utc TEXT,
    created_datetime_ist TEXT,
    hour_ist INTEGER,
    day_of_week_ist TEXT,
    month_ist INTEGER,
    congestion_score REAL
);
""")

# Indexes for performance
cursor.execute("CREATE INDEX IF NOT EXISTS idx_police_station ON violations(police_station);")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_coords ON violations(latitude, longitude);")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_hour ON violations(hour_ist);")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_day ON violations(day_of_week_ist);")

VEHICLE_WEIGHTS = {
    "CAR": 0.7,
    "SCOOTER": 0.2,
    "MOTOR CYCLE": 0.2,
    "PASSENGER AUTO": 0.4,
    "MAXI-CAB": 0.6,
    "LGV": 0.8,
    "GOODS AUTO": 0.5,
    "MOPED": 0.1,
    "PRIVATE BUS": 1.0,
    "VAN": 0.6,
    "TRACTOR": 0.5,
    "HEAVY GOODS VEHICLE": 1.0,
    "AUTO": 0.4,
}

VIOLATION_WEIGHTS = {
    "PARKING IN A MAIN ROAD": 1.0,
    "DOUBLE PARKING": 0.9,
    "PARKING NEAR ROAD CROSSING": 0.8,
    "PARKING ON FOOTPATH": 0.7,
    "WRONG PARKING": 0.6,
    "NO PARKING": 0.4,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 0.6,
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS": 0.8,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 0.8,
    "PARKING OTHER THAN BUS STOP": 0.5,
    "OBSTRUCTING DRIVER": 0.4,
    "DEFECTIVE NUMBER PLATE": 0.05,
    "USING BLACK FILM/OTHER MATERIALS": 0.05,
    "REFUSE TO GO FOR HIRE": 0.1,
    "DEMANDING EXCESS FARE": 0.1,
    "WITHOUT SIDE MIRROR": 0.05,
    "H T V PROHIBITED": 0.5,
    "AGAINST ONE WAY/NO ENTRY": 0.6,
    "FAIL TO USE SAFETY BELTS": 0.05,
    "VIOLATING LANE DISIPLINE": 0.4,
}

def get_congestion_score(vehicle_type, violation_list, hour):
    v_weight = VEHICLE_WEIGHTS.get(vehicle_type, 0.4)
    
    viol_weight = 0.3
    if violation_list:
        weights = [VIOLATION_WEIGHTS.get(v, 0.3) for v in violation_list]
        viol_weight = max(weights) if weights else 0.3
        
    base_score = v_weight * viol_weight
    
    hour_multiplier = 1.0
    if hour in [8, 9, 10, 11]:
        hour_multiplier = 1.3
    elif hour in [17, 18, 19, 20]:
        hour_multiplier = 1.5
    elif hour in [23, 0, 1, 2, 3, 4, 5]:
        hour_multiplier = 0.6
        
    return base_score * hour_multiplier

batch = []
batch_size = 50000
total_records = 0

print("Importing data from split CSV files...")
for csv_path in csv_paths:
    if not os.path.exists(csv_path):
        print(f"Warning: File {csv_path} not found. Skipping...")
        continue
        
    print(f"Reading {os.path.basename(csv_path)}...")
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            v_id = row.get('id')
            lat_str = row.get('latitude')
            lon_str = row.get('longitude')
            location = row.get('location')
            vehicle_type = row.get('vehicle_type', 'CAR')
            violation_type_str = row.get('violation_type', '[]')
            police_station = row.get('police_station', 'Unknown')
            created_datetime_utc = row.get('created_datetime')
            
            try:
                lat = float(lat_str)
                lon = float(lon_str)
            except (ValueError, TypeError):
                continue
                
            violation_list = []
            try:
                violation_list = json.loads(violation_type_str)
                if not isinstance(violation_list, list):
                    violation_list = [str(violation_list)]
            except Exception:
                violation_list = [violation_type_str]
                
            primary_violation = violation_list[0] if violation_list else "Unknown"
            
            hour_ist = 0
            day_of_week_ist = "Monday"
            month_ist = 1
            created_datetime_ist = ""
            if created_datetime_utc:
                try:
                    dt_part = created_datetime_utc.split('+')[0]
                    dt_utc = datetime.strptime(dt_part, "%Y-%m-%d %H:%M:%S")
                    dt_ist = dt_utc + timedelta(hours=5, minutes=30)
                    created_datetime_ist = dt_ist.strftime("%Y-%m-%d %H:%M:%S")
                    hour_ist = dt_ist.hour
                    day_of_week_ist = dt_ist.strftime("%A")
                    month_ist = dt_ist.month
                except Exception:
                    created_datetime_ist = created_datetime_utc
                    
            congestion_score = get_congestion_score(vehicle_type, violation_list, hour_ist)
            
            batch.append((
                v_id, lat, lon, location, vehicle_type, violation_type_str, primary_violation,
                police_station, created_datetime_utc, created_datetime_ist, hour_ist,
                day_of_week_ist, month_ist, congestion_score
            ))
            
            total_records += 1
            
            if len(batch) >= batch_size:
                cursor.executemany("""
                INSERT INTO violations (
                    id, latitude, longitude, location, vehicle_type, violation_type, primary_violation,
                    police_station, created_datetime_utc, created_datetime_ist, hour_ist,
                    day_of_week_ist, month_ist, congestion_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, batch)
                conn.commit()
                print(f"Imported {total_records} records...")
                batch = []

if batch:
    cursor.executemany("""
    INSERT INTO violations (
        id, latitude, longitude, location, vehicle_type, violation_type, primary_violation,
        police_station, created_datetime_utc, created_datetime_ist, hour_ist,
        day_of_week_ist, month_ist, congestion_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, batch)
    conn.commit()
    print(f"Imported final batch. Total records: {total_records}")

# Check the final count in the database
cursor.execute("SELECT COUNT(*) FROM violations")
db_count = cursor.fetchone()[0]
print(f"Verify database: {db_count} records inserted successfully.")

# Check coordinate bounding box
cursor.execute("SELECT MIN(latitude), MAX(latitude), MIN(longitude), MAX(longitude) FROM violations")
bbox = cursor.fetchone()
print(f"Coordinate bounds in DB: Lat {bbox[0]} to {bbox[1]}, Lon {bbox[2]} to {bbox[3]}")

conn.close()
print("Done!")
