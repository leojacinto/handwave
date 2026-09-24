import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import '@servicenow/aiux/aiux-components-list';
import {ListDataManager} from '@servicenow/aiux/aiux-components-list';
import {resolveUrlParams, writeToUrl} from './url-sync.js';

@customElement('x-snc-handwave-incidents-page')
export default class IncidentsPage extends AIUXElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  static async loader(ctx) {
    // Resolves sysparm_query/view/group_sort/etc from the URL, expanding an
    // incoming sysparm_tiny if present.
    const resolved = await resolveUrlParams(ctx.query ?? {});
    const {
      query = 'active=true',
      view,
      groupSort,
      filterPinned,
      showActivityPanelOnLoad,
      showSplitViewOnLoad,
      highlightedSysId
    } = resolved;
    const data = await ListDataManager.fetch({
      table: 'incident',
      query,
      view
    }).catch(() => null);
    return {
      data,
      query,
      view,
      groupSort,
      filterPinned,
      showActivityPanelOnLoad,
      showSplitViewOnLoad,
      highlightedSysId
    };
  }

  // Tracks the latest known filter/view/sort/split-view state so each
  // URL-sync handler below can write a complete option set to the URL, even
  // though each event only carries a partial delta.
  _urlQuery = null;
  _view = null;
  _groupSort = null;
  _showSplitView = false;
  _highlightedSysId;

  /** Syncs the browser URL when the list query changes; preserves groupSort if grouped. */
  _handleQueryUpdated = async e => {
    const {view, groupSort} = this.loaderData || {};
    const {query} = e.detail;
    this._urlQuery = query;
    const hasGroupBy = query?.toUpperCase().includes('GROUPBY');
    if (!hasGroupBy) this._groupSort = '';
    await writeToUrl({
      query,
      groupSort: hasGroupBy ? (this._groupSort ?? groupSort ?? '') : undefined,
      view: this._view ?? view ?? '',
      fixedQuery: '',
      showSplitViewOnLoad: this._showSplitView,
      highlightedSysId: this._highlightedSysId
    });
  };

  /** Syncs sysparm_group_sort in the URL when group sort order changes. */
  _handleGroupSortUpdated = async e => {
    const {view, query} = this.loaderData || {};
    this._groupSort = e.detail.groupSort;
    await writeToUrl({
      groupSort: e.detail.groupSort,
      query: this._urlQuery ?? query ?? '',
      view: this._view ?? view ?? '',
      fixedQuery: '',
      showSplitViewOnLoad: this._showSplitView,
      highlightedSysId: this._highlightedSysId
    });
  };

  /** Syncs the browser URL whenever split view's open state or active row changes. */
  _handleSplitViewChanged = async e => {
    const {view, query, groupSort} = this.loaderData || {};
    this._showSplitView = e.detail.show;
    this._highlightedSysId = e.detail.highlightedSysId ?? undefined;
    await writeToUrl({
      query: this._urlQuery ?? query ?? '',
      groupSort: this._groupSort ?? groupSort ?? '',
      view: this._view ?? view ?? '',
      fixedQuery: '',
      showSplitViewOnLoad: this._showSplitView,
      highlightedSysId: this._highlightedSysId
    });
  };

  /** Syncs sysparm_view (and its userpref mirrors) in the URL when the user switches views. */
  _handleViewUpdated = async e => {
    const {query, groupSort} = this.loaderData || {};
    this._view = e.detail.view;
    await writeToUrl({
      query: this._urlQuery ?? query ?? '',
      groupSort: this._groupSort ?? groupSort ?? '',
      view: this._view,
      fixedQuery: '',
      showSplitViewOnLoad: this._showSplitView,
      highlightedSysId: this._highlightedSysId,
      table: e.detail.table
    });
  };

  render() {
    const {
      data,
      query,
      view,
      groupSort,
      filterPinned,
      showActivityPanelOnLoad,
      showSplitViewOnLoad,
      highlightedSysId
    } = this.loaderData || {};

    return html`
      <div class="mx-auto flex max-w-7xl flex-col gap-6 p-4 lg:p-8">
        <div class="flex flex-col gap-2">
          <div class="aiux-badge aiux-badge-primary aiux-badge-outline">
            ${i18n.getMessage('Example page')}
          </div>
          <h2 class="text-3xl font-bold tracking-tight">
            ${i18n.getMessage('Incidents')}
          </h2>
          <p class="max-w-3xl">
            ${i18n.getMessage(
              'This page uses aiux-list-connected to render a ServiceNow incident list, with filter/view/sort state synced to the URL (and shortened to a tiny URL once it gets long).'
            )}
          </p>
        </div>
        <section class="aiux-card border border-base-300 bg-base-100 shadow-sm">
          <div class="aiux-card-body p-6">
            <aiux-list-connected
              table="incident"
              .query=${query || 'active=true'}
              .view=${this._view ?? view ?? ''}
              .groupSort=${groupSort || ''}
              .data=${data}
              .filterOptions=${{showFiltersOnLoad: filterPinned}}
              .listOptions=${{
                heading: i18n.getMessage('Active incidents'),
                selectionEnabled: false,
                selectAllEnabled: false,
                showRefreshButton: true,
                showZingSearch: true,
                showConditionBuilderButton: true,
                showEditColumnsButton: true,
                showCopyURLButton: false,
                showCount: true,
                showReadableFixedQuery: true,
                showActivityPanelOnLoad,
                showSplitViewOnLoad,
                highlightedSysId
              }}
              @aiux-list-connected:query-updated=${this._handleQueryUpdated}
              @aiux-list-connected:group-sort-updated=${this
                ._handleGroupSortUpdated}
              @aiux-list-connected:split-view-changed=${this
                ._handleSplitViewChanged}
              @aiux-list-connected:view-updated=${this._handleViewUpdated}
            ></aiux-list-connected>
          </div>
        </section>
      </div>
    `;
  }
}
