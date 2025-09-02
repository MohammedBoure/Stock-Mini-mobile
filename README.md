# Stock Mini Mobile

A mobile-friendly web application for managing stock, orders, borrowers, and statistics, with support for multiple languages and offline capabilities.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Dependencies](#dependencies)
- [Contributing](#contributing)
- [Live Demo](#live-demo)

## Overview
Stock Mini Mobile is a lightweight stock management application designed for small businesses. It allows users to manage products, track orders, handle borrower records, and view statistics. The app kiem supports Arabic, English, and French languages and includes offline functionality via a service worker.

## Features
- **Product Management**: Add, edit, and delete products with details like name, price, and quantity.
- **Order Tracking**: Create and manage orders with associated product and borrower information.
- **Borrower Management**: Track borrower details and their borrowing history.
- **Statistics**: Visualize data with charts for insights into stock and sales performance.
- **Multi-language Support**: Switch between Arabic, English, and French.
- **Offline Support**: Use the app offline with service worker caching.
- **Audio Feedback**: Includes a scanner beep sound for product scanning.
- **Responsive Design**: Optimized for mobile and desktop devices.

## Project Structure
The project is organized as follows:

```
src/
├── assets/                     # Audio and media files
│   └── store-scanner-beep-90395.mp3
├── css/                        # Stylesheets for different app sections
│   ├── borrowers.css           # Borrower page styles
│   ├── import_export.css       # Import/export page styles
│   ├── install_css.css         # Installation page styles
│   ├── orders.css              # Orders page styles
│   ├── products.css            # Products page styles
│   ├── shared.css              # Shared styles across pages
│   └── statistics.css          # Statistics page styles
├── icons/                      # App icons for PWA
│   ├── icon-192x192.png
│   └── icon-512x512.png
├── js/                         # Core JavaScript logic
│   ├── borrowers.js            # Borrower-related logic
│   ├── db.js                   # Database operations (SQLite via sql.js)
│   ├── import_export.js        # Import/export functionality
│   ├── language.js             # Language switching logic
│   ├── main.js                 # Main app logic
│   ├── orders.js               # Order-related logic
│   ├── products.js             # Product-related logic
│   ├── script.js               # General scripts
│   └── statistics.js           # Statistics logic
├── languages/                  # Language JSON files
│   ├── ar.json                 # Arabic translations
│   ├── en.json                 # English translations
│   └── fr.json                 # French translations
├── libs/                       # External libraries
│   ├── chart.umd.min.js        # Chart.js for visualizations
│   ├── sql-wasm.js             # SQL.js for WebAssembly SQLite
│   └── sql-wasm.wasm           # WebAssembly binary for SQL.js
├── ui/                         # UI-specific JavaScript
│   ├── borrowers_ui.js         # Borrower UI logic
│   ├── orders_ui.js            # Orders UI logic
│   ├── products_ui.js          # Products UI logic
│   └── statistics_ui.js        # Statistics UI logic
├── borrowers.html              # Borrower management page
├── import_export.html          # Import/export page
├── index.html                  # Main entry point
├── manifest.json               # PWA manifest
├── orders.html                 # Orders page
├── products.html               # Products page
├── service-worker.js           # Service worker for offline support
└── statistics.html             # Statistics page
```

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/MohammedBoureMohammedBoure/Stock-mini-mobile.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Stock-mini-mobile/src
   ```
3. Run the application using a local server (e.g., Python's HTTP server):
   ```bash
   python -m http.server 8000
   ```
4. Open your browser and visit `http://localhost:8000`.

For development, ensure you have Python installed to run the `ProjectLens` module or any other local server.

## Usage
- **Home Page**: Access the main dashboard via `index.html`.
- **Products**: Manage inventory in `products.html`.
- **Orders**: Track and create orders in `orders.html`.
- **Borrowers**: Manage borrower records in `borrowers.html`.
- **Statistics**: View charts and insights in `statistics.html`.
- **Import/Export**: Import or export data in `import_export.html`.
- **Language Switching**: Use the language toggle to switch between Arabic, English, and French.
- **Offline Mode**: Install the app as a Progressive Web App (PWA) for offline use.

## Dependencies
- **Chart.js**: For rendering charts in the statistics section.
- **SQL.js**: WebAssembly-based SQLite for client-side database operations.
- **Service Worker**: For offline functionality and caching.
- **Web Browser**: A modern browser supporting WebAssembly and PWAs (e.g., Chrome, Firefox).

## Contributing
Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make your changes and commit (`git commit -m "Add feature"`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a pull request.

Please ensure your code follows the project's coding style and includes relevant tests.

## Live Demo
You can try the live demo of the application at [https://stock-mini-mobile.onrender.com](https://stock-mini-mobile.onrender.com).
