# TambayanPH ScrubAI

A comprehensive call center management system with real-time call monitoring, auto-dialer, and agent dashboard.

## Features

- **Call Monitoring & Control** - Real-time call status dashboard, live audio monitoring, whisper/barge-in capabilities
- **Dialer System** - Campaign management, lead import, preview/progressive dial modes
- **Agent Dashboard** - Call disposition logging, performance metrics, call history
- **Admin Panel** - User management, campaign analytics, reports

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, Socket.io-client
- **Backend**: Node.js, Express.js, Socket.io
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT

## Prerequisites

- Node.js 18+
- MongoDB
- Redis (optional, for caching)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/BenLorenzoDev/TambayanPH-ScrubAI.git
cd TambayanPH-ScrubAI
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp server/.env.example server/.env
# Edit server/.env with your configuration
```

4. Start development servers:
```bash
npm run dev
```

This will start both the backend server (port 5000) and frontend dev server (port 5173).

## Project Structure

```
TambayanPH-ScrubAI/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React context providers
│   │   ├── services/       # API services
│   │   └── styles/         # CSS/Tailwind styles
│   └── ...
├── server/                 # Express Backend
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── socket/         # WebSocket handlers
│   └── ...
└── docs/                   # Documentation
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/status` - Update agent status

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign details
- `PATCH /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Leads
- `GET /api/leads` - List leads
- `POST /api/leads` - Create lead
- `GET /api/leads/next/:campaignId` - Get next lead for dialing
- `GET /api/leads/:id` - Get lead details
- `PATCH /api/leads/:id` - Update lead

### Calls
- `GET /api/calls` - List calls
- `POST /api/calls/initiate` - Initiate a call
- `POST /api/calls/:id/end` - End a call
- `POST /api/calls/:id/transfer` - Transfer a call
- `GET /api/calls/active` - Get active calls

## Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/tambayanph-scrubai
JWT_SECRET=your-secret-key
CLIENT_URL=http://localhost:5173
```

## Development

```bash
# Run both client and server
npm run dev

# Run only server
npm run dev:server

# Run only client
npm run dev:client

# Build for production
npm run build
```

## License

MIT
