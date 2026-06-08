import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  createNavbarIconOption,
  normalizeNavbarIconFilename,
} from "../sections/usermenu/icons";

const NAVBAR_ICON_DIR = path.join(process.cwd(), "public/assets/icons/navbar");

const toOption = (filename) =>
  createNavbarIconOption(normalizeNavbarIconFilename(filename));

export function getNavbarIconOptions() {
  let entries = [];

  try {
    entries = fs.readdirSync(NAVBAR_ICON_DIR, { withFileTypes: true });
  } catch (error) {
    console.error(
      "Failed to read navbar icons directory at",
      NAVBAR_ICON_DIR,
      error
    );
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".svg"))
    .map((entry) => toOption(entry.name))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default getNavbarIconOptions;
