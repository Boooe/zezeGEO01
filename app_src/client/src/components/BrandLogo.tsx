import React from 'react';

interface BrandLogoProps {
  size?: number;
  withText?: boolean;
  textSize?: number;
  textPosition?: 'right' | 'bottom';
  className?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 30,
  withText = true,
  textSize,
  textPosition = 'right',
  className,
}) => {
  const gap = size * 0.28;
  const defaultTextSize = Math.round(size * 0.6);
  const actualTextSize = textSize ?? defaultTextSize;

  return (
    <div
      className={`inline-flex items-center ${textPosition === 'bottom' ? 'flex-col' : ''} ${className ?? ''}`}
      style={{
        gap: textPosition === 'bottom' ? `${size * 0.2}px` : `${gap}px`,
        alignItems: textPosition === 'bottom' ? 'center' : 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
        aria-label="星河GEO logo"
      >
        <defs>
          <linearGradient
            id="xg-ring"
            x1="4"
            y1="26"
            x2="28"
            y2="6"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#3B5BFF" />
            <stop offset="100%" stopColor="#00C2FF" />
          </linearGradient>
        </defs>
        <circle
          cx="16"
          cy="16"
          r="10.5"
          fill="none"
          stroke="url(#xg-ring)"
          strokeWidth="4.8"
          strokeLinecap="round"
          strokeDasharray="48 18"
          transform="rotate(-40 16 16)"
        />
        <rect x="15.4" y="13.6" width="11" height="4.8" rx="2.4" fill="url(#xg-ring)" />
        <path
          d="M16 3.2 L17.1 6.1 L20 7.2 L17.1 8.3 L16 11.2 L14.9 8.3 L12 7.2 L14.9 6.1 Z"
          fill="#FFFFFF"
        />
        <path
          d="M26.4 17.4 L27 19 L28.6 19.6 L27 20.2 L26.4 21.8 L25.8 20.2 L24.2 19.6 L25.8 19 Z"
          fill="#00C2FF"
        />
        <path
          d="M7.2 22.6 L7.7 24 L9.1 24.5 L7.7 25 L7.2 26.4 L6.7 25 L5.3 24.5 L6.7 24 Z"
          fill="#7FD8FF"
        />
      </svg>
      {withText && (
        <span
          style={{
            fontSize: `${actualTextSize}px`,
            fontWeight: 600,
            color: '#131A2A',
            letterSpacing: '0.01em',
            lineHeight: 1,
          }}
        >
          星河GEO
        </span>
      )}
    </div>
  );
};

export default BrandLogo;
