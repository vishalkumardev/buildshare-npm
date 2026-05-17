/**
 * Application constants for BuildShare CLI
 */

import path from "path";
import os from "os";

// ─── App Info ────────────────────────────────────────────────────────────────

export const APP_NAME = "buildshare";
export const APP_VERSION = "1.0.0";
export const APP_DESCRIPTION =
  "BuildShare CLI — Distribute Android & iOS builds effortlessly";

// ─── Config Directories ─────────────────────────────────────────────────────

function getConfigDir(): string {
  const platform = os.platform();

  switch (platform) {
    case "darwin":
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        APP_NAME,
      );
    case "win32":
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
        APP_NAME,
      );
    default:
      // Linux and others
      return path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
        APP_NAME,
      );
  }
}

export const CONFIG_DIR = getConfigDir();
export const AUTH_FILE = path.join(CONFIG_DIR, "auth.json");
export const SETTINGS_FILE = path.join(CONFIG_DIR, "settings.json");

// ─── Project Config ──────────────────────────────────────────────────────────

export const PROJECT_DIR = ".buildshare";
export const PROJECT_CONFIG_FILE = "project.json";
export const UPLOAD_STATE_DIR = ".uploads";

// ─── API Defaults ────────────────────────────────────────────────────────────

export const DEFAULT_API_URL = "http://localhost:8100/api";
export const DEFAULT_API_VERSION = "v1";
export const API_TIMEOUT = 30000; // 30 seconds

// ─── API Endpoints ───────────────────────────────────────────────────────────

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/user/login",
    REFRESH: "/auth/refresh",
    VALIDATE: "/auth/validate",
  },
  PROJECTS: {
    LIST: "/apps/list",
    CREATE: "/apps/create",
    GET: (id: string) => `/projects/${id}`,
  },
  BUILDS: {
    UPLOAD_INITIATE: "/builds/upload/initiate",
    UPLOAD_CHUNK: "/builds/upload/chunk",
    UPLOAD_COMPLETE: "/builds/upload/complete",
  },
} as const;

// ─── Upload Config ───────────────────────────────────────────────────────────

export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
export const MIN_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
export const MAX_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_RETRIES = 3;
export const PARALLEL_CHUNKS = 3;
export const UPLOAD_TIMEOUT = 300000; // 5 minutes

// ─── File Types ──────────────────────────────────────────────────────────────

export const ANDROID_EXTENSIONS = [".apk", ".aab"];
export const IOS_EXTENSIONS = [".ipa"];
export const ALL_EXTENSIONS = [...ANDROID_EXTENSIONS, ...IOS_EXTENSIONS];

export const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024; // 4GB

// ─── Encryption ──────────────────────────────────────────────────────────────

export const ENCRYPTION_ALGORITHM = "aes-256-gcm";
export const ENCRYPTION_KEY_LENGTH = 32;
export const ENCRYPTION_IV_LENGTH = 16;
export const ENCRYPTION_TAG_LENGTH = 16;

// ─── UI ──────────────────────────────────────────────────────────────────────

export const BANNER = `
╔══════════════════════════════════════════════╗
║                                              ║
║      BuildShare CLI  v${APP_VERSION}         ║
║     Distribute builds effortlessly           ║
║                                              ║
╚══════════════════════════════════════════════╝
`;

export const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];

// ─── Release Types ───────────────────────────────────────────────────────────

export const RELEASE_TYPES = [
  { name: "🔧  Development", value: "development" },
  { name: "🧪  Staging", value: "staging" },
  { name: "🚀  Production", value: "production" },
] as const;

// ─── Exit Codes ──────────────────────────────────────────────────────────────

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  AUTH_ERROR: 2,
  CONFIG_ERROR: 3,
  UPLOAD_ERROR: 4,
  NETWORK_ERROR: 5,
  VALIDATION_ERROR: 6,
} as const;
