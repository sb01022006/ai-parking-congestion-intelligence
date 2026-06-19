import http.server
import socketserver
import urllib.parse
import json
import sqlite3
import os

PORT = int(os.environ.get("PORT", 8000))
DB_PATH = os.path.join(os.path.dirname(__file__), "violations.db")

class PoliceViolationHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # Clean query params to single values
        filters = {k: v[0] for k, v in query_params.items()}

        if path.startswith("/api/"):
            self.handle_api(path, filters)
        else:
            self.handle_static(path)

    def handle_static(self, path):
        # Serve React frontend build files if they exist
        static_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
        if not os.path.exists(static_dir):
            # Fallback message if frontend not built yet
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h1>API Server is running</h1><p>Frontend is available via Vite dev server at http://localhost:5173</p>")
            return

        # Strip repository prefix if requesting from GitHub Pages-configured build
        prefix = "/ai-parking-congestion-intelligence"
        if path.startswith(prefix):
            path = path[len(prefix):]

        if path == "/" or path == "" or path == "/index.html":
            path = "/index.html"
            
        file_path = os.path.abspath(os.path.join(static_dir, path.lstrip("/")))
        
        # Security check to prevent directory traversal
        if not file_path.startswith(os.path.abspath(static_dir)):
            self.send_response(403)
            self.end_headers()
            return

        if os.path.exists(file_path) and os.path.isfile(file_path):
            self.send_response(200)
            # Content types
            if file_path.endswith(".html"):
                self.send_header("Content-type", "text/html")
            elif file_path.endswith(".js"):
                self.send_header("Content-type", "application/javascript")
            elif file_path.endswith(".css"):
                self.send_header("Content-type", "text/css")
            elif file_path.endswith(".json"):
                self.send_header("Content-type", "application/json")
            elif file_path.endswith(".png"):
                self.send_header("Content-type", "image/png")
            elif file_path.endswith(".jpg") or file_path.endswith(".jpeg"):
                self.send_header("Content-type", "image/jpeg")
            elif file_path.endswith(".svg"):
                self.send_header("Content-type", "image/svg+xml")
            else:
                self.send_header("Content-type", "application/octet-stream")
            
            self.end_headers()
            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            # Spa routing: redirect unmatched paths to index.html
            index_path = os.path.join(static_dir, "index.html")
            if os.path.exists(index_path):
                self.send_response(200)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                with open(index_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.end_headers()

    def handle_api(self, path, filters):
        conn = None
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            if path == "/api/stations":
                # Get list of police stations
                cursor.execute("""
                    SELECT police_station, COUNT(*) as count 
                    FROM violations 
                    GROUP BY police_station 
                    ORDER BY count DESC
                """)
                rows = cursor.fetchall()
                data = [{"station": r["police_station"], "count": r["count"]} for r in rows]
                self.send_json_response(200, data)

            elif path == "/api/violation_types":
                # Get unique violations list
                cursor.execute("""
                    SELECT primary_violation, COUNT(*) as count 
                    FROM violations 
                    GROUP BY primary_violation 
                    ORDER BY count DESC
                """)
                rows = cursor.fetchall()
                data = [{"violation": r["primary_violation"], "count": r["count"]} for r in rows]
                self.send_json_response(200, data)

            elif path == "/api/vehicle_types":
                # Get unique vehicles list
                cursor.execute("""
                    SELECT vehicle_type, COUNT(*) as count 
                    FROM violations 
                    GROUP BY vehicle_type 
                    ORDER BY count DESC
                """)
                rows = cursor.fetchall()
                data = [{"vehicle": r["vehicle_type"], "count": r["count"]} for r in rows]
                self.send_json_response(200, data)

            elif path == "/api/dashboard_stats":
                where_clause, params = self.build_where_clause(filters)
                
                # 1. Core KPIs
                cursor.execute(f"""
                    SELECT COUNT(*) as total_violations, AVG(congestion_score) as avg_congestion
                    FROM violations
                    {where_clause}
                """, params)
                kpi_row = cursor.fetchone()
                
                # Active priority zones count (grid cells rounded to 3 dec with score > 50)
                cursor.execute(f"""
                    SELECT COUNT(*) FROM (
                        SELECT ROUND(latitude, 3) as lat, ROUND(longitude, 3) as lon, SUM(congestion_score) as cell_score
                        FROM violations
                        {where_clause}
                        GROUP BY lat, lon
                        HAVING cell_score >= 10.0
                    )
                """, params)
                active_zones_count = cursor.fetchone()[0]

                # 2. Hourly Trend (IST)
                cursor.execute(f"""
                    SELECT hour_ist, COUNT(*) as count
                    FROM violations
                    {where_clause}
                    GROUP BY hour_ist
                    ORDER BY hour_ist
                """, params)
                hourly_rows = cursor.fetchall()
                hourly_trend = {r["hour_ist"]: r["count"] for r in hourly_rows}
                # fill all hours
                hourly_trend = [hourly_trend.get(h, 0) for h in range(24)]

                # 3. Day of Week Trend
                cursor.execute(f"""
                    SELECT day_of_week_ist, COUNT(*) as count
                    FROM violations
                    {where_clause}
                    GROUP BY day_of_week_ist
                """, params)
                day_rows = cursor.fetchall()
                day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                day_map = {r["day_of_week_ist"]: r["count"] for r in day_rows}
                day_trend = [{"day": d, "count": day_map.get(d, 0)} for d in day_order]

                # 4. Vehicle Type breakdown
                cursor.execute(f"""
                    SELECT vehicle_type, COUNT(*) as count, SUM(congestion_score) as total_congestion
                    FROM violations
                    {where_clause}
                    GROUP BY vehicle_type
                    ORDER BY count DESC
                    LIMIT 6
                """, params)
                vehicle_rows = cursor.fetchall()
                vehicle_dist = [{"vehicle": r["vehicle_type"], "count": r["count"], "congestion": round(r["total_congestion"], 1)} for r in vehicle_rows]

                # 5. Violation Type breakdown
                cursor.execute(f"""
                    SELECT primary_violation, COUNT(*) as count
                    FROM violations
                    {where_clause}
                    GROUP BY primary_violation
                    ORDER BY count DESC
                    LIMIT 6
                """, params)
                violation_rows = cursor.fetchall()
                violation_dist = [{"violation": r["primary_violation"], "count": r["count"]} for r in violation_rows]

                # Assemble dashboard stats
                data = {
                    "total_violations": kpi_row["total_violations"] or 0,
                    "avg_congestion": round(kpi_row["avg_congestion"] or 0.0, 3),
                    "active_priority_zones": active_zones_count,
                    "hourly_trend": hourly_trend,
                    "day_trend": day_trend,
                    "vehicle_dist": vehicle_dist,
                    "violation_dist": violation_dist
                }
                self.send_json_response(200, data)

            elif path == "/api/hotspots":
                where_clause, params = self.build_where_clause(filters)
                # Group by grid cell (~110m cells)
                cursor.execute(f"""
                    SELECT ROUND(latitude, 3) as lat, ROUND(longitude, 3) as lon, COUNT(*) as count, SUM(congestion_score) as score
                    FROM violations
                    {where_clause}
                    GROUP BY lat, lon
                    HAVING count >= 5
                    ORDER BY count DESC
                    LIMIT 2000
                """, params)
                rows = cursor.fetchall()
                data = [
                    {"latitude": r["lat"], "longitude": r["lon"], "count": r["count"], "congestion_score": round(r["score"], 1)}
                    for r in rows
                ]
                self.send_json_response(200, data)

            elif path == "/api/enforcement_plan":
                station = filters.get("station")
                if not station:
                    self.send_json_response(400, {"error": "Missing station parameter"})
                    return
                
                # Get top 8 hotspots for this station
                cursor.execute("""
                    SELECT ROUND(latitude, 4) as lat, ROUND(longitude, 4) as lon, 
                           COUNT(*) as count, SUM(congestion_score) as score,
                           GROUP_CONCAT(location, ' | ') as locations,
                           GROUP_CONCAT(primary_violation, ' | ') as violations,
                           GROUP_CONCAT(vehicle_type, ' | ') as vehicles
                    FROM violations
                    WHERE police_station = ?
                    GROUP BY lat, lon
                    ORDER BY score DESC
                    LIMIT 8
                """, (station,))
                rows = cursor.fetchall()
                
                hotspots = []
                for idx, r in enumerate(rows):
                    # Clean locations and find most common description
                    loc_list = [l.strip() for l in r["locations"].split('|') if l.strip()]
                    most_common_loc = max(set(loc_list), key=loc_list.count) if loc_list else "Unknown Location"
                    # Shorten address for clean display
                    if "," in most_common_loc:
                        most_common_loc = ", ".join(most_common_loc.split(",")[:3])
                    
                    # Clean violations
                    viol_list = [v.strip() for v in r["violations"].split('|') if v.strip()]
                    top_violation = max(set(viol_list), key=viol_list.count) if viol_list else "WRONG PARKING"
                    
                    # Clean vehicles
                    veh_list = [vh.strip() for vh in r["vehicles"].split('|') if vh.strip()]
                    top_vehicle = max(set(veh_list), key=veh_list.count) if veh_list else "CAR"

                    hotspots.append({
                        "id": idx + 1,
                        "latitude": r["lat"],
                        "longitude": r["lon"],
                        "location": most_common_loc,
                        "primary_violation": top_violation,
                        "primary_vehicle": top_vehicle,
                        "violation_count": r["count"],
                        "congestion_score": round(r["score"], 1)
                    })

                # Route optimization (nearest-neighbor)
                optimized_route = self.optimize_patrol_route(hotspots)

                data = {
                    "police_station": station,
                    "hotspots": hotspots,
                    "patrol_route": optimized_route
                }
                self.send_json_response(200, data)

            elif path == "/api/forecast":
                # Predict congestion based on day of week and hour
                station = filters.get("station", "Upparpet")
                day = filters.get("day", "Monday")
                hour = int(filters.get("hour", 9))

                # Query database to find historical counts in this specific hour/day vs. general average
                cursor.execute("""
                    SELECT COUNT(*) as count, AVG(congestion_score) as score
                    FROM violations
                    WHERE police_station = ? AND day_of_week_ist = ? AND hour_ist = ?
                """, (station, day, hour))
                cell = cursor.fetchone()
                
                cursor.execute("""
                    SELECT COUNT(*) / (7 * 24.0) as hourly_avg
                    FROM violations
                    WHERE police_station = ?
                """, (station,))
                station_avg = cursor.fetchone()[0] or 1.0

                count = cell["count"] or 0
                avg_score = cell["score"] or 0.0

                # Risk score based on count vs. average
                risk_multiplier = count / max(station_avg, 1.0)
                risk_score = min(100, int(risk_multiplier * 35))
                
                # Descriptions
                if risk_score > 75:
                    status = "CRITICAL RISK"
                    color = "#ef4444"
                elif risk_score > 45:
                    status = "MODERATE RISK"
                    color = "#f97316"
                else:
                    status = "LOW RISK"
                    color = "#10b981"

                # Get top violation and vehicle for this time
                cursor.execute("""
                    SELECT primary_violation, COUNT(*) as count
                    FROM violations
                    WHERE police_station = ? AND day_of_week_ist = ? AND hour_ist = ?
                    GROUP BY primary_violation
                    ORDER BY count DESC
                    LIMIT 1
                """, (station, day, hour))
                v_row = cursor.fetchone()
                top_violation = v_row["primary_violation"] if v_row else "WRONG PARKING"

                cursor.execute("""
                    SELECT vehicle_type, COUNT(*) as count
                    FROM violations
                    WHERE police_station = ? AND day_of_week_ist = ? AND hour_ist = ?
                    GROUP BY vehicle_type
                    ORDER BY count DESC
                    LIMIT 1
                """, (station, day, hour))
                vh_row = cursor.fetchone()
                top_vehicle = vh_row["vehicle_type"] if vh_row else "CAR"

                # Simulate recommended squad size
                recommended_squads = 1
                if risk_score > 75:
                    recommended_squads = 4
                elif risk_score > 55:
                    recommended_squads = 3
                elif risk_score > 35:
                    recommended_squads = 2

                data = {
                    "station": station,
                    "day": day,
                    "hour": hour,
                    "risk_score": risk_score,
                    "status": status,
                    "color": color,
                    "incident_count": count,
                    "avg_congestion_impact": round(avg_score, 2),
                    "predominant_violation": top_violation,
                    "predominant_vehicle": top_vehicle,
                    "recommended_squads": recommended_squads
                }
                self.send_json_response(200, data)

            else:
                self.send_json_response(404, {"error": "API route not found"})

        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json_response(500, {"error": str(e)})
        finally:
            if conn:
                conn.close()

    def build_where_clause(self, filters):
        clauses = []
        params = []
        
        station = filters.get("station")
        if station and station != "All Stations":
            clauses.append("police_station = ?")
            params.append(station)

        vehicle = filters.get("vehicle")
        if vehicle and vehicle != "All Vehicles":
            clauses.append("vehicle_type = ?")
            params.append(vehicle)

        violation = filters.get("violation")
        if violation and violation != "All Violations":
            clauses.append("primary_violation = ?")
            params.append(violation)
            
        hour = filters.get("hour")
        if hour:
            try:
                clauses.append("hour_ist = ?")
                params.append(int(hour))
            except ValueError:
                pass

        day = filters.get("day")
        if day and day != "All Days":
            clauses.append("day_of_week_ist = ?")
            params.append(day)

        # Build final clause
        where_clause = ""
        if clauses:
            where_clause = "WHERE " + " AND ".join(clauses)
            
        return where_clause, tuple(params)

    def optimize_patrol_route(self, hotspots):
        if not hotspots:
            return []
        
        # Greedy Nearest Neighbor
        unvisited = list(hotspots)
        # Start at the highest impact hotspot
        current = unvisited.pop(0)
        route = [current]
        
        while unvisited:
            nearest_idx = 0
            min_dist = float('inf')
            for idx, item in enumerate(unvisited):
                # Simple Euclidean distance squared
                dist = (item["latitude"] - current["latitude"])**2 + (item["longitude"] - current["longitude"])**2
                if dist < min_dist:
                    min_dist = dist
                    nearest_idx = idx
            
            current = unvisited.pop(nearest_idx)
            route.append(current)
            
        return route

    def send_json_response(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

if __name__ == "__main__":
    handler = PoliceViolationHandler
    # Enable socket reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"API Server listening on port {PORT}...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()
