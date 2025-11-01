# Cloud Spreadsheet App

A cloud-based spreadsheet web application built with React and Firebase.

## Features

- Grid-based spreadsheet interface
- Cell editing with text and numbers
- **Formula support**: SUM, AVERAGE, COUNT, MIN, MAX, IF with auto-calculation
- Real-time auto-save to Firebase Firestore
- Undo/Redo functionality
- **Import/Export**: Drag-and-drop or file picker for CSV/Excel import, export to CSV or Excel
- **Real-time collaboration**: See colored cursors of other users with their names
- **Presence indicators**: Header shows online users
- Instant updates when any user makes changes
- **Sharing system**: Generate shareable links with view-only or edit permissions
- **Version history**: Timestamped changes with user names, preview and restore functionality
- **Commenting system**: Right-click cells to add/view comments, comment threads in side panel
- **Mobile optimization**: Touch-friendly interface, pinch-to-zoom, horizontal scrolling, responsive design
- **Web optimization**: Keyboard navigation, context menus, enhanced hover states, smooth animations, accessibility features

## Setup

1. Set up a Firebase project at https://console.firebase.google.com/
2. Enable Firestore database and Authentication (Anonymous sign-in)
3. Get your Firebase config and replace in `src/firebase.ts`
4. Run `npm install`
5. Run `npm start` for development
6. Run `npm run build` for production

## Deployment

The app is built as a single-page application and can be deployed to any static hosting like Netlify, Vercel, or Firebase Hosting.

For collaboration, ensure Firestore security rules allow read/write access for authenticated users.
