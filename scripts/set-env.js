#!/usr/bin/env node

/**
 * Build script for Vercel deployment
 * Replaces placeholder in environment.prod.ts with actual environment variable
 */

const fs = require("fs");
const path = require("path");

// __dirname is scripts/, so go up one level to project root
const envProdPath = path.join(
  __dirname,
  "..",
  "src",
  "environments",
  "environment.prod.ts"
);
const apiBaseUrl = process.env.NG_APP_API_BASE_URL || "";

console.log(
  "[Build] Setting API_BASE_URL to:",
  apiBaseUrl || "(empty - will use relative URLs)"
);

// Read the template file
let content = fs.readFileSync(envProdPath, "utf8");

// Replace the placeholder
content = content.replace("{{NG_APP_API_BASE_URL}}", apiBaseUrl);

// Write back
fs.writeFileSync(envProdPath, content, "utf8");

console.log("[Build] Environment file updated successfully");
