'use client';

import React from 'react';

type FileUploadProps = {
  id: string;
  onFilesChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // bytes
};

export function FileUpload({ id, onFilesChange, accept = '*/*', multiple = false, maxFiles = 5, maxSize = 10 * 1024 * 1024 }: FileUploadProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const limited = files.slice(0, maxFiles).filter(f => f.size <= maxSize);
    onFilesChange(limited);
  };

  return (
    <input
      id={id}
      type="file"
      onChange={handleChange}
      accept={accept}
      multiple={multiple}
      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-foreground hover:file:bg-muted/80"
    />
  );
}