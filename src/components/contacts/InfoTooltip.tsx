import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface InfoTooltipProps {
  title: string;
  summary: string;
  points: string[];
  className?: string;
}

export function InfoTooltip({ title, summary, points, className = '' }: InfoTooltipProps) {
  return (
    <Popover as="span" className={`relative inline-block ${className}`}>
      <PopoverButton className="inline-flex items-center align-middle">
        <InformationCircleIcon className="h-4 w-4 text-mongodb-slate/40 hover:text-mongodb-clear-blue transition-colors" />
      </PopoverButton>

      <PopoverPanel
        anchor="bottom start"
        className="z-50 mt-2 w-72 rounded-lg bg-mongodb-evergreen text-mongodb-mist text-xs p-4 shadow-lg"
      >
        <p className="font-semibold text-mongodb-spring-green mb-1">{title}</p>
        <p className="mb-2">{summary}</p>
        <ul className="list-disc list-inside space-y-1">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </PopoverPanel>
    </Popover>
  );
}
