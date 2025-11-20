#!/bin/bash
echo "Installing server dependencies..."
npm install

echo "Installing client dependencies..."
cd client
npm install

echo "Building React app..."
npm run build

echo "Build completed successfully!"