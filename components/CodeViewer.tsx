import React, { useState, useRef } from 'react';
import Button from './Button';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { cn } from '../lib/utils';

interface CodeViewerProps {
  code: string;
  onCopy: () => void;
  copyStatus: 'idle' | 'copied';
}

const CodeViewer: React.FC<CodeViewerProps> = ({ code, onCopy, copyStatus }) => {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = () => {
    setIsScrolling(true);
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1500); // Hide after 1.5 seconds of inactivity
  };

  return (
    <div className="relative rounded-lg border bg-muted font-mono text-sm shadow-sm overflow-hidden group">
      <div className="absolute right-4 top-4 z-10">
         <Button 
            variant="outline" 
            onClick={onCopy} 
            className="h-8 px-3 text-xs shadow-sm bg-background/80 hover:bg-background backdrop-blur-sm border transition-all"
            title="Copy to clipboard"
         >
            <ClipboardIcon className="w-3.5 h-3.5 mr-1.5" />
            {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
         </Button>
      </div>
      <div 
        className={cn(
            "max-h-[600px] overflow-auto p-4 pt-12 sm:pt-4 modern-scrollbar",
            isScrolling && "is-scrolling"
        )}
        onScroll={handleScroll}
      >
        <pre className="text-foreground">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeViewer;