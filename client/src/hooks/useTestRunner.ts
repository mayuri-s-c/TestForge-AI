import { useState, useCallback } from 'react';
import type { UploadResponse, StatusResponse, RunStatus } from './types';
import { apiFetch } from '../lib/apiClient';

export function useTestRunner() {
  const [runId, setRunId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<RunStatus>('not_started');
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<StatusResponse['results']>([]);
  const [summary, setSummary] = useState<StatusResponse['summary'] | null>(null);
  const [hasReport, setHasReport] = useState(false);
  const [headless, setHeadless] = useState(true);
  const [sheets, setSheets] = useState<UploadResponse['sheets']>([]);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await apiFetch('/health');
      const data = await res.json();
      setAiConfigured(data.aiConfigured);
    } catch {
      setAiConfigured(false);
    }
  }, []);

  const refreshStatus = useCallback(async (id?: string) => {
    const targetId = id || runId;
    if (!targetId) return;

    try {
      const res = await apiFetch(`/status/${targetId}`);
      const data: StatusResponse = await res.json();
      setStatus(data.status);
      setLogs(data.logs);
      setResults(data.results);
      setSummary(data.summary);
      setHasReport(data.hasReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch status');
    }
  }, [runId]);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setLogs([]);
    setResults([]);
    setSummary(null);
    setHasReport(false);
    setStatus('not_started');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('headless', String(headless));

    const res = await apiFetch('/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }

    const data: UploadResponse = await res.json();
    setRunId(data.runId);
    setFileName(data.fileName);
    setStatus(data.status);
    setSheets(data.sheets);
    setLogs([`[INFO] Uploaded: ${data.fileName}`]);
    return data;
  }, [headless]);

  const runTests = useCallback(async () => {
    if (!runId) return;
    setError(null);
    setStatus('running');
    setLogs([]);
    setResults([]);
    setSummary(null);
    setHasReport(false);

    const res = await apiFetch(`/run/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headless }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start tests');
    }
  }, [runId, headless]);

  const stopTests = useCallback(async () => {
    if (!runId) return;

    const res = await apiFetch(`/abort/${runId}`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to abort');
    }
    setStatus('aborted');
    setHasReport(false);
  }, [runId]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [...prev, message]);
  }, []);

  const onComplete = useCallback(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    runId,
    fileName,
    status,
    logs,
    results,
    summary,
    hasReport,
    headless,
    setHeadless,
    sheets,
    aiConfigured,
    error,
    setError,
    checkHealth,
    uploadFile,
    runTests,
    stopTests,
    addLog,
    setStatus,
    onComplete,
    refreshStatus,
  };
}
