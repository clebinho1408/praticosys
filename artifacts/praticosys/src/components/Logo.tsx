import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
        viewBox="0 0 100 100" 
        className={className} 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
    >
        <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563EB" /> {/* Blue 600 */}
                <stop offset="100%" stopColor="#1E40AF" /> {/* Blue 800 */}
            </linearGradient>
        </defs>

        {/* Forma Base: Hexagono Arredondado ou Escudo Moderno */}
        <path 
            d="M50 5 L90 25 V50 C90 75 50 95 50 95 C50 95 10 75 10 50 V25 L50 5 Z" 
            fill="url(#logoGradient)" 
        />
        
        {/* Elemento Interno: Check/Estrada Abstrata */}
        <path 
            d="M30 50 L45 65 L70 35" 
            stroke="white" 
            strokeWidth="8" 
            strokeLinecap="round" 
            strokeLinejoin="round"
        />
        
        {/* Detalhe Sutil */}
        <circle cx="50" cy="25" r="3" fill="white" fillOpacity="0.5" />
    </svg>
  );
};