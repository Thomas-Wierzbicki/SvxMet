import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SVXMET_VERSION = "1909_1_map_#"; // Frontend-Version

/** Leaflet-Karten-Komponente mit Tooltip (temp, dewp, wdir, wspd, visib) */
function MapSection({ lat, lon, name, zoom = 10, meteo }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const defaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41]
  });

  // Tooltip-HTML – mit Pfeil in Blasrichtung
  function buildTooltip(m) {
    if (!m) return null;
    const { temp, dewp, wdir, wspd, visib } = m;

    // ➤ zeigt von Haus aus nach Osten (0°). Für "WOHIN weht" = wdir + 90
    const rotTo = ((Number(wdir) || 0) + 90) % 360;
    const arrow = `
      <span style="display:inline-block;transform:rotate(${rotTo}deg);font-size:1.1rem;line-height:1;">➤</span>
    `;

    return `
      <div style="font:12px/1.3 system-ui,sans-serif;">
        <div style="display:flex;gap:.5rem;align-items:center;"><span>🌡️</span><strong>${temp ?? '–'}°C</strong></div>
        <div style="display:flex;gap:.5rem;align-items:center;margin-top:.2rem;"><span>💧</span><strong>${dewp ?? '–'}°C</strong></div>
        <div style="display:flex;gap:.5rem;align-items:center;margin-top:.2rem;">
          <span>🧭</span><span>${wdir ?? '–'}°</span>
          <span style="margin-left:.25rem;">${arrow}</span>
          <span style="margin-left:.4rem;">💨 <strong>${wspd ?? '–'}</strong> kt</span>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center;margin-top:.2rem;">
          <span>👁️</span><strong>${visib ?? '–'} m</strong>
        </div>
      </div>
    `;
  }

  useEffect(() => {
    if (lat == null || lon == null || !mapEl.current) return;

    const latNum = Number(lat);
    const lonNum = Number(lon);
    const z = Number(zoom) || 10;
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return;

    // Karte initialisieren/aktualisieren
    if (!mapRef.current) {
      const map = L.map(mapEl.current).setView([latNum, lonNum], z);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);
      mapRef.current = map;
    } else {
      mapRef.current.setView([latNum, lonNum], z);
    }

    // Marker verwalten
    if (name !== "Weltkarte") {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      const marker = L.marker([latNum, lonNum], { icon: defaultIcon }).addTo(mapRef.current);
      marker.bindPopup(`${name ?? "Position"}<br/>${latNum}, ${lonNum}`);

      const tt = buildTooltip(meteo);
      if (tt) {
        marker.bindTooltip(tt, {
          direction: "top",
          sticky: true,
          opacity: 0.95,
          className: "svxmet-tooltip"
        });
      }
      markerRef.current = marker;
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [lat, lon, name, zoom, meteo]);

  return <div style={{ height: "400px", width: "100%" }} ref={mapEl} />;
}

function icaoToSmsSequence(icao) {
  try {
    if (!icao || typeof icao !== 'string' || icao.length !== 4) return "";

    const map = {
      A:'2',B:'22',C:'222', D:'3',E:'33',F:'333',
      G:'4',H:'44',I:'444', J:'5',K:'55',L:'555',
      M:'6',N:'66',O:'666', P:'7',Q:'77',R:'777',S:'7777',
      T:'8',U:'88',V:'888', W:'9',X:'99',Y:'999',Z:'9999'
    };

    const sequence = icao.toUpperCase().split('').map(c => map[c] || '').join('*');
    return sequence.endsWith('#') ? sequence : sequence + '#';
  } catch (err) {
    console.error("Fehler in icaoToSmsSequence:", err);
    return "";
  }
}


