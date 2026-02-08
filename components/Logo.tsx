import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
        viewBox="0 0 120 100" 
        className={className} 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
    >
        <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2DD4BF" /> {/* Teal 400 */}
                <stop offset="100%" stopColor="#0F766E" /> {/* Teal 700 */}
            </linearGradient>
            <filter id="dropShadow" x="-2" y="0" width="130" height="110">
               <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.2" />
            </filter>
        </defs>

        {/* Carro de Fundo (Menor/Mais claro) */}
        <g opacity="0.5" transform="translate(40, -10) scale(0.8)">
            <path d="M10 50 C10 50 20 30 45 30 H75 C95 30 100 50 100 50 V75 H10 V50 Z" fill="url(#logoGradient)" />
            <circle cx="30" cy="75" r="8" fill="#115E59" />
            <circle cx="80" cy="75" r="8" fill="#115E59" />
        </g>

        {/* Carro do Meio */}
        <g opacity="0.8" transform="translate(20, 5) scale(0.9)">
            <path d="M10 50 C10 50 20 30 45 30 H75 C95 30 100 50 100 50 V75 H10 V50 Z" fill="url(#logoGradient)" />
            <circle cx="30" cy="75" r="8" fill="#134E4A" />
            <circle cx="80" cy="75" r="8" fill="#134E4A" />
        </g>

        {/* Carro da Frente (Principal) */}
        <g filter="url(#dropShadow)" transform="translate(0, 20)">
            <path d="M10 50 C10 50 20 30 45 30 H75 C95 30 100 50 100 50 V75 H10 V50 Z" fill="url(#logoGradient)" />
            {/* Janela */}
            <path d="M25 48 L45 35 H70 L85 48 H25 Z" fill="white" fillOpacity="0.3" />
            {/* Rodas */}
            <circle cx="30" cy="75" r="9" fill="#CCFBF1" stroke="#0F766E" strokeWidth="3" />
            <circle cx="80" cy="75" r="9" fill="#CCFBF1" stroke="#0F766E" strokeWidth="3" />
            {/* Farol */}
            <path d="M95 55 L98 60 L95 65" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </g>
    </svg>
  );
};