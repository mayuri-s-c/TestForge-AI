import { useRef, useState, DragEvent, ChangeEvent } from 'react';

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  disabled: boolean;
  fileName: string;
}

export function FileUpload({ onUpload, disabled, fileName }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      alert('Please upload a .xlsx or .xls file');
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`upload-zone ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={onChange}
        hidden
        disabled={disabled}
      />
      <div className="upload-icon">📋</div>
      {uploading ? (
        <p>Uploading...</p>
      ) : fileName ? (
        <>
          <p className="upload-title">File loaded</p>
          <p className="upload-filename">{fileName}</p>
          <p className="upload-hint">Click or drag to replace</p>
        </>
      ) : (
        <>
          <p className="upload-title">Drop your test spreadsheet here</p>
          <p className="upload-hint">or click to browse (.xlsx / .xls)</p>
        </>
      )}
    </div>
  );
}
