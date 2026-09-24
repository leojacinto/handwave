import {isServer} from 'lit';

export function setDocumentTitle(title) {
  if (isServer) return;
  document.title = title ? `${title} · Handwave` : 'Handwave';
}
