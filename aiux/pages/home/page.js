import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import '@servicenow/aiux/aiux-components-list';
import {ListDataManager} from '@servicenow/aiux/aiux-components-list';
import {setDocumentTitle} from '../../utils/document-title.js';
import {HANDWAVE_HTML, HANDWAVE_CSS, HANDWAVE_JS} from './handwave-embed.js';

const LIST_TABLE = 'sn_grc_ai_gov_ai_system';
const LIST_QUERY = 'ai_system_digital_assetISNOTEMPTY';
const LIST_COLUMNS = 'number,ai_system_digital_asset,state';

// Same static-asset-host limitation as pages/home/virtual-on-embed.js in
// draft-punk: the handwave client build is inlined and mounted via
// iframe.srcdoc (see README in the handwave client repo).
//
// The graph itself lives inside that iframe, a separate document with no
// access to AIUX's own custom elements. This page owns the real record list
// (aiux-list-connected, right panel) per its documented
// aiux-list-connected:reference-link-clicked event — clicking a record's
// reference cell posts a message down into the iframe, which re-queries the
// Knowledge Graph for THAT record and replaces the displayed graph with it
// (see handwave client's App.tsx message listener for
// "handwave:focus-record" and aictKgClient's fetchAictGraphForSystem).
@customElement('x-snc-handwave-home-page')
export default class HomePage extends AIUXElement {
  static styles = css`
    :host {
      display: block;
      height: 100vh;
    }
    .hw-layout {
      display: flex;
      height: 100%;
    }
    .hw-frame {
      display: block;
      flex: 1;
      height: 100%;
      border: 0;
    }
    .hw-panel {
      width: 380px;
      height: 100%;
      flex-shrink: 0;
      border-left: 1px solid var(--color-base-300);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .hw-list {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    .hw-jev {
      flex-shrink: 0;
      margin: 12px;
      padding: 12px 14px;
      border: 1px solid var(--color-base-300);
      border-radius: 8px;
      background: var(--color-base-100);
      font-size: 13px;
    }
    .hw-jev h2 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 600;
    }
    .hw-jev-asset {
      margin: 0 0 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .hw-jev-verdict {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
    }
    .hw-jev-verdict.retire {
      background: var(--color-error);
      color: var(--color-error-content);
    }
    .hw-jev-verdict.keep {
      background: var(--color-success);
      color: var(--color-success-content);
    }
    .hw-jev-prob {
      margin-inline-start: 8px;
    }
    .hw-jev dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 10px;
      margin: 10px 0 0;
      font-size: 12px;
      color: var(--color-base-content);
    }
    .hw-jev dt {
      opacity: 0.7;
    }
    .hw-jev dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .hw-jev-error {
      color: var(--color-error);
    }
  `;

  static properties = {
    _jev: {state: true},
  };

  constructor() {
    super();
    this._jev = {status: 'loading'};
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('message', this._handleFrameMessage);
  }

  disconnectedCallback() {
    window.removeEventListener('message', this._handleFrameMessage);
    super.disconnectedCallback();
  }

  // The iframe asks Jev (via /api/x_snc_handwave/jev/retire) each time it
  // loads a graph and posts the answer here; only accept it from our frame.
  _handleFrameMessage = e => {
    if (!this._frame || e.source !== this._frame.contentWindow) return;
    if (e.data?.type !== 'handwave:jev-decision') return;
    this._jev = e.data;
  };

  static async loader() {
    const data = await ListDataManager.fetch({
      table: LIST_TABLE,
      query: LIST_QUERY,
      columns: LIST_COLUMNS,
    }).catch(() => null);
    return {data};
  }

  firstUpdated() {
    setDocumentTitle(i18n.getMessage('Handwave'));
    this._loadHandwaveFrame();
  }

  _loadHandwaveFrame() {
    const iframe = this.renderRoot?.querySelector('#handwave-frame');
    if (!iframe) return;
    this._frame = iframe;
    const doc = HANDWAVE_HTML.replace(
      '</head>',
      `<style>${HANDWAVE_CSS}</style></head>`
    ).replace('</body>', `<script type="module">${HANDWAVE_JS}</script></body>`);
    iframe.srcdoc = doc;
  }

  // Real shape confirmed in @servicenow/aiux's aiux-list-connected.ts:
  // {listTable, listSysId, referenceTable, referenceSysId, isPrimaryClick,
  // metadata}. listSysId is the clicked row's own sn_grc_ai_gov_ai_system
  // sys_id, which is what the handwave client's KG queries filter on;
  // referenceSysId is the alm_ai_digital_asset it points to.
  _handleReferenceLinkClicked = e => {
    const {listSysId} = e.detail || {};
    if (!listSysId || !this._frame?.contentWindow) return;
    this._frame.contentWindow.postMessage(
      {type: 'handwave:focus-record', sysId: listSysId},
      '*'
    );
  };

  _renderJev() {
    const jev = this._jev || {};
    let body;
    if (jev.status === 'error') {
      body = html`<p class="hw-jev-error">${jev.error}</p>`;
    } else if (jev.status !== 'done' || !jev.decision) {
      body = html`<p>${i18n.getMessage('Asking Jev…')}</p>`;
    } else {
      const d = jev.decision;
      const pct = new Intl.NumberFormat(undefined, {
        style: 'percent',
        maximumFractionDigits: 0,
      }).format(d.probability);
      body = html`
        <p class="hw-jev-asset" title=${d.label}>${d.label}</p>
        <span class="hw-jev-verdict ${d.retire ? 'retire' : 'keep'}"
          >${d.retire
            ? i18n.getMessage('Retire')
            : i18n.getMessage('Keep')}</span
        >
        <span class="hw-jev-prob"
          >${i18n.getMessage('Probability of retire')}: ${pct}</span
        >
        <dl>
          ${d.facts.map(f => html`<dt>${f.key}</dt><dd>${f.value}</dd>`)}
        </dl>
      `;
    }
    return html`
      <section class="hw-jev" aria-live="polite">
        <h2>${i18n.getMessage("Jev's decision: retire this agent?")}</h2>
        ${body}
      </section>
    `;
  }

  render() {
    const {data} = this.loaderData || {};
    return html`
      <div class="hw-layout">
        <iframe
          id="handwave-frame"
          title="${i18n.getMessage('Handwave — AICT knowledge graph')}"
          class="hw-frame"
          allow="camera"
        ></iframe>
        <div class="hw-panel">
          <aiux-list-connected
            class="hw-list"
            table=${LIST_TABLE}
            fixed-query=${LIST_QUERY}
            columns=${LIST_COLUMNS}
            .data=${data}
            @aiux-list-connected:reference-link-clicked=${this
              ._handleReferenceLinkClicked}
          ></aiux-list-connected>
          ${this._renderJev()}
        </div>
      </div>
    `;
  }
}
