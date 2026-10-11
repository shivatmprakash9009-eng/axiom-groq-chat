"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export function Analytics() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      defaults: "2025-11-30",
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: false,
      session_recording: { maskAllInputs: true, maskTextSelector: ".private-content" },
    });
  }, []);
  return null;
}
