
import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { cn } from '../lib/utils';

interface DropzoneProps {
  onFileDrop: (file: File) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ onFileDrop }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    handleDrag(e);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  }, [handleDrag]);

  const handleDragOut = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    handleDrag(e);
    setIsDraggingOver(false);
  }, [handleDrag]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    handleDrag(e);
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [handleDrag, onFileDrop]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileDrop(e.target.files[0]);
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-12 text-center rounded-xl border-2 border-dashed cursor-pointer transition-colors duration-200",
        isDraggingOver 
          ? "border-primary bg-muted/50" 
          : "border-muted-foreground/25 hover:border-primary hover:bg-muted/25"
      )}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDragIn}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <div className="p-4 rounded-full bg-muted mb-2">
          <UploadIcon />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Upload Tokens
        </h3>
        <p className="text-sm">
          Drag and drop or click to select a JSON file
        </p>
      </div>
    </div>
  );
};

export default Dropzone;
