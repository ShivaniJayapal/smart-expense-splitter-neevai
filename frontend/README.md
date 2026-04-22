# SplitWise - Expense Splitter Frontend

A modern, professional, and highly dynamic expense splitting application frontend built with React, featuring beautiful animations and a premium dark theme.

## Features

### 🎨 UI/UX Excellence
- **Modern Dark Theme**: Premium color scheme with purple accents and smooth gradients
- **Smooth Animations**: Powered by Framer Motion for elegant page transitions and interactions
- **Professional Typography**: DM Sans for body text and Playfair Display for headings
- **Responsive Design**: Fully optimized for desktop, tablet, and mobile devices
- **Premium Components**: Beautifully crafted cards, modals, and interactive elements

### 💰 Core Features
- **User Authentication**: Secure login and registration with JWT tokens
- **Group Management**: Create and manage expense groups with friends
- **Expense Tracking**: Add, view, and delete expenses with detailed information
- **Smart Splitting**: Flexible expense splitting among group members
- **Settlement Tracking**: Automatic calculation of who owes whom
- **Real-time Dashboard**: Overview of all expenses and financial status
- **Toast Notifications**: Beautiful, non-intrusive notifications for user feedback

### 📊 Dashboard Features
- **Statistics Cards**: Quick overview of total expenses, what you owe, and what's owed to you
- **Group Cards**: Beautiful cards showing group info with member avatars
- **Expense Lists**: Detailed expense history with member information
- **Settlement Lists**: Track and mark settlements as complete

## Project Structure

```
frontend/
├── public/
│   └── index.html                 # HTML entry point
├── src/
│   ├── pages/
│   │   ├── Login.js              # Login page with authentication
│   │   ├── Register.js           # Registration page
│   │   ├── Dashboard.js          # Main dashboard with overview
│   │   ├── GroupDetail.js        # Detailed group view
│   │   └── CreateGroup.js        # Create new group page
│   ├── components/
│   │   ├── Layout.js             # Main layout wrapper
│   │   ├── Header.js             # Top navigation header
│   │   ├── Sidebar.js            # Navigation sidebar
│   │   ├── GroupCard.js          # Group card component
│   │   ├── StatCard.js           # Statistics card
│   │   ├── ExpenseForm.js        # Add expense modal
│   │   ├── ExpenseList.js        # Display expenses
│   │   └── SettlementList.js     # Display settlements
│   ├── context/
│   │   └── AuthContext.js        # Authentication state management
│   ├── utils/
│   │   └── api.js                # Axios API configuration
│   ├── styles/
│   │   ├── global.css            # Global styles and variables
│   │   ├── auth.css              # Authentication pages
│   │   ├── dashboard.css         # Dashboard page
│   │   ├── group-detail.css      # Group detail page
│   │   ├── group-create.css      # Create group page
│   │   ├── layout.css            # Layout styles
│   │   ├── header.css            # Header styles
│   │   ├── sidebar.css           # Sidebar styles
│   │   ├── cards.css             # Card components
│   │   ├── modal.css             # Modal styles
│   │   └── lists.css             # List components
│   ├── App.js                    # Main app component
│   └── index.js                  # React entry point
└── package.json                  # Dependencies and scripts
```

## Design System

### Color Palette
- **Primary Background**: `#0a0a1a` - Deep dark blue
- **Card Background**: `#16162e` - Slightly lighter dark blue
- **Accent Color**: `#6c63ff` - Vibrant purple
- **Accent Light**: `#8b85ff` - Lighter purple
- **Success**: `#10d977` - Fresh green
- **Error**: `#ff5f6d` - Soft red
- **Warning**: `#ffd27d` - Warm yellow

### Typography
- **Headings**: Playfair Display (serif)
  - H1: 2.2rem
  - H2: 1.6rem
  - H3: 1.2rem
- **Body**: DM Sans (sans-serif)
  - Regular: 0.95rem
  - Small: 0.85rem
  - Micro: 0.75rem

### Spacing & Radius
- **Border Radius**: 16px (cards), 10px (buttons), 6px (inputs)
- **Spacing Scale**: 8px, 12px, 16px, 20px, 24px, 32px, 40px

## Key Technologies

- **React 18.2**: Modern React with hooks
- **React Router v6**: Client-side routing
- **Axios**: HTTP client with interceptors
- **Framer Motion**: Smooth animations
- **Lucide React**: Beautiful SVG icons
- **React Hot Toast**: Toast notifications
- **Recharts**: Data visualization (prepared for future analytics)

## Animations & Interactions

### Page Transitions
- Fade and slide animations for page changes
- Staggered animations for list items
- Smooth spring transitions for modals

### Interactive Elements
- Button hover effects with elevation
- Card hover effects with shadow and elevation
- Icon animations (float, spin, bounce)
- Dropdown transitions
- Form input focus effects with glow

## Installation & Setup

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm build
```

The app will run on `http://localhost:3000` (or another port if 3000 is in use)

## API Integration

The frontend communicates with the backend API at `http://localhost:5000/api`

### Key Endpoints Used:
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/me` - Get current user
- `GET /groups` - List user's groups
- `POST /groups` - Create new group
- `GET /groups/:id` - Get group details
- `GET /groups/:id/expenses` - Get group expenses
- `POST /groups/:id/expenses` - Add expense
- `GET /groups/:id/settlements` - Get settlements
- `DELETE /expenses/:id` - Delete expense
- `GET /expenses/stats` - Get user statistics

## Features Highlight

### 🔐 Authentication
- Secure JWT token-based authentication
- Automatic token refresh and error handling
- Protected routes with automatic redirects

### 📱 Responsive Layout
- Sidebar that collapses on mobile
- Flexible grid layouts
- Touch-friendly buttons and inputs
- Adaptive typography

### 💾 State Management
- React Context API for authentication
- Local storage for token persistence
- Automatic logout on token expiration

### ✨ User Experience
- Loading states with spinners
- Toast notifications for all actions
- Empty states with helpful messages
- Smooth transitions between pages
- Intuitive navigation

### 🎯 Performance
- Code splitting with lazy loading (prepared)
- Optimized re-renders
- Efficient API calls
- Cached user data

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Future Enhancements

- Analytics dashboard with charts
- Payment method integration
- Real-time updates with WebSockets
- Photo uploads for expenses
- Search and filter capabilities
- Monthly reports and exports
- Dark/Light theme toggle
- Multi-language support

## Styling Guidelines

All styles are organized in the `src/styles/` directory:
- `global.css`: Root variables, resets, typography
- Page-specific CSS for each major page
- Component-specific CSS for reusable components

CSS Variables make it easy to maintain consistency and update the design system globally.

## Contributing

When adding new features:
1. Create components in `src/components/`
2. Create pages in `src/pages/`
3. Add styles in `src/styles/`
4. Import styles in components/pages
5. Use existing color variables for consistency
6. Follow the established component patterns

## License

Proprietary - All rights reserved

---

Built with ❤️ for smart expense splitting
