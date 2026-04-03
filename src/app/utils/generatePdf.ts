// src/app/utils/generatePdf.ts
// PDF / Share utilities for medical records
//
// Uses window.print() for PDF generation — zero dependencies,
// selectable text, proper pagination, native "Save as PDF" option.

/** Open browser print dialog (user can "Save as PDF") */
export function printRecord(): void {
  window.print();
}

/** Copy shareable record link to clipboard */
export async function copyRecordLink(id: string): Promise<boolean> {
  const url = `${window.location.origin}/records/${id}`;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }
}

/** Open mailto link to share record via email */
export function shareViaEmail(id: string, petName: string, recipientEmail?: string): void {
  const url = `${window.location.origin}/records/${id}`;
  const subject = encodeURIComponent(`Medical Record — ${petName}`);
  const body = encodeURIComponent(
    `Hi,\n\nPlease find the medical record for ${petName} at the following link:\n${url}\n\nBest regards`
  );
  const mailto = recipientEmail
    ? `mailto:${recipientEmail}?subject=${subject}&body=${body}`
    : `mailto:?subject=${subject}&body=${body}`;
  window.open(mailto, '_self');
}
