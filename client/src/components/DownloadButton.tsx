import { apiFetch } from '../lib/apiClient';

interface DownloadButtonProps {
  path: string;
  filename: string;
  label: string;
  className?: string;
}

export function DownloadButton({ path, filename, label, className = 'btn btn-outline' }: DownloadButtonProps) {
  const handleDownload = async () => {
    const response = await apiFetch(path);
    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" className={className} onClick={() => void handleDownload()}>
      {label}
    </button>
  );
}
