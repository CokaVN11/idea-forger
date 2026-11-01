type NavigationName = "dashboard" | "distill" | "library" | "spark" | "ship";

export function NavigationIcon({ name }: { name: NavigationName }) {
  const shapes = {
    dashboard: (
      <>
        <path
          d="M4 15 16 5l12 10v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
          fill="#ffd37d"
        />
        <path
          d="m3 15 13-11 13 11"
          fill="none"
          stroke="#d58926"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="12" y="18" width="8" height="11" rx="2" fill="#d58926" />
        <rect x="7" y="17" width="3" height="4" rx="1" fill="#fff8e9" />
      </>
    ),
    distill: (
      <>
        <rect x="8" y="3" width="16" height="20" rx="3" fill="#d4eefc" />
        <path
          d="M12 9h8m-8 5h6"
          stroke="#4c9bc2"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M6 16h5l3 4h4l3-4h5l3 10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z"
          fill="#57b7e8"
        />
        <path d="M4 24h24v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" fill="#2695cb" />
      </>
    ),
    library: (
      <>
        <rect x="3" y="5" width="8" height="24" rx="2" fill="#67bb61" />
        <rect x="12" y="3" width="8" height="26" rx="2" fill="#a3d980" />
        <g transform="rotate(-12 25 18)">
          <rect x="22" y="7" width="7" height="22" rx="2" fill="#479a59" />
          <path d="M23 11h5m-5 13h5" stroke="#c9ebc4" strokeWidth="2" />
        </g>
        <path d="M5 10h4m5-2h4M5 24h4m5 0h4" stroke="#effbe5" strokeWidth="2" />
      </>
    ),
    spark: (
      <>
        <path
          d="M25 13a9 9 0 0 1-4 7c-1 .8-1 3-1 3h-8s0-2.2-1-3a9 9 0 1 1 14-7"
          fill="#ffd561"
        />
        <path
          d="m13 13 3 4 3-4m-3 4v6"
          stroke="#dc9b22"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <rect x="11" y="23" width="10" height="4" rx="2" fill="#b5bdc4" />
        <path
          d="M13 28h6"
          stroke="#87929c"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
    ship: (
      <>
        <rect x="5" y="5" width="22" height="24" rx="4" fill="#b8dbcb" />
        <rect x="10" y="3" width="12" height="6" rx="2" fill="#4a9e7c" />
        <path
          d="m10 18 4 4 8-9"
          fill="none"
          stroke="#318762"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}
