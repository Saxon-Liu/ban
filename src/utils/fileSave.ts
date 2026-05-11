type ElectronSaveFileAPI = {
  isElectron: true;
  saveTextFile: (
    defaultFileName: string,
    content: string,
    filters?: Array<{ name: string; extensions: string[] }>
  ) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
  saveBinaryFile: (
    defaultFileName: string,
    bytes: number[],
    filters?: Array<{ name: string; extensions: string[] }>
  ) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
};

function getElectronAPI(): ElectronSaveFileAPI | undefined {
  return (window as typeof window & {
    electronAPI?: ElectronSaveFileAPI;
  }).electronAPI;
}

export async function saveTextFile(
  content: string,
  fileName: string,
  filters: Array<{ name: string; extensions: string[] }>
): Promise<{ saved: boolean; filePath?: string }> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.isElectron) {
    const result = await electronAPI.saveTextFile(fileName, content, filters);
    return {
      saved: Boolean(result.success && !result.canceled),
      filePath: result.filePath,
    };
  }

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { saved: true };
}

export async function saveBlobFile(
  blob: Blob,
  fileName: string,
  filters: Array<{ name: string; extensions: string[] }>
): Promise<{ saved: boolean; filePath?: string }> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.isElectron) {
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    const result = await electronAPI.saveBinaryFile(fileName, bytes, filters);
    return {
      saved: Boolean(result.success && !result.canceled),
      filePath: result.filePath,
    };
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { saved: true };
}
