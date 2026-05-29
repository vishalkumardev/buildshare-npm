# 🚀 BuildShare CLI

> Production-grade cross-platform CLI tool for distributing Android APK/AAB and iOS IPA builds.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)]()

---

## 📦 Installation

```bash
# Install globally
npm install -g buildshare

# Or use npx
npx buildshare --help
```

## ⚡ Quick Start

```bash
# 1. Authenticate
buildshare login

# 2. Initialize project
buildshare init

# 3. Upload builds
buildshare upload android
buildshare upload ios

# 4. Check configuration
buildshare doctor
```

---

## 🔐 Authentication

### Interactive Login
```bash
buildshare login
```
Choose between email/password or API token authentication.

### CI/CD Token
```bash
buildshare login --token <your-api-token>
```

### Non-Interactive
```bash
buildshare login --email user@example.com --password yourpassword
```

### Logout
```bash
buildshare logout
buildshare logout --force   # Skip confirmation
```

**Token storage locations:**
| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/buildshare/` |
| Linux | `~/.config/buildshare/` |
| Windows | `%APPDATA%/buildshare/` |

---

## 📋 Project Initialization

```bash
buildshare init
```

Creates `.buildshare/project.json`:
```json
{
  "projectId": "proj_abc123",
  "projectName": "My App",
  "androidPath": "./app/build/outputs/apk/release/app.apk",
  "iosPath": "./build/MyApp.ipa",
  "defaultBranch": "main"
}
```

### Non-Interactive
```bash
buildshare init --project-name "My App" --android-path ./app.apk --ios-path ./app.ipa -y
```

---

## 📤 Upload Builds

### Android
```bash
# Interactive
buildshare upload android

# Non-interactive
buildshare upload android --file ./app.apk --changelog "Bug fixes" --release production
```

### iOS
```bash
# Interactive
buildshare upload ios

# Non-interactive
buildshare upload ios --file ./app.ipa --changelog "v2.0 release" --release staging
```

### Upload Features
- ✅ Chunked multipart upload for large files
- ✅ Parallel chunk uploads
- ✅ Automatic retry with exponential backoff
- ✅ Resume interrupted uploads
- ✅ SHA-256 checksum verification
- ✅ Real-time progress bar with speed & ETA
- ✅ QR code for instant install

---

## 🩺 Doctor

```bash
buildshare doctor
```

Checks:
- Configuration directory
- Authentication status
- Project configuration
- Build file paths
- Git repository
- Node.js version
- API connectivity

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BUILDSHARE_API_URL` | `https://api.buildshare.io` | API base URL |
| `BUILDSHARE_API_VERSION` | `v1` | API version |
| `BUILDSHARE_DEBUG` | `false` | Enable debug logs |
| `BUILDSHARE_VERBOSE` | `false` | Verbose output |
| `BUILDSHARE_CHUNK_SIZE` | `5242880` | Upload chunk size (bytes) |
| `BUILDSHARE_MAX_RETRIES` | `3` | Max retry attempts |
| `BUILDSHARE_PARALLEL_CHUNKS` | `3` | Parallel chunk uploads |
| `BUILDSHARE_CI` | `false` | CI/CD mode |
| `BUILDSHARE_API_TOKEN` | - | API token for CI/CD |

### Global Flags

```bash
buildshare --debug       # Enable debug mode
buildshare --verbose     # Enable verbose logging
buildshare --version     # Show version
buildshare --help        # Show help
```



## 🤖 CI/CD Integration

```yaml
# GitHub Actions
- name: Upload to BuildShare
  env:
    BUILDSHARE_API_TOKEN: ${{ secrets.BUILDSHARE_TOKEN }}
    BUILDSHARE_CI: true
  run: |
    npx buildshare upload android \
      --file ./app.apk \
      --changelog "Build ${{ github.run_number }}" \
      --release development
```

---

## 📄 License

MIT
