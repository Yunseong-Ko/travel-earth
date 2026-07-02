"use client";

// 구름이 — 날씨 따라 표정이 바뀌는 마스코트.
// 제품의 우천 적응 로직이 곧 캐릭터 성격: 맑으면 신나고, 비 오면 우산 쓰고 온천을 권한다.
export type GurumiMood = "sunny" | "partly" | "cloudy" | "rainy";

type Props = {
  mood: GurumiMood;
  size?: number;
};

export default function Gurumi({ mood, size = 46 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="구름이"
      style={{ flexShrink: 0 }}
    >
      {/* 해 (맑음/약간 맑음) */}
      {(mood === "sunny" || mood === "partly") && (
        <g>
          <circle
            cx="47"
            cy="15"
            r={mood === "sunny" ? 9 : 7}
            fill="#FFD54D"
          />
          {mood === "sunny" && (
            <g stroke="#FFC94A" strokeWidth="2" strokeLinecap="round">
              <line x1="47" y1="1" x2="47" y2="4" />
              <line x1="58" y1="15" x2="61" y2="15" />
              <line x1="55" y1="7" x2="57" y2="5" />
              <line x1="55" y1="23" x2="57" y2="25" />
            </g>
          )}
        </g>
      )}

      {/* 우산 (비) */}
      {mood === "rainy" && (
        <g>
          <path
            d="M 20 14 A 13 13 0 0 1 46 14 L 20 14 Z"
            fill="#2563EB"
          />
          <path
            d="M 20 14 Q 26.5 11 33 14 Q 39.5 11 46 14"
            fill="none"
            stroke="#1D4FC4"
            strokeWidth="1.5"
          />
          <line
            x1="33"
            y1="14"
            x2="33"
            y2="24"
            stroke="#1D4FC4"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g fill="#8FB4F5">
            <ellipse cx="12" cy="24" rx="1.6" ry="2.6" />
            <ellipse cx="54" cy="22" rx="1.6" ry="2.6" />
          </g>
        </g>
      )}

      {/* 구름 몸통 */}
      <g fill="#EAF0F8">
        <circle cx="21" cy="40" r="12" />
        <circle cx="34" cy="34" r="14" />
        <circle cx="45" cy="42" r="11" />
        <rect x="14" y="40" width="38" height="13" rx="6.5" />
      </g>

      {/* 표정 */}
      {mood === "sunny" && (
        <g>
          {/* 신나는 눈 (^ ^) */}
          <path
            d="M 24 41 Q 27 38 30 41"
            fill="none"
            stroke="#3A3F47"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 36 41 Q 39 38 42 41"
            fill="none"
            stroke="#3A3F47"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* 활짝 웃는 입 */}
          <path
            d="M 29 46 Q 33 50 37 46"
            fill="none"
            stroke="#3A3F47"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
      {mood === "partly" && (
        <g>
          <circle cx="27" cy="41" r="1.8" fill="#3A3F47" />
          <circle cx="39" cy="41" r="1.8" fill="#3A3F47" />
          <path
            d="M 30 46 Q 33 48.5 36 46"
            fill="none"
            stroke="#3A3F47"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
      {mood === "cloudy" && (
        <g>
          <circle cx="27" cy="41" r="1.8" fill="#3A3F47" />
          <circle cx="39" cy="41" r="1.8" fill="#3A3F47" />
          {/* 심드렁한 입 (—) */}
          <line
            x1="30"
            y1="46.5"
            x2="36"
            y2="46.5"
            stroke="#3A3F47"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
      {mood === "rainy" && (
        <g>
          {/* 씩씩한 눈 + 작은 오~ 입 (우산 챙겼으니 문제없음) */}
          <circle cx="27" cy="41" r="1.8" fill="#3A3F47" />
          <circle cx="39" cy="41" r="1.8" fill="#3A3F47" />
          <circle
            cx="33"
            cy="46.5"
            r="2.2"
            fill="none"
            stroke="#3A3F47"
            strokeWidth="1.8"
          />
        </g>
      )}

      {/* 볼터치 */}
      <g fill="#F7B2B7" opacity="0.55">
        <ellipse cx="21" cy="45" rx="2.6" ry="1.5" />
        <ellipse cx="45" cy="45" rx="2.6" ry="1.5" />
      </g>
    </svg>
  );
}
