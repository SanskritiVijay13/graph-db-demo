# Club Mahindra Membership Network Analytics Dashboard

An interactive dashboard built with Next.js and MongoDB to visualize and analyze the Club Mahindra membership referral network. This application provides deep insights into member relationships, referral patterns, and network health metrics.

## Features

- **3D Network Visualization**: Interactive force-directed graph showing member relationships
- **Real-time Analytics**: Network health metrics and membership distribution
- **Member Profiles**: Detailed member information with achievements and referral history
- **Performance Optimized**: Built for handling large-scale membership networks
- **Responsive Design**: Fully responsive interface following Club Mahindra's brand guidelines

## Tech Stack

- **Frontend**: Next.js 13+ with App Router
- **Styling**: TailwindCSS with Club Mahindra's design system
- **3D Graphics**: Three.js with React Three Fiber
- **Data Visualization**: D3.js, Nivo
- **Database**: MongoDB with graph capabilities
- **Animation**: Framer Motion
- **State Management**: React Query

## Prerequisites

- Node.js 18+
- MongoDB 6.0+
- npm or yarn

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/club-mahindra-network.git
   cd club-mahindra-network
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file with:
   ```
   MONGODB_URI=your_mongodb_connection_string
   ```

4. Seed the database:
   ```bash
   npm run seed
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/         
│   ├── analytics/      # Analytics components
│   ├── layout/         # Layout components
│   ├── members/        # Member-related components
│   └── network/        # Network visualization components
├── models/             # TypeScript interfaces and types
└── utils/              # Utility functions
```

## Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run seed`: Seed the database with sample data
- `npm run lint`: Run ESLint

## Design System

The dashboard follows Club Mahindra's brand guidelines:

### Colors
- Primary:
  - Mahindra Red: #E31837
  - Deep Blue: #00233D
  - Gold: #C5A572
- Secondary:
  - Light Blue: #007CC3
  - Forest Green: #1C8A42
  - Sand: #F2E6D9

### Typography
- Primary: Montserrat
- Secondary: Open Sans

## Performance Considerations

- Lazy loading for large networks
- Progressive rendering for complex visualizations
- Efficient data caching
- Optimized MongoDB queries
- Client-side data management

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is proprietary and confidential to Club Mahindra.

## Acknowledgments

- Club Mahindra design team for brand guidelines
- MongoDB team for graph database capabilities
- Next.js team for the amazing framework
