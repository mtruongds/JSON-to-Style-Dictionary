
import React from 'react';
import Button from './Button';
import { ClipboardIcon } from './icons/ClipboardIcon';

interface CodeViewerProps {
  code: string;
  onCopy: () => void;
  copyStatus: 'idle' | 'copied';
}

const CodeViewer: React.FC<CodeViewerProps> = ({ code, onCopy, copyStatus }) => {
  return (
    <div className="relative rounded-lg border bg-muted font-mono text-sm shadow-sm overflow-hidden group">
      <div className="absolute right-8 top-4 z-10">
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
      <div className="max-h-[600px] overflow-auto p-4 pt-12 sm:pt-4">
        <pre className="text-foreground">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeViewer;
