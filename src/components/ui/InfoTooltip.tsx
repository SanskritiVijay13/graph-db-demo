import { Popover } from '@headlessui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';

interface InfoTooltipProps {
  content: ReactNode;
  className?: string;
}

export function InfoTooltip({ content, className = '' }: InfoTooltipProps) {
  return (
    <Popover className="relative inline-block min-w-lg z-50">
      <Popover.Button className={`inline-flex items-center ${className}`}>
        <InformationCircleIcon className="h-4 w-4 text-slate-400 hover:text-blue-500 transition-colors" />
      </Popover.Button>

      <Popover.Panel className="absolute z-10 px-4 py-3 -translate-x-1/2 left-1/2 mt-2 bg-slate-800 text-white text-lg rounded-lg shadow-lg min-w-[300px]">
        <div className="relative">
          {/* Arrow */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-slate-800 min-w-lg"/>
          {content}
        </div>
      </Popover.Panel>
    </Popover>
  );
}
