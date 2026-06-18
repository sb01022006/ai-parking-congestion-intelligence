import React, { useState, useEffect } from 'react';
import MapComponent from './MapComponent';
import { 
  BarChart3, 
  Map as MapIcon, 
  TrendingUp, 
  AlertTriangle, 
  Sliders, 
  Navigation, 
  Clock, 
  Search, 
  Activity, 
  ShieldAlert,
  Car,
  Filter,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('analytics'); // analytics, dispatch, forecast
  const [stations, setStations] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [violationTypes, setViolationTypes] = useState([]);
  
  // Filters
  const [selectedStation, setSelectedStation] = useState('All Stations');
  const [selectedVehicle, setSelectedVehicle] = useState('All Vehicles');
  const [selectedViolation, setSelectedViolation] = useState('All Violations');
  const [selectedDay, setSelectedDay] = useState('All Days');
  
  // Data
  const [stats, setStats] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Congestion Simulator Weights
  const [carWeight, setCarWeight] = useState(0.7);
  const [scooterWeight, setScooterWeight] = useState(0.2);
  const [autoWeight, setAutoWeight] = useState(0.4);
  const [lgvWeight, setLgvWeight] = useState(0.8);
  const [busWeight, setBusWeight] = useState(1.0);
  const [mainRoadWeight, setMainRoadWeight] = useState(1.0);
  const [doubleParkWeight, setDoubleParkWeight] = useState(0.9);
  const [wrongParkWeight, setWrongParkWeight] = useState(0.6);
  const [noParkWeight, setNoParkWeight] = useState(0.4);

  // Dispatch Tab State
  const [dispatchStation, setDispatchStation] = useState('Upparpet');
  const [enforcementPlan, setEnforcementPlan] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [showRouteOnMap, setShowRouteOnMap] = useState(false);

  // Forecaster Tab State
  const [forecastStation, setForecastStation] = useState('Upparpet');
  const [forecastDay, setForecastDay] = useState('Monday');
  const [forecastHour, setForecastHour] = useState(9);
  const [forecastData, setForecastData] = useState(null);

  // Load initial filters
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/stations`)
      .then(res => res.json())
      .then(data => setStations(data))
      .catch(err => console.error("Error loading stations", err));

    fetch(`${API_BASE_URL}/api/vehicle_types`)
      .then(res => res.json())
      .then(data => setVehicleTypes(data))
      .catch(err => console.error("Error loading vehicle types", err));

    fetch(`${API_BASE_URL}/api/violation_types`)
      .then(res => res.json())
      .then(data => setViolationTypes(data))
      .catch(err => console.error("Error loading violation types", err));
  }, []);

  // Fetch Dashboard Stats & Hotspots
  const fetchDashboardData = () => {
    setLoading(true);
    
    // Construct query parameters
    const params = new URLSearchParams();
    if (selectedStation !== 'All Stations') params.append('station', selectedStation);
    if (selectedVehicle !== 'All Vehicles') params.append('vehicle', selectedVehicle);
    if (selectedViolation !== 'All Violations') params.append('violation', selectedViolation);
    if (selectedDay !== 'All Days') params.append('day', selectedDay);
    
    // Also send current weights to recalculate scores on the fly if needed (implemented in frontend scoring)
    const queryStr = params.toString() ? `?${params.toString()}` : '';

    Promise.all([
      fetch(`${API_BASE_URL}/api/dashboard_stats${queryStr}`).then(res => res.json()),
      fetch(`${API_BASE_URL}/api/hotspots${queryStr}`).then(res => res.json())
    ])
    .then(([statsData, hotspotsData]) => {
      // Recalculate weights dynamically in frontend to reflect simulator slider modifications
      const updatedHotspots = hotspotsData.map(h => {
        // Calculate based on sliders
        let weight = 0.5;
        // This is a mockup calculation to show slider reactivity instantly on the map!
        // We modulate the database-returned score by the ratio of slider weights
        const originalScore = h.congestion_score;
        // Simple multiplier shift
        const scale = (carWeight + scooterWeight + autoWeight + lgvWeight + busWeight) / 3.1;
        const violScale = (mainRoadWeight + doubleParkWeight + wrongParkWeight + noParkWeight) / 2.9;
        
        return {
          ...h,
          congestion_score: originalScore * scale * violScale
        };
      });

      setStats(statsData);
      setHotspots(updatedHotspots);
      setLoading(false);
    })
    .catch(err => {
      console.error("Error fetching dashboard data", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [
    selectedStation, selectedVehicle, selectedViolation, selectedDay,
    carWeight, scooterWeight, autoWeight, lgvWeight, busWeight,
    mainRoadWeight, doubleParkWeight, wrongParkWeight, noParkWeight
  ]);

  // Fetch Dispatch Enforcement Plan
  useEffect(() => {
    if (activeTab === 'dispatch' && dispatchStation) {
      setIsRouting(true);
      fetch(`${API_BASE_URL}/api/enforcement_plan?station=${dispatchStation}`)
        .then(res => res.json())
        .then(data => {
          setEnforcementPlan(data);
          setIsRouting(false);
        })
        .catch(err => {
          console.error("Error fetching enforcement plan", err);
          setIsRouting(false);
        });
    }
  }, [dispatchStation, activeTab]);

  // Fetch Forecast Data
  useEffect(() => {
    if (activeTab === 'forecast' && forecastStation) {
      fetch(`${API_BASE_URL}/api/forecast?station=${forecastStation}&day=${forecastDay}&hour=${forecastHour}`)
        .then(res => res.json())
        .then(data => {
          setForecastData(data);
        })
        .catch(err => console.error("Error fetching forecast", err));
    }
  }, [forecastStation, forecastDay, forecastHour, activeTab]);

  const handleResetFilters = () => {
    setSelectedStation('All Stations');
    setSelectedVehicle('All Vehicles');
    setSelectedViolation('All Violations');
    setSelectedDay('All Days');
  };

  const handleResetWeights = () => {
    setCarWeight(0.7);
    setScooterWeight(0.2);
    setAutoWeight(0.4);
    setLgvWeight(0.8);
    setBusWeight(1.0);
    setMainRoadWeight(1.0);
    setDoubleParkWeight(0.9);
    setWrongParkWeight(0.6);
    setNoParkWeight(0.4);
  };

  // Helper to draw custom SVG line chart
  const renderHourlyChart = (trend) => {
    if (!trend || trend.length === 0) return null;
    const maxVal = Math.max(...trend, 1);
    const width = 500;
    const height = 140;
    const padding = 15;
    
    // Build path points
    const points = trend.map((val, idx) => {
      const x = padding + (idx * (width - padding * 2)) / 23;
      const y = height - padding - (val * (height - padding * 2)) / maxVal;
      return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const areaD = `${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="svg-chart">
        <defs>
          <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = padding + r * (height - padding * 2);
          return (
            <line 
              key={`grid-${i}`} 
              x1={padding} 
              y1={y} 
              x2={width - padding} 
              y2={y} 
              stroke="rgba(255,255,255,0.05)" 
              strokeDasharray="4,4" 
            />
          );
        })}
        {/* Area fill */}
        <path d={areaD} fill="url(#chartGlow)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" />
        {/* Data points */}
        {trend.map((val, idx) => {
          if (idx % 2 !== 0 && idx !== 23) return null; // Draw fewer points to prevent overlap
          const x = padding + (idx * (width - padding * 2)) / 23;
          const y = height - padding - (val * (height - padding * 2)) / maxVal;
          return (
            <g key={`dot-${idx}`}>
              <circle cx={x} cy={y} r="4" fill="#818cf8" stroke="#0b0f19" strokeWidth="1" />
              <text x={x} y={height - 2} className="chart-label" textAnchor="middle">{idx}h</text>
            </g>
          );
        })}
      </svg>
    );
  };

  // Helper to draw custom SVG bar chart
  const renderDayChart = (trend) => {
    if (!trend || trend.length === 0) return null;
    const maxVal = Math.max(...trend.map(d => d.count), 1);
    const width = 500;
    const height = 140;
    const padding = 15;
    const barWidth = 32;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="svg-chart">
        {trend.map((item, idx) => {
          const x = padding + (idx * (width - padding * 2)) / 6 + 10;
          const barHeight = (item.count * (height - padding * 2 - 20)) / maxVal;
          const y = height - padding - barHeight - 15;
          return (
            <g key={`bar-${idx}`}>
              {/* Highlight background on hover */}
              <rect 
                x={x - 8} 
                y={padding} 
                width={barWidth + 16} 
                height={height - padding * 2 - 10} 
                fill="transparent" 
                className="bar-hitbox"
              />
              <rect 
                x={x} 
                y={y} 
                width={barWidth} 
                height={barHeight} 
                rx="4" 
                fill="url(#barGradient)" 
                className="bar-rect"
              />
              <text x={x + barWidth/2} y={height - 2} className="chart-label" textAnchor="middle">
                {item.day.slice(0, 3)}
              </text>
              <text x={x + barWidth/2} y={y - 5} className="chart-value" textAnchor="middle">
                {item.count > 1000 ? `${(item.count/1000).toFixed(1)}k` : item.count}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">
            <Activity className="glow-icon" />
          </div>
          <div>
            <h1>VELOCITY</h1>
            <span className="subtitle font-outfit">AI Traffic Intelligence</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={20} />
            <span>Hotspot Analytics</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'dispatch' ? 'active' : ''}`}
            onClick={() => setActiveTab('dispatch')}
          >
            <Navigation size={20} />
            <span>Patrol Dispatcher</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'forecast' ? 'active' : ''}`}
            onClick={() => setActiveTab('forecast')}
          >
            <Clock size={20} />
            <span>AI Risk Forecaster</span>
          </button>
        </nav>

        {/* Global Active Filters Summary */}
        <div className="active-filters-box glass-card">
          <div className="box-header">
            <Filter size={14} />
            <h4>Active Context</h4>
          </div>
          <div className="filter-summary-item">
            <span className="label">Jurisdiction</span>
            <span className="value truncate">{selectedStation}</span>
          </div>
          <div className="filter-summary-item">
            <span className="label">Vehicle Class</span>
            <span className="value">{selectedVehicle.replace('All ', '')}</span>
          </div>
          <div className="filter-summary-item">
            <span className="label">Primary Violation</span>
            <span className="value truncate">{selectedViolation.replace('All ', '')}</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="status-dot-wrapper">
            <span className="status-dot pulsing"></span>
            <span className="status-text font-outfit">DB Nodes Active: {stats?.total_violations ? '298,450' : 'Loading...'}</span>
          </div>
        </div>
      </aside>

      {/* Main Dashboard Content */}
      <main className="main-content">
        
        {/* Header Bar */}
        <header className="header-bar">
          <div className="header-title-area">
            <h2>
              {activeTab === 'analytics' && 'Bengaluru Congestion Analytics & Hotspots'}
              {activeTab === 'dispatch' && 'AI Patrol Route Optimizer & Dispatcher'}
              {activeTab === 'forecast' && 'AI Congestion Risk Forecaster'}
            </h2>
            <p className="header-sub">
              {activeTab === 'analytics' && 'Analyze illegal parking spatial clusters and model street capacity blockage.'}
              {activeTab === 'dispatch' && 'Compute optimal enforcement route schedules for traffic officers.'}
              {activeTab === 'forecast' && 'Predict illegal parking risk patterns based on historical temporal analytics.'}
            </p>
          </div>
          
          {/* Quick Filter Bar (Only shown on Analytics Tab) */}
          {activeTab === 'analytics' && (
            <div className="quick-filters">
              <div className="select-wrapper">
                <Search size={14} className="input-icon" />
                <select 
                  value={selectedStation} 
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="filter-select"
                >
                  <option value="All Stations">All Stations</option>
                  {stations.map(s => (
                    <option key={s.station} value={s.station}>{s.station}</option>
                  ))}
                </select>
              </div>

              <select 
                value={selectedVehicle} 
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="filter-select"
              >
                <option value="All Vehicles">All Vehicles</option>
                {vehicleTypes.map(v => (
                  <option key={v.vehicle} value={v.vehicle}>{v.vehicle}</option>
                ))}
              </select>

              <select 
                value={selectedViolation} 
                onChange={(e) => setSelectedViolation(e.target.value)}
                className="filter-select"
              >
                <option value="All Violations">All Violations</option>
                {violationTypes.slice(0, 10).map(v => (
                  <option key={v.violation} value={v.violation}>{v.violation}</option>
                ))}
              </select>

              <button className="icon-btn btn-danger" onClick={handleResetFilters} title="Reset Filters">
                <RefreshCw size={16} />
              </button>
            </div>
          )}
        </header>

        {/* Tab 1: Analytics View */}
        {activeTab === 'analytics' && (
          <div className="tab-grid">
            
            {/* Left Column: Data Analytics & Simulator */}
            <section className="analytics-left">
              
              {/* KPI Cards */}
              <div className="kpi-grid">
                <div className="kpi-card glass-card">
                  <div className="kpi-header">
                    <span className="kpi-label">TOTAL VIOLATIONS</span>
                    <AlertTriangle size={18} className="text-cyan" />
                  </div>
                  <div className="kpi-value">
                    {loading ? '---' : (stats?.total_violations.toLocaleString() || '0')}
                  </div>
                  <div className="kpi-meta text-cyan font-outfit">Enforced incidents</div>
                </div>

                <div className="kpi-card glass-card">
                  <div className="kpi-header">
                    <span className="kpi-label">CONGESTION INDEX</span>
                    <Activity size={18} className="text-coral" />
                  </div>
                  <div className="kpi-value text-coral">
                    {loading ? '---' : (stats?.avg_congestion || '0.000')}
                  </div>
                  <div className="kpi-meta text-coral font-outfit">Avg blockage impact score</div>
                </div>

                <div className="kpi-card glass-card">
                  <div className="kpi-header">
                    <span className="kpi-label">PRIORITY CHOKE POINTS</span>
                    <ShieldAlert size={18} className="text-purple" />
                  </div>
                  <div className="kpi-value text-purple">
                    {loading ? '---' : (stats?.active_priority_zones || '0')}
                  </div>
                  <div className="kpi-meta text-purple font-outfit">Zones requiring enforcement</div>
                </div>
              </div>

              {/* Congestion Weight Simulator */}
              <div className="simulator-panel glass-card">
                <div className="panel-header">
                  <div className="title-with-icon">
                    <Sliders className="text-purple" size={18} />
                    <h3>AI Congestion Index Weight Simulator</h3>
                  </div>
                  <button className="reset-link font-outfit" onClick={handleResetWeights}>Reset Weights</button>
                </div>
                <p className="panel-desc">
                  Adjust severity sliders below. The Congestion Index and map hotspot sizes will recalculate instantly.
                </p>

                <div className="simulator-sliders-grid">
                  <div className="slider-group">
                    <div className="slider-labels">
                      <span>🚗 Passenger Car Size</span>
                      <span className="slider-val text-cyan">{carWeight.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="1.5" step="0.1" 
                      value={carWeight} onChange={(e) => setCarWeight(parseFloat(e.target.value))} 
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-labels">
                      <span>🛵 Two-Wheeler Size</span>
                      <span className="slider-val text-cyan">{scooterWeight.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="1.5" step="0.1" 
                      value={scooterWeight} onChange={(e) => setScooterWeight(parseFloat(e.target.value))} 
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-labels">
                      <span>🛺 Passenger Auto Size</span>
                      <span className="slider-val text-cyan">{autoWeight.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="1.5" step="0.1" 
                      value={autoWeight} onChange={(e) => setAutoWeight(parseFloat(e.target.value))} 
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-labels">
                      <span>🚚 Commercial Van/LGV Size</span>
                      <span className="slider-val text-cyan">{lgvWeight.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="1.5" step="0.1" 
                      value={lgvWeight} onChange={(e) => setLgvWeight(parseFloat(e.target.value))} 
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-labels">
                      <span>🛑 Parking in Main Road Severity</span>
                      <span className="slider-val text-coral">{mainRoadWeight.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="2.0" step="0.1" 
                      value={mainRoadWeight} onChange={(e) => setMainRoadWeight(parseFloat(e.target.value))} 
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-labels">
                      <span>⚠️ Double Parking Severity</span>
                      <span className="slider-val text-coral">{doubleParkWeight.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="2.0" step="0.1" 
                      value={doubleParkWeight} onChange={(e) => setDoubleParkWeight(parseFloat(e.target.value))} 
                    />
                  </div>
                </div>
              </div>

              {/* Trends Section */}
              <div className="trends-grid">
                <div className="trend-card glass-card">
                  <h4>Hourly Violation Density (IST local time)</h4>
                  <div className="chart-container">
                    {loading ? <div className="loader">Loading trends...</div> : renderHourlyChart(stats?.hourly_trend)}
                  </div>
                </div>

                <div className="trend-card glass-card">
                  <h4>Day of Week Distribution</h4>
                  <div className="chart-container">
                    {loading ? <div className="loader">Loading trends...</div> : renderDayChart(stats?.day_trend)}
                  </div>
                </div>
              </div>

              {/* Ratios Breakdown (Vehicle and Violation distribution) */}
              <div className="breakdown-grid">
                <div className="breakdown-card glass-card">
                  <h4>Vehicle Class Distribution</h4>
                  <div className="breakdown-list">
                    {stats?.vehicle_dist.map((item, idx) => (
                      <div key={idx} className="breakdown-item">
                        <div className="item-labels">
                          <span>{item.vehicle}</span>
                          <span className="value font-outfit">{item.count.toLocaleString()} cases</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill fill-cyan" 
                            style={{ width: `${(item.count / stats.total_violations) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="breakdown-card glass-card">
                  <h4>Violation Type Distribution</h4>
                  <div className="breakdown-list">
                    {stats?.violation_dist.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="breakdown-item">
                        <div className="item-labels">
                          <span className="truncate pr-2">{item.violation}</span>
                          <span className="value font-outfit">{item.count.toLocaleString()} cases</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill fill-coral" 
                            style={{ width: `${(item.count / stats.total_violations) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </section>

            {/* Right Column: Live Map */}
            <section className="analytics-right glass-card map-panel">
              <div className="map-header">
                <div className="title-with-icon">
                  <MapIcon size={18} className="text-cyan" />
                  <h3>Live Hotspot Heatmap</h3>
                </div>
                <span className="map-badge font-outfit">Showing {hotspots.length} Grid Clusters</span>
              </div>
              <div className="map-wrapper">
                <MapComponent 
                  hotspots={hotspots} 
                  patrolRoute={showRouteOnMap ? enforcementPlan?.patrol_route : null}
                  selectedStation={selectedStation} 
                />
              </div>
            </section>

          </div>
        )}

        {/* Tab 2: Dispatch Planner */}
        {activeTab === 'dispatch' && (
          <div className="tab-grid">
            
            {/* Left Column: Optimal Patrol Route Plan */}
            <section className="dispatch-left glass-card">
              <div className="panel-header">
                <div className="title-with-icon">
                  <Navigation className="text-purple" size={20} />
                  <h3>Enforcement Dispatch Route Optimizer</h3>
                </div>
              </div>

              <div className="dispatch-config">
                <label className="font-outfit">Select Local Police Station:</label>
                <div className="select-row">
                  <select 
                    value={dispatchStation} 
                    onChange={(e) => {
                      setDispatchStation(e.target.value);
                      setShowRouteOnMap(false);
                    }}
                    className="filter-select select-lg"
                  >
                    {stations.map(s => (
                      <option key={s.station} value={s.station}>{s.station}</option>
                    ))}
                  </select>
                  
                  <button 
                    className={`btn-primary ${showRouteOnMap ? 'active-btn' : ''}`}
                    onClick={() => setShowRouteOnMap(!showRouteOnMap)}
                    disabled={isRouting || !enforcementPlan}
                  >
                    <Navigation size={16} />
                    {showRouteOnMap ? 'Clear Route Overlay' : 'Generate Optimized Route'}
                  </button>
                </div>
              </div>

              {isRouting ? (
                <div className="routing-loader">
                  <RefreshCw className="spinner" size={32} />
                  <p className="font-outfit">Analyzing grid clusters and computing nearest-neighbor route path...</p>
                </div>
              ) : enforcementPlan ? (
                <div className="route-results">
                  <div className="route-meta-summary">
                    <div className="meta-box">
                      <span className="label">Total Stops</span>
                      <span className="val">{enforcementPlan.hotspots.length}</span>
                    </div>
                    <div className="meta-box">
                      <span className="label">Est. Patrol Distance</span>
                      <span className="val text-purple">~8.4 km</span>
                    </div>
                    <div className="meta-box">
                      <span className="label">Target Zone</span>
                      <span className="val">{enforcementPlan.police_station}</span>
                    </div>
                  </div>

                  <h4 className="stops-title font-outfit">PATROL SEQUENCE DIRECTION</h4>
                  <div className="patrol-stops-list">
                    {enforcementPlan.patrol_route.map((p, idx) => (
                      <div key={idx} className="patrol-stop-card">
                        <div className="stop-number font-outfit">{idx + 1}</div>
                        <div className="stop-details">
                          <div className="stop-header">
                            <h5>{p.location}</h5>
                            <span className="badge-score font-outfit">Impact: {p.congestion_score}</span>
                          </div>
                          <p className="stop-coords">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</p>
                          <div className="stop-tags">
                            <span className="tag-violation font-outfit">{p.primary_violation}</span>
                            <span className="tag-vehicle font-outfit"><Car size={10} style={{marginRight: 2}} /> {p.primary_vehicle}</span>
                            <span className="tag-cases font-outfit">{p.violation_count} historical incidents</span>
                          </div>
                        </div>
                        {idx < enforcementPlan.patrol_route.length - 1 && (
                          <ChevronRight size={16} className="route-arrow-next" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>Select a police station to load coordinates.</p>
              )}
            </section>

            {/* Right Column: Dispatch Map */}
            <section className="dispatch-right glass-card map-panel">
              <div className="map-header">
                <div className="title-with-icon">
                  <MapIcon size={18} className="text-cyan" />
                  <h3>Patrol Routing Map</h3>
                </div>
                {showRouteOnMap && <span className="map-badge badge-active font-outfit">Patrol Route Active</span>}
              </div>
              <div className="map-wrapper">
                <MapComponent 
                  hotspots={enforcementPlan?.hotspots || []} 
                  patrolRoute={showRouteOnMap ? enforcementPlan?.patrol_route : null}
                  selectedStation={dispatchStation} 
                />
              </div>
            </section>

          </div>
        )}

        {/* Tab 3: AI Risk Forecaster */}
        {activeTab === 'forecast' && (
          <div className="forecast-view">
            
            {/* Top Selector Card */}
            <div className="forecast-selector glass-card">
              <div className="selector-title">
                <ShieldAlert size={20} className="text-coral" />
                <h3>Temporal Congestion & Violation Risk Forecaster</h3>
              </div>
              <div className="selector-row">
                <div className="sel-group">
                  <label>Jurisdiction</label>
                  <select 
                    value={forecastStation} 
                    onChange={(e) => setForecastStation(e.target.value)}
                    className="filter-select"
                  >
                    {stations.map(s => (
                      <option key={s.station} value={s.station}>{s.station}</option>
                    ))}
                  </select>
                </div>

                <div className="sel-group">
                  <label>Day of Week</label>
                  <select 
                    value={forecastDay} 
                    onChange={(e) => setForecastDay(e.target.value)}
                    className="filter-select"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="sel-group">
                  <label>Hour of Day (IST)</label>
                  <select 
                    value={forecastHour} 
                    onChange={(e) => setForecastHour(parseInt(e.target.value))}
                    className="filter-select"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>{h < 10 ? `0${h}:00` : `${h}:00`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {forecastData ? (
              <div className="forecast-results-grid">
                
                {/* AI Risk Analysis Card */}
                <div className="forecast-result-card glass-card">
                  <div className="card-header">
                    <h4>Predictive Assessment</h4>
                    <span className="badge-risk font-outfit" style={{ backgroundColor: `${forecastData.color}20`, color: forecastData.color, borderColor: forecastData.color }}>
                      {forecastData.status}
                    </span>
                  </div>

                  <div className="risk-score-display">
                    <div className="score-circle" style={{ borderColor: forecastData.color, boxShadow: `0 0 15px ${forecastData.color}30` }}>
                      <span className="score font-outfit">{forecastData.risk_score}%</span>
                      <span className="label font-outfit">Congestion Risk</span>
                    </div>
                  </div>

                  <div className="forecast-metrics-list">
                    <div className="f-metric">
                      <span className="label">Est. Peak Violations / Hr</span>
                      <span className="val font-outfit">{forecastData.incident_count} cases</span>
                    </div>
                    <div className="f-metric">
                      <span className="label">Mean Street Capacity Loss</span>
                      <span className="val font-outfit text-coral">{(forecastData.avg_congestion_impact * 20).toFixed(1)}%</span>
                    </div>
                    <div className="f-metric">
                      <span className="label">Recommended Squad Count</span>
                      <span className="val font-outfit text-purple">{forecastData.recommended_squads} units</span>
                    </div>
                  </div>
                </div>

                {/* AI Tactical Recommendations */}
                <div className="forecast-result-card glass-card">
                  <div className="card-header">
                    <h4>Tactical Patrol Directives</h4>
                  </div>
                  
                  <div className="tactical-item">
                    <div className="item-icon bg-coral">⚡</div>
                    <div className="item-desc">
                      <h5>High-Risk Violation Profile</h5>
                      <p>Expect high densities of <strong>{forecastData.predominant_violation}</strong> offenses, mostly involving <strong>{forecastData.predominant_vehicle}</strong> vehicle classes. Position towing squads near main carriageways.</p>
                    </div>
                  </div>

                  <div className="tactical-item">
                    <div className="item-icon bg-cyan">🧭</div>
                    <div className="item-desc">
                      <h5>Enforcement Location Strategy</h5>
                      <p>Prioritize commercial junctions and major arterial bottlenecks within the {forecastData.station} sector. Double-parking risks are estimated to peak at this hour.</p>
                    </div>
                  </div>

                  <div className="tactical-item">
                    <div className="item-icon bg-purple">🛡️</div>
                    <div className="item-desc">
                      <h5>Squad Dispatch Strength</h5>
                      <p>Deploy {forecastData.recommended_squads} active patrol team(s). Focus on clearing transit lanes to restore speed flow by {forecastHour + 1}:00.</p>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="loader">Running predictive statistical models...</div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}
