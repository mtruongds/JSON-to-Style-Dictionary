
import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';

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

  const dragOverClasses = isDraggingOver
    ? 'border-cyan-400 bg-slate-700/50 ring-4 ring-cyan-500/20'
    : 'border-slate-600 hover:border-cyan-500 hover:bg-slate-700/30';

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 ${dragOverClasses}`}
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
      <div className="flex flex-col items-center justify-center text-slate-400">
        <UploadIcon />
        <p className="mt-4 text-lg font-semibold">
          <span className="text-cyan-400">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-sm">Upload a JSON file to begin conversion</p>
      </div>
    </div>
  );
};

export default Dropzone;
