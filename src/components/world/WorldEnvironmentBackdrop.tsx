import React from 'react';
import { WorldTemplate } from '../../types/worldTypes';

interface WorldEnvironmentBackdropProps {
  template: WorldTemplate;
  width: number;
  height: number;
}

export const WorldEnvironmentBackdrop: React.FC<WorldEnvironmentBackdropProps> = ({
  template,
  width,
  height,
}) => {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {template === 'village_sunset' && (
        <svg width={width} height={height} className="w-full h-full">
          <defs>
            {/* Sky gradient from deep amber to dusky purple */}
            <linearGradient id="sunsetSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4c1d95" />
              <stop offset="40%" stopColor="#831843" />
              <stop offset="70%" stopColor="#c2410c" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>

            {/* Earth & Road gradient */}
            <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#78350f" />
              <stop offset="30%" stopColor="#451a03" />
              <stop offset="100%" stopColor="#1c1917" />
            </linearGradient>

            {/* Path cobblestone/dirt */}
            <linearGradient id="dirtPath" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#92400e" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#b45309" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#92400e" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Sky */}
          <rect x="0" y="0" width={width} height={height * 0.45} fill="url(#sunsetSky)" />

          {/* Distant Hills / Village Rooftops Silhouette */}
          <path
            d={`M0 ${height * 0.38} Q${width * 0.25} ${height * 0.32} ${width * 0.5} ${height * 0.37} T${width} ${height * 0.35} L${width} ${height * 0.45} L0 ${height * 0.45} Z`}
            fill="#311042"
            opacity="0.9"
          />

          {/* Quaint wooden fence in distance */}
          <g opacity="0.6">
            {Array.from({ length: 24 }).map((_, i) => (
              <rect
                key={i}
                x={i * 45}
                y={height * 0.41}
                width="4"
                height="16"
                fill="#451a03"
              />
            ))}
            <line
              x1="0"
              y1={height * 0.43}
              x2={width}
              y2={height * 0.43}
              stroke="#451a03"
              strokeWidth="2"
            />
          </g>

          {/* Ground Field */}
          <rect
            x="0"
            y={height * 0.44}
            width={width}
            height={height * 0.56}
            fill="url(#groundGrad)"
          />

          {/* Curving Winding Country Road / Street */}
          <path
            d={`M0 ${height * 0.65} Q${width * 0.3} ${height * 0.55} ${width * 0.6} ${height * 0.62} T${width} ${height * 0.58} L${width} ${height * 0.8} Q${width * 0.6} ${height * 0.85} ${width * 0.3} ${height * 0.78} T0 ${height * 0.88} Z`}
            fill="url(#dirtPath)"
          />

          {/* Soft grass tufts */}
          <g opacity="0.4" fill="#15803d">
            <ellipse cx="140" cy={height * 0.52} rx="25" ry="5" />
            <ellipse cx="380" cy={height * 0.5} rx="30" ry="6" />
            <ellipse cx="620" cy={height * 0.53} rx="28" ry="5" />
            <ellipse cx="880" cy={height * 0.51} rx="35" ry="6" />
          </g>
        </svg>
      )}

      {template === 'office_night' && (
        <svg width={width} height={height} className="w-full h-full">
          <defs>
            <linearGradient id="officeFloor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient id="nightWindowSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#020617" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* Wall Interior */}
          <rect x="0" y="0" width={width} height={height * 0.4} fill="#090d16" />

          {/* Floor */}
          <rect x="0" y={height * 0.4} width={width} height={height * 0.6} fill="url(#officeFloor)" />

          {/* Floor grid carpet tiles */}
          <g stroke="#334155" strokeWidth="0.5" opacity="0.3">
            {Array.from({ length: 15 }).map((_, i) => (
              <line
                key={`v_${i}`}
                x1={i * 80}
                y1={height * 0.4}
                x2={i * 80 + 40}
                y2={height}
              />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <line
                key={`h_${i}`}
                x1={0}
                y1={height * 0.4 + i * 50}
                x2={width}
                y2={height * 0.4 + i * 50}
              />
            ))}
          </g>

          {/* Panoramic Night Skyscraper Windows in the wall */}
          <g>
            <rect x={120} y={30} width={220} height={height * 0.3} rx="4" fill="url(#nightWindowSky)" stroke="#334155" strokeWidth="2" />
            <rect x={400} y={30} width={220} height={height * 0.3} rx="4" fill="url(#nightWindowSky)" stroke="#334155" strokeWidth="2" />
            <rect x={680} y={30} width={220} height={height * 0.3} rx="4" fill="url(#nightWindowSky)" stroke="#334155" strokeWidth="2" />

            {/* Distant city yellow window dots */}
            <circle cx="160" cy="80" r="1.5" fill="#fef08a" opacity="0.8" />
            <circle cx="175" cy="95" r="1" fill="#fef08a" opacity="0.6" />
            <circle cx="210" cy="70" r="2" fill="#ef4444" opacity="0.8" />
            <circle cx="450" cy="65" r="1.5" fill="#38bdf8" opacity="0.7" />
            <circle cx="490" cy="90" r="1.5" fill="#fef08a" opacity="0.8" />
            <circle cx="720" cy="85" r="2" fill="#fef08a" opacity="0.8" />
            <circle cx="760" cy="110" r="1" fill="#e2e8f0" opacity="0.5" />
          </g>
        </svg>
      )}

      {template === 'city_evening' && (
        <svg width={width} height={height} className="w-full h-full">
          <defs>
            <linearGradient id="cityDusk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="50%" stopColor="#312e81" />
              <stop offset="100%" stopColor="#701a75" />
            </linearGradient>

            <linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>

          {/* Dusk Sky */}
          <rect x="0" y="0" width={width} height={height * 0.45} fill="url(#cityDusk)" />

          {/* City Buildings Silhouette */}
          <rect x={60} y={height * 0.18} width={110} height={height * 0.3} fill="#0f172a" />
          <rect x={200} y={height * 0.12} width={130} height={height * 0.35} fill="#090d16" />
          <rect x={360} y={height * 0.22} width={150} height={height * 0.25} fill="#0f172a" />
          <rect x={540} y={height * 0.15} width={140} height={height * 0.32} fill="#090d16" />
          <rect x={710} y={height * 0.2} width={120} height={height * 0.28} fill="#0f172a" />

          {/* Street & Sidewalk */}
          <rect x="0" y={height * 0.45} width={width} height={height * 0.55} fill="url(#asphalt)" />
          {/* Sidewalk curb */}
          <rect x="0" y={height * 0.45} width={width} height={18} fill="#475569" stroke="#334155" />
          {/* Street dashed road paint */}
          <g stroke="#facc15" strokeWidth="2" strokeDasharray="25,20" opacity="0.6">
            <line x1="0" y1={height * 0.72} x2={width} y2={height * 0.72} />
          </g>
        </svg>
      )}

      {template === 'bedroom_night' && (
        <svg width={width} height={height} className="w-full h-full">
          {/* Cozy bedroom dusk */}
          <rect x="0" y="0" width={width} height={height * 0.42} fill="#090d16" />
          <rect x="0" y={height * 0.42} width={width} height={height * 0.58} fill="#1e293b" />
          {/* Rug in center */}
          <ellipse cx={width * 0.5} cy={height * 0.65} rx={160} ry={70} fill="#701a75" opacity="0.4" stroke="#86198f" strokeWidth="2" />
        </svg>
      )}

      {template === 'park_autumn' && (
        <svg width={width} height={height} className="w-full h-full">
          <rect x="0" y="0" width={width} height={height * 0.4} fill="#fdba74" opacity="0.3" />
          <rect x="0" y={height * 0.4} width={width} height={height * 0.6} fill="#451a03" />
          <path d={`M0 ${height * 0.6} Q${width * 0.5} ${height * 0.7} ${width} ${height * 0.6} L${width} ${height * 0.8} Q${width * 0.5} ${height * 0.9} 0 ${height * 0.8} Z`} fill="#d97706" opacity="0.5" />
        </svg>
      )}
    </div>
  );
};
