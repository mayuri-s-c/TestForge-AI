import fs from 'fs/promises';
import path from 'path';

const ARTIFACT_DIRS = ['uploads', 'reports', 'screenshots'] as const;

async function clearDirectory(dir: string, keepNames: Set<string>): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (keepNames.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function clearPreviousRunArtifacts(keepUploadPath?: string): Promise<void> {
  const projectRoot = process.cwd();
  const keepUploadName = keepUploadPath ? path.basename(keepUploadPath) : undefined;

  for (const dirName of ARTIFACT_DIRS) {
    const dirPath = path.join(projectRoot, dirName);
    await fs.mkdir(dirPath, { recursive: true });

    const keepNames = new Set(['.gitkeep']);
    if (dirName === 'uploads' && keepUploadName) {
      keepNames.add(keepUploadName);
    }

    await clearDirectory(dirPath, keepNames);
  }
}
