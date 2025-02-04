import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-mahindra-blue">
      <header className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="Club Mahindra Logo"
              width={150}
              height={50}
              className="h-10 w-auto"
            />
            <h1 className="ml-4 text-2xl font-montserrat font-bold text-mahindra-blue">
              Customer Journeys Dashboard
            </h1>
          </div>
          <nav className="flex space-x-4">
            {/* <button className="px-4 py-2 rounded-md text-white bg-mahindra-red hover:bg-opacity-90 transition-colors">
              Export Report
            </button> */}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