export default function App() {
  // Theme (deine index.css erwartet data-theme am <html>)
  const [theme, setTheme] = useState(() => localStorage.getItem('svxmet-theme') || 'default');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'default') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    localStorage.setItem('svxmet-theme', theme);
  }, [theme]);

  const [airports, setAirports] = useState([]);
  const [airportLoading, setAirportLoading] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState("");
  const [selectedAirportDetails, setSelectedAirportDetails] = useState(null);
  const [airportQuery, setAirportQuery] = useState("");
  const [metarData, setMetarData] = useState(null);
  const [metarLoading, setMetarLoading] = useState(false);
  const [metarError, setMetarError] = useState(null);
  const [selectedSmsSequence, setSelectedSmsSequence] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [sendSmsError, setSendSmsError] = useState(null);
  const [sendSmsSuccess, setSendSmsSuccess] = useState(false);
  const [backendVersion, setBackendVersion] = useState(null);

  // Airports laden
  useEffect(() => {
    const fetchAirports = async () => {
      if (!airportQuery) { setAirports([]); return; }
      setAirportLoading(true);
      try {
        const res = await fetch(`/api/airports?icao=${airportQuery}`);
        const data = await res.json();
        if (Array.isArray(data.airports)) {
          setAirports(data.airports);
          if (data.airports.length === 1) setSelectedAirport(data.airports[0].icao);
        }
      } catch (e) {
        console.error("Airports fetch failed:", e);
      } finally {
        setAirportLoading(false);
      }
    };
    fetchAirports();
  }, [airportQuery]);

  // Details setzen
  useEffect(() => {
    const found = airports.find(a => a.icao === selectedAirport);
    setSelectedAirportDetails(found ?? null);
  }, [selectedAirport, airports]);

  // METAR laden
  useEffect(() => {
    if (!selectedAirportDetails) { setMetarData(null); setMetarError(null); return; }
    setMetarLoading(true); setMetarError(null);
    (async () => {
      try {
        const res = await fetch(`/api/metar?icao=${selectedAirportDetails.icao}`);
        if (!res.ok) throw new Error("Netzwerkfehler beim Abrufen der METAR-Daten");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setMetarData(data[0]);
        else { setMetarData(null); setMetarError("Keine METAR-Daten gefunden."); }
      } catch (e) {
        setMetarData(null); setMetarError(e.message || "Fehler beim Laden der METAR-Daten.");
      } finally { setMetarLoading(false); }
    })();
  }, [selectedAirportDetails]);

  // SMS-Sequenz
  useEffect(() => {
    if (selectedAirportDetails) setSelectedSmsSequence(icaoToSmsSequence(selectedAirportDetails.icao));
    else setSelectedSmsSequence("");
  }, [selectedAirportDetails]);

  // Backend-Version
  useEffect(() => {
    (async () => {
      try { const r = await fetch("/api/version"); const d = await r.json(); setBackendVersion(d.version); }
      catch { setBackendVersion("N/A"); }
    })();
  }, []);

  const handleSendSms = async () => {
    if (!selectedSmsSequence) { setSendSmsError("Keine SMS-Sequenz zum Senden."); return; }
    setIsSendingSms(true); setSendSmsError(null); setSendSmsSuccess(false);
    try {
      const r = await fetch('/api/dtmf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digits: selectedSmsSequence }),
      });
      if (!r.ok) throw new Error('---Netzwerkfehler beim Senden der Daten');
      setSendSmsSuccess(true);
    } catch (e) {
      setSendSmsError(e.message || 'Fehler beim Senden der Daten.');
    } finally { setIsSendingSms(false); }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>SVXMet – Flughafen-Info (IATA/ICAO)</h1>
        <div className="row">
          <select className="input" value={theme} onChange={(e)=>setTheme(e.target.value)} title="Theme wählen">
            <option value="default">Default (Hell)</option>
            <option value="dark">Dark</option>
            <option value="material">Material</option>
            <option value="nord">Nord</option>
            <option value="solarized">Solarized Light</option>
            <option value="dark-pro">Dark Pro</option>
          </select>
          <button className="btn ghost" onClick={()=>setTheme('default')}>Reset</button>
        </div>
      </div>

      {/* Suche */}
      <div className="card">
        <h2>Suche</h2>
        <div className="row">
          <input
            className="input flex-1-260"
            placeholder="Suche nach ICAO (z. B. EDDL)"
            value={airportQuery}
            onChange={(e) => setAirportQuery(e.target.value)}
          />
          <select
            className="input minw-220"
            value={selectedAirport}
            onChange={(e) => setSelectedAirport(e.target.value)}
            disabled={airportLoading}
          >
            <option value="">{airportLoading ? "Lade Flughäfen..." : "Flughafen auswählen"}</option>
            {airports.map((a, idx) => (
              <option key={a.icao} value={a.icao}>
                {a.metarAvailable ? '🟢 ' : '⚪ '} {idx + 1}. {a.region_name} ({a.icao}) — {a.airport}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Auswahl + Details */}
      <div className="card">
        <h2>Auswahl</h2>
        <div className="row">
          <div className="input flex-2-380" style={{ display:'flex', alignItems:'center' }}>
            {selectedAirportDetails
              ? `${selectedAirportDetails.region_name} (${selectedAirportDetails.icao}) — ${selectedAirportDetails.airport}`
              : '–'}
          </div>
        </div>

        <div className="grid2 mt-8">
          <div className="info"><span>Landescode</span><strong>{selectedAirportDetails?.country_code ?? ''}</strong></div>
          <div className="info"><span>IATA</span><strong>{selectedAirportDetails?.iata ?? ''}</strong></div>
          <div className="info"><span>ICAO</span><strong>{selectedAirportDetails?.icao ?? ''}</strong></div>
          <div className="info"><span>Breitengrad</span><strong>{selectedAirportDetails?.latitude ?? ''}</strong></div>
          <div className="info"><span>Längengrad</span><strong>{selectedAirportDetails?.longitude ?? ''}</strong></div>
        </div>
      </div>

      {/* Karte (mit Tooltip der METAR-Werte, Pfeil in Blasrichtung) */}
      <div className="card">
        <h2>Karte</h2>
        {selectedAirportDetails ? (
          <MapSection
            lat={selectedAirportDetails.latitude}
            lon={selectedAirportDetails.longitude}
            name={selectedAirportDetails.airport}
            zoom={10}
            meteo={{
              temp:  metarData?.temp,
              dewp:  metarData?.dewp,
              wdir:  metarData?.wdir,
              wspd:  metarData?.wspd,
              visib: metarData?.visib
            }}
          />
        ) : (
          <MapSection lat={0} lon={0} name="Weltkarte" zoom={2} />
        )}
      </div>

      {/* METAR */}
      <div className="card">
        <h2>METAR Daten</h2>
        {metarLoading && <p className="muted">Lade METAR-Daten…</p>}
        {metarError && <p style={{ color:'red' }}>{metarError}</p>}
        {metarData && <pre className="logbox">{JSON.stringify(metarData, null, 2)}</pre>}
        {!metarLoading && !metarData && !metarError && <p className="muted">Keine Daten</p>}
      </div>

      {/* SMS / DTMF */}
      <div className="card">
        <h2>SMS Tastenreihenfolge</h2>
        <div className="row">
          <input className="input flex-1-280" value={selectedSmsSequence || ''} readOnly placeholder="SMS-Sequenz" />
          <button className="btn" onClick={handleSendSms} disabled={!selectedSmsSequence || isSendingSms}>
            {isSendingSms ? 'Sende…' : 'Senden'}
          </button>
        </div>
        {sendSmsSuccess && <p style={{ color:'green' }} className="mt-6">Daten erfolgreich gesendet!</p>}
        {sendSmsError &&   <p style={{ color:'red'   }} className="mt-6">{sendSmsError}</p>}
      </div>

      {/* Versionen */}
      <div className="grid2">
        <div className="info"><span>Frontend-Version</span><strong>{SVXMET_VERSION}</strong></div>
        <div className="info"><span>Backend-Version</span><strong>{backendVersion || 'Lade…'}</strong></div>
      </div>
    </div>
  );
}
