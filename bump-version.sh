#!/bin/bash

# Exit on error
set -e

# Check if version type is provided
if [ -z "$1" ]; then
    echo "Usage: ./bump-version.sh [major|minor|patch]"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Bump version based on argument
case $1 in
    "major")
        NEW_VERSION=$(node -p "require('semver').inc('$CURRENT_VERSION', 'major')")
        ;;
    "minor")
        NEW_VERSION=$(node -p "require('semver').inc('$CURRENT_VERSION', 'minor')")
        ;;
    "patch")
        NEW_VERSION=$(node -p "require('semver').inc('$CURRENT_VERSION', 'patch')")
        ;;
    *)
        echo "Invalid version type. Use major, minor, or patch"
        exit 1
        ;;
esac

# Update version in package.json
npm version $NEW_VERSION --no-git-tag-version

# Update version in manifest.json
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('./extension/manifest.json', 'utf8'));
manifest.version = '$NEW_VERSION';
fs.writeFileSync('./extension/manifest.json', JSON.stringify(manifest, null, 2));
"

# Build the extension
echo "Building extension..."
npm run build

# Create git commit
git add package.json package-lock.json extension/manifest.json
git commit -m "chore: bump version to $NEW_VERSION"

echo "Version bumped to $NEW_VERSION and extension built successfully!" 