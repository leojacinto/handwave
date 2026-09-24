import {html, css, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';

@customElement('aiux-feature-card')
export default class FeatureCard extends AIUXElement {
  @property({type: String}) index = '';
  @property({type: String}) title = '';
  @property({type: String}) description = '';
  @property({type: String}) href = '';
  @property({type: String}) linkLabel = '';

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  render() {
    return html`
      <div class="aiux-card h-full bg-surface-primary">
        <div class="aiux-card-body">
          <div class="font-mono text-xs font-bold text-text-tertiary">
            ${this.index}${this.linkLabel ? ` — ${this.linkLabel}` : nothing}
          </div>
          <h2 class="aiux-card-title text-text-primary">${this.title}</h2>
          <p class="text-sm leading-relaxed text-text-secondary">
            ${this.description}
          </p>
          ${this.href && this.linkLabel
            ? html`<div class="aiux-card-actions mt-2">
                <a
                  class="aiux-btn aiux-btn-ghost aiux-btn-sm gap-1"
                  href="${this.href}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ${this.linkLabel} ↗
                </a>
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }
}
