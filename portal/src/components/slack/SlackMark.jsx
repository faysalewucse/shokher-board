/** Simple Slack-like monochrome mark (no brand colours, per the theme). */
export default function SlackMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="9" y="2" width="4" height="9" rx="2" />
      <rect x="13" y="11" width="9" height="4" rx="2" />
      <rect x="11" y="13" width="4" height="9" rx="2" />
      <rect x="2" y="9" width="9" height="4" rx="2" />
    </svg>
  );
}
