/* Reference-led rule: every story card uses a warm, friendly workbook illustration with bold outlines and a clear child-readable silhouette. */
import { GreenBandIllustration } from "@/components/green-band-illustration";
import type { StoryId } from "@/lib/domain";

const outline = "#173c50";

function Scene({ children, sky = "#edf8f4" }: { children: React.ReactNode; sky?: string }) {
  return (
    <svg aria-hidden="true" className="h-40 w-full" viewBox="0 0 190 160">
      <rect fill={sky} height="132" rx="22" width="180" x="5" y="8" />
      <ellipse cx="95" cy="139" fill="#e6ddd0" rx="69" ry="9" />
      {children}
    </svg>
  );
}

export function StoryIllustration({ storyId }: { storyId: StoryId }) {
  if (storyId === "brave-knight" || storyId === "lost-shield" || storyId === "kings-ring") {
    return <GreenBandIllustration storyId={storyId} />;
  }

  if (storyId === "fat-cat") {
    return (
      <Scene sky="#fff0f4">
        <path d="M55 121h82l-9 20H64z" fill="#72c9d1" stroke={outline} strokeLinejoin="round" strokeWidth="4" />
        <path d="M67 59 58 37l23 11M119 49l20-12-8 24" fill="#ef9c4c" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
        <ellipse cx="97" cy="91" fill="#f4a654" rx="42" ry="39" stroke={outline} strokeWidth="5" />
        <path d="M69 72c8 5 12 6 18 2M108 74c7 4 13 3 18-2" fill="none" stroke="#c86c35" strokeLinecap="round" strokeWidth="4" />
        <circle cx="80" cy="83" fill={outline} r="3.5" /><circle cx="115" cy="83" fill={outline} r="3.5" />
        <path d="m92 94 6 5 6-5M98 99v7M98 106c-6 4-11 3-15 0M98 106c6 4 11 3 15 0" fill="none" stroke={outline} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        <path d="M62 94H41M63 102H39M132 94h20M131 102h22" stroke={outline} strokeLinecap="round" strokeWidth="3" />
      </Scene>
    );
  }

  if (storyId === "big-dog") {
    return (
      <Scene sky="#edf6ff">
        <path d="M62 56 39 35c-8 18-3 38 16 44M127 57l24-20c7 21 1 37-18 43" fill="#9a6036" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
        <ellipse cx="96" cy="91" fill="#c98549" rx="43" ry="42" stroke={outline} strokeWidth="5" />
        <path d="M63 114c17 17 49 20 67 1" fill="none" stroke="#278b8f" strokeWidth="10" />
        <circle cx="79" cy="83" fill={outline} r="4" /><circle cx="113" cy="83" fill={outline} r="4" />
        <ellipse cx="96" cy="99" fill="#4f332a" rx="9" ry="7" />
        <path d="M96 106c-2 9-12 9-16 4M96 106c2 9 12 9 16 4" fill="none" stroke={outline} strokeLinecap="round" strokeWidth="3" />
        <circle cx="96" cy="119" fill="#ffd451" r="7" stroke={outline} strokeWidth="3" />
      </Scene>
    );
  }

  if (storyId === "sun-bun") {
    return (
      <Scene sky="#fff8d9">
        <circle cx="147" cy="43" fill="#ffd451" r="20" stroke={outline} strokeWidth="4" />
        <path d="M147 13v10M147 63v10M117 43h10M167 43h10M126 22l7 7M161 57l7 7M168 22l-7 7M133 57l-7 7" stroke="#e9a928" strokeLinecap="round" strokeWidth="4" />
        <path d="M52 114c0-29 18-57 44-57s44 28 44 57c0 18-21 25-44 25s-44-7-44-25Z" fill="#d9954b" stroke={outline} strokeWidth="5" />
        <path d="M59 81c13 7 60 7 74 0" fill="none" stroke="#f6c983" strokeLinecap="round" strokeWidth="7" />
        <circle cx="81" cy="103" fill={outline} r="3.5" /><circle cx="111" cy="103" fill={outline} r="3.5" />
        <path d="M86 115c7 6 14 6 21 0" fill="none" stroke={outline} strokeLinecap="round" strokeWidth="3" />
      </Scene>
    );
  }

  if (storyId === "pig-in-mud") {
    return (
      <Scene sky="#f9ecf2">
        <ellipse cx="95" cy="129" fill="#93613d" rx="66" ry="15" stroke={outline} strokeWidth="4" />
        <path d="m60 67-17-18 5 29M129 68l18-19-5 30" fill="#f08ea5" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
        <ellipse cx="95" cy="93" fill="#f39aae" rx="45" ry="40" stroke={outline} strokeWidth="5" />
        <circle cx="78" cy="86" fill={outline} r="3.5" /><circle cx="113" cy="86" fill={outline} r="3.5" />
        <ellipse cx="95" cy="103" fill="#ef758f" rx="15" ry="11" stroke={outline} strokeWidth="3" />
        <circle cx="89" cy="103" fill={outline} r="2.4" /><circle cx="101" cy="103" fill={outline} r="2.4" />
        <path d="M58 118c10-4 14 5 23 1M110 120c8-6 16 4 25-1" fill="none" stroke="#6e472f" strokeLinecap="round" strokeWidth="5" />
      </Scene>
    );
  }

  if (storyId === "red-hen") {
    return (
      <Scene sky="#fff2e6">
        <ellipse cx="95" cy="102" fill="#dc5941" rx="43" ry="34" stroke={outline} strokeWidth="5" />
        <circle cx="126" cy="68" fill="#e66a4a" r="25" stroke={outline} strokeWidth="5" />
        <path d="m148 69 20 9-20 9Z" fill="#f2b53f" stroke={outline} strokeLinejoin="round" strokeWidth="4" />
        <path d="M113 45c1-15 13-17 17-5 6-11 18-5 14 7" fill="#d83e39" stroke={outline} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        <circle cx="133" cy="65" fill={outline} r="3" />
        <path d="M61 91 35 72l5 35 21 6" fill="#b9403b" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
        <path d="M83 132v13M108 133v12M76 145h14M101 145h14" stroke={outline} strokeLinecap="round" strokeWidth="4" />
        <circle cx="45" cy="131" fill="#f6c34c" r="9" stroke={outline} strokeWidth="3" /><circle cx="147" cy="131" fill="#f6c34c" r="9" stroke={outline} strokeWidth="3" />
      </Scene>
    );
  }

  if (storyId === "frog-log") {
    return (
      <Scene sky="#eaf7e7">
        <path d="M36 119c20-13 90-13 119 0l-12 24H48z" fill="#9a6036" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
        <circle cx="68" cy="103" fill="#d9ae68" r="9" stroke={outline} strokeWidth="3" /><path d="M128 108c7 5 12 5 19 0" fill="none" stroke="#704327" strokeLinecap="round" strokeWidth="4" />
        <ellipse cx="96" cy="89" fill="#65bc67" rx="37" ry="29" stroke={outline} strokeWidth="5" />
        <circle cx="76" cy="64" fill="#70c974" r="16" stroke={outline} strokeWidth="4" /><circle cx="116" cy="64" fill="#70c974" r="16" stroke={outline} strokeWidth="4" />
        <circle cx="76" cy="63" fill="white" r="8" /><circle cx="116" cy="63" fill="white" r="8" /><circle cx="77" cy="64" fill={outline} r="3" /><circle cx="115" cy="64" fill={outline} r="3" />
        <path d="M78 91c10 10 25 10 36 0" fill="none" stroke={outline} strokeLinecap="round" strokeWidth="4" />
        <path d="M68 107 52 119M124 106l17 13" stroke="#3b8a4b" strokeLinecap="round" strokeWidth="7" />
      </Scene>
    );
  }

  if (storyId === "bears-hat") {
    return (
      <Scene sky="#fff5d9">
        <circle cx="61" cy="66" fill="#9c693f" r="16" stroke={outline} strokeWidth="4" /><circle cx="129" cy="66" fill="#9c693f" r="16" stroke={outline} strokeWidth="4" />
        <ellipse cx="95" cy="95" fill="#b97d49" rx="45" ry="42" stroke={outline} strokeWidth="5" />
        <path d="m59 56 25-28 49 18-12 17Z" fill="#ffd451" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
        <path d="M51 58c25 5 54 8 87 2" fill="none" stroke="#e59628" strokeLinecap="round" strokeWidth="7" />
        <circle cx="80" cy="91" fill={outline} r="3.5" /><circle cx="111" cy="91" fill={outline} r="3.5" />
        <ellipse cx="96" cy="105" fill="#e1ad78" rx="17" ry="13" />
        <ellipse cx="96" cy="101" fill="#4f332a" rx="7" ry="5" />
        <path d="M96 106c0 7-8 9-13 5M96 106c0 7 8 9 13 5" fill="none" stroke={outline} strokeLinecap="round" strokeWidth="3" />
      </Scene>
    );
  }

  if (storyId === "ship-trip") {
    return (
      <Scene sky="#e6f6fb">
        <circle cx="148" cy="36" fill="#ffd451" r="14" />
        <path d="M28 126c13-12 26 12 40 0s27 12 41 0 27 12 53 0v19H28z" fill="#55bdcb" stroke={outline} strokeLinejoin="round" strokeWidth="4" />
        <path d="M52 102h92l-17 28H68z" fill="#e05847" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
        <path d="M91 49v54" stroke={outline} strokeLinecap="round" strokeWidth="5" />
        <path d="m96 52 39 22-39 18Z" fill="#ffd451" stroke={outline} strokeLinejoin="round" strokeWidth="4" />
        <path d="m86 61-24 16 24 10Z" fill="#f7f1df" stroke={outline} strokeLinejoin="round" strokeWidth="4" />
        <circle cx="83" cy="114" fill="#fff5d9" r="5" /><circle cx="105" cy="114" fill="#fff5d9" r="5" /><circle cx="127" cy="114" fill="#fff5d9" r="5" />
      </Scene>
    );
  }

  return (
    <Scene sky="#fff0dc">
      <path d="M52 76h86v64H52z" fill="#d8954d" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
      <path d="M52 77h86l-18 23H70z" fill="#e9ad66" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
      <path d="M77 96c-15-19-9-47 15-55 23-7 42 6 45 26-18-7-28 0-33 15" fill="#e16b3d" stroke={outline} strokeLinejoin="round" strokeWidth="5" />
      <path d="M83 60 69 43l23 5M120 50l16-9-5 21" fill="#e16b3d" stroke={outline} strokeLinejoin="round" strokeWidth="4" />
      <path d="M91 64c8 10 18 13 30 10-3 14-12 22-26 24" fill="#fff1dc" stroke={outline} strokeLinejoin="round" strokeWidth="4" />
      <circle cx="108" cy="64" fill={outline} r="3" />
      <path d="M116 73c5 3 10 3 14 0" fill="none" stroke={outline} strokeLinecap="round" strokeWidth="3" />
      <path d="M51 112h87" stroke="#a76436" strokeWidth="4" />
    </Scene>
  );
}
