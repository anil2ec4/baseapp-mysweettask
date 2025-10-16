const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "",
    payload: "",
    signature: ""
  },
  miniapp: {
    version: "1",
    name: "My Sweet Tasks", 
    subtitle: "Plan. Split. Relax.", 
    description: "A beautifully sweet mini app to plan, share, and track your daily tasks — right on Base.",
    screenshotUrls: [`${ROOT_URL}/mysweettask-portrait.png`],
    iconUrl: `${ROOT_URL}/mysweettask-icon.png`,
    splashImageUrl: `${ROOT_URL}/mysweettask-hero.png`,
    splashBackgroundColor: "#f9c5d5",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "productivity",
    tags: ["quickstart", "tasks", "planning", "baseapp", "productivity"],
    heroImageUrl: `${ROOT_URL}/mysweettask-hero.png`, 
    tagline: "Your cutest task manager 💖",
    ogTitle: "My Sweet Tasks",
    ogDescription: "Stay productive and have fun with My Sweet Tasks — the candy-colored to-do app built for Base users.",
    ogImageUrl: `${ROOT_URL}/mysweettask-hero.png`,
  },
} as const;

