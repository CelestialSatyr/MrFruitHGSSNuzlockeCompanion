import { useEffect, useMemo, useState } from "react";
import type { SiteNotice } from "@nuzlocke/core";

const NOTICE_LABELS: Record<SiteNotice["type"], string> = {
  note: "Note",
  info: "Information",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

const NOTICE_ICONS: Record<SiteNotice["type"], string> = {
  note: "i",
  info: "i",
  success: "✓",
  warning: "!",
  error: "×",
};

function noticeSignature(notice: SiteNotice): string {
  const value = JSON.stringify({
    id: notice.id,
    type: notice.type,
    title: notice.title ?? "",
    message: notice.message,
    dismissible: notice.dismissible,
    linkLabel: notice.linkLabel ?? "",
    linkUrl: notice.linkUrl ?? "",
  });

  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function dismissalKey(notice: SiteNotice): string {
  return `nuzlocke-companion.site-notice.dismissed.${notice.id}.${noticeSignature(notice)}`;
}

function readDismissed(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function storeDismissed(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, "1");
  } catch {
    // The banner can still be dismissed for this render even if storage is unavailable.
  }
}

export function SiteNoticeBanner({ notice }: { notice: SiteNotice }) {
  const storageKey = useMemo(() => dismissalKey(notice), [notice]);
  const [dismissed, setDismissed] = useState(() => notice.dismissible && readDismissed(storageKey));

  useEffect(() => {
    setDismissed(notice.dismissible && readDismissed(storageKey));
  }, [notice.dismissible, storageKey]);

  if (!notice.enabled || !notice.message.trim() || dismissed) return null;

  const externalLink = Boolean(notice.linkUrl && /^https?:\/\//i.test(notice.linkUrl));
  const alertRole = notice.type === "warning" || notice.type === "error" ? "alert" : "status";

  return (
    <aside
      className={`site-notice site-notice--${notice.type}`}
      role={alertRole}
      aria-label={`${NOTICE_LABELS[notice.type]} notice`}
    >
      <div className="site-notice__inner">
        <span className="site-notice__icon" aria-hidden="true">
          {NOTICE_ICONS[notice.type]}
        </span>

        <div className="site-notice__copy">
          <div className="site-notice__heading">
            <span>{NOTICE_LABELS[notice.type]}</span>
            {notice.title?.trim() ? <strong>{notice.title}</strong> : null}
          </div>
          <p>{notice.message}</p>

          {notice.linkUrl?.trim() ? (
            <a
              className="site-notice__link"
              href={notice.linkUrl}
              {...(externalLink ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {notice.linkLabel?.trim() || "Learn more"} →
            </a>
          ) : null}
        </div>

        {notice.dismissible ? (
          <button
            className="site-notice__dismiss"
            type="button"
            aria-label="Dismiss site notice"
            onClick={() => {
              storeDismissed(storageKey);
              setDismissed(true);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    </aside>
  );
}
