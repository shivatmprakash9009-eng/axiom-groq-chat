import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TIWAT — Think clearly. Move faster.",
    short_name: "TIWAT",
    description: "A calm, intelligent workspace for your ideas, research, and work.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#09090b",
    theme_color: "#09090b",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/tiwat-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/tiwat-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
