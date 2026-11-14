"use client";

import { useEffect } from "react";

// Pings the database health endpoint once and logs the result to the browser console.
export function DbStatusLogger() {
  useEffect(() => {
    fetch("/api/health/db")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          console.log("✅ Radius.ai: database connected successfully", data);
        } else {
          console.error("❌ Radius.ai: database connection failed", data);
        }
      })
      .catch((err) => console.error("❌ Radius.ai: could not reach the health endpoint", err));
  }, []);

  return null;
}
