import { embed } from './eds.js';
import { el, icon } from './ui.js';

export function closeSheet() {
  document.querySelectorAll('dialog.sheet').forEach((sheet) => sheet.remove());
}

/**
 * Shows a site fragment (e.g. the booking flow) in a bottom sheet.
 * The fragment is rendered by the site's own blocks through aem-embed.
 */
export function openSheet(path, query, { name, closeLabel }) {
  closeSheet();
  const close = el('button.sheet-close', { type: 'button', 'aria-label': closeLabel }, icon('close'));
  const dialog = el('dialog.sheet', { 'aria-label': name },
    el('div.sheet-bar', {}, close),
    el('div.sheet-body', {}, embed(path, query)));
  const dismiss = () => {
    dialog.close();
    dialog.remove();
  };
  close.addEventListener('click', dismiss);
  // a click on the backdrop lands on the dialog element itself
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dismiss(); });
  // Escape closes the dialog natively
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
