#!/usr/bin/env node

/**
 * Migration Script: Clean up corrupted remittance data
 *
 * This script deletes accepted remittances that were created with buggy code
 * where amounts incorrectly represented commission payments instead of COD collections.
 *
 * Usage:
 *   node cleanup-remittances.js
 */

import fetch from "node-fetch";
import readline from "readline";

const API_URL = process.env.API_URL || "http://localhost:4000";
const TOKEN = process.env.AUTH_TOKEN; // Set your admin/user token here

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function cleanupRemittances() {
  console.log("\n🔧 COD Remittance Cleanup Script\n");
  console.log(
    "This will delete ALL accepted remittances to fix the calculation bug."
  );
  console.log("Drivers will need to re-submit their COD collections.\n");

  const confirm = await question(
    "Are you sure you want to proceed? (yes/no): "
  );

  if (confirm.toLowerCase() !== "yes") {
    console.log("❌ Cancelled");
    rl.close();
    return;
  }

  if (!TOKEN) {
    console.error("\n❌ Error: AUTH_TOKEN environment variable not set");
    console.log("Please set your admin/user authentication token:");
    console.log('  export AUTH_TOKEN="your-jwt-token-here"');
    rl.close();
    process.exit(1);
  }

  try {
    console.log("\n🔄 Cleaning up corrupted remittances...\n");

    const response = await fetch(
      `${API_URL}/api/finance/migrate/cleanup-corrupted-remittances`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({
          confirmDelete: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error:", data.message || "Unknown error");
      rl.close();
      process.exit(1);
    }

    console.log("✅ Success!");
    console.log(`   ${data.message}`);
    console.log(`   Deleted: ${data.deletedCount} remittance(s)`);
    console.log(`\n${data.note}\n`);

    rl.close();
  } catch (error) {
    console.error("\n❌ Request failed:", error.message);
    rl.close();
    process.exit(1);
  }
}

cleanupRemittances();
