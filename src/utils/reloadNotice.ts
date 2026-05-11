const RELOAD_NOTICE_KEY = "reload-success-notice";

export function setReloadSuccessNotice(message: string): void {
  if (typeof window === "undefined" || !message) return;
  try {
    window.sessionStorage.setItem(RELOAD_NOTICE_KEY, message);
  } catch {
    // ignore storage errors
  }
}

export function consumeReloadSuccessNotice(): string {
  if (typeof window === "undefined") return "";
  try {
    const message = window.sessionStorage.getItem(RELOAD_NOTICE_KEY) || "";
    if (message) {
      window.sessionStorage.removeItem(RELOAD_NOTICE_KEY);
    }
    return message;
  } catch {
    return "";
  }
}
