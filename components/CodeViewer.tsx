
import React from 'react';

interface CodeViewerProps {
  code: string;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ code }) => {
  return (
    <div className="relative rounded-lg border bg-muted font-mono text-sm shadow-sm overflow-hidden">
      <div className="max-h-[600px] overflow-auto p-4">
        <pre className="text-foreground">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeViewer;
