// Local, self-contained URL / tiny-URL sysparm sync for this page.
//
// Deliberately NOT imported from @servicenow/aiux/aiux-components-list —
// <aiux-list-connected>'s supported public surface is its documented props
// and events only. A page that wants filter/view/sort/split-view state to
// sync into the browser URL (and collapse into a short sysparm_tiny URL once
// it gets long) wires that up itself against that public event contract and
// the public /api/now/tinyurl REST endpoint, as this file does.

import {
  getSystemProperty,
  sp,
  aiuxFetch
} from '@servicenow/aiux/aiux-components-core';
import {navigate, getGlobalRouter} from '@servicenow/aiux/aiux-client';

const SYSPARM_QUERY = 'sysparm_query';
const SYSPARM_VIEW = 'sysparm_view';
const SYSPARM_FIXED_QUERY = 'sysparm_fixed_query';
const SYSPARM_FILTER_PINNED = 'sysparm_filter_pinned';
const SYSPARM_SHOW_STREAM = 'sysparm_show_stream';
const SYSPARM_GROUP_SORT = 'sysparm_group_sort';
const SYSPARM_SHOW_SPLIT_VIEW = 'sysparm_show_split_view';
const SYSPARM_HIGHLIGHTED_SYS_ID = 'sysparm_highlighted_sys_id';
const SYSPARM_TINY = 'sysparm_tiny';
const SYSPARM_USERPREF_PREFIX = 'sysparm_userpref.';
const GROUP_SORT_COUNT = 'COUNT';
const GROUP_SORT_COUNTDESC = 'COUNTDESC';
const TINY_URL_BASE = '/api/now/tinyurl';
const DEFAULT_TINY_URL_MIN_LENGTH = 1024;

function normalizeGroupSort(value) {
  return value === GROUP_SORT_COUNT || value === GROUP_SORT_COUNTDESC
    ? value
    : '';
}

/** Expand a sysparm_tiny id into its stored parameter map. */
async function resolveTinyUrl(tinyId) {
  const response = await aiuxFetch(
    `${TINY_URL_BASE}/${encodeURIComponent(tinyId)}`
  );
  if (!response.ok)
    throw new Error(`resolveTinyUrl failed: ${response.status}`);
  const json = await response.json();
  return json?.result ?? {};
}

/** Create a tiny URL for the given full URL string. */
async function createTinyUrl(url) {
  const response = await aiuxFetch(TINY_URL_BASE, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({url})
  });
  if (!response.ok) throw new Error(`createTinyUrl failed: ${response.status}`);
  const json = await response.json();
  return json?.result ?? url;
}

/**
 * Resolve sysparm_* URL params into list state, expanding an incoming
 * sysparm_tiny into its stored params (tiny values win when present).
 */
export async function resolveUrlParams(urlQuery) {
  const result = {groupSort: normalizeGroupSort(urlQuery[SYSPARM_GROUP_SORT])};
  if (urlQuery[SYSPARM_QUERY]) result.query = urlQuery[SYSPARM_QUERY];
  if (urlQuery[SYSPARM_VIEW]) result.view = urlQuery[SYSPARM_VIEW];
  if (urlQuery[SYSPARM_FIXED_QUERY])
    result.fixedQuery = urlQuery[SYSPARM_FIXED_QUERY];
  if (urlQuery[SYSPARM_FILTER_PINNED] === 'true') result.filterPinned = true;
  if (urlQuery[SYSPARM_SHOW_STREAM] === 'true')
    result.showActivityPanelOnLoad = true;
  if (urlQuery[SYSPARM_SHOW_SPLIT_VIEW] === 'true')
    result.showSplitViewOnLoad = true;
  if (urlQuery[SYSPARM_HIGHLIGHTED_SYS_ID])
    result.highlightedSysId = urlQuery[SYSPARM_HIGHLIGHTED_SYS_ID];

  if (urlQuery[SYSPARM_TINY]) {
    const tiny = await resolveTinyUrl(urlQuery[SYSPARM_TINY]).catch(() => ({}));
    if (tiny[SYSPARM_QUERY]) result.query = tiny[SYSPARM_QUERY];
    if (tiny[SYSPARM_VIEW]) result.view = tiny[SYSPARM_VIEW];
    if (tiny[SYSPARM_FIXED_QUERY])
      result.fixedQuery = tiny[SYSPARM_FIXED_QUERY];
    if (tiny[SYSPARM_FILTER_PINNED] === 'true') result.filterPinned = true;
    if (tiny[SYSPARM_SHOW_STREAM] === 'true')
      result.showActivityPanelOnLoad = true;
    if (tiny[SYSPARM_SHOW_SPLIT_VIEW] === 'true')
      result.showSplitViewOnLoad = true;
    if (tiny[SYSPARM_HIGHLIGHTED_SYS_ID])
      result.highlightedSysId = tiny[SYSPARM_HIGHLIGHTED_SYS_ID];
    const tinyGroupSort = normalizeGroupSort(tiny[SYSPARM_GROUP_SORT]);
    if (tinyGroupSort) result.groupSort = tinyGroupSort;
  }

  return result;
}

/**
 * Build the URL from current list state and navigate; collapses to a tiny
 * URL once the built URL crosses glide.tiny_url_min_length (default 1024).
 */
export async function writeToUrl(opts) {
  const minLen = sp.asNumber(
    getSystemProperty('glide.tiny_url_min_length'),
    DEFAULT_TINY_URL_MIN_LENGTH
  );
  const path = getGlobalRouter()?.currentPath ?? globalThis.location.pathname;
  const params = new URLSearchParams();

  params.set(SYSPARM_VIEW, opts.view ?? '');
  params.set(SYSPARM_QUERY, opts.query ?? '');
  params.set(SYSPARM_FIXED_QUERY, opts.fixedQuery ?? '');
  if (opts.showActivityPanelOnLoad !== undefined)
    params.set(SYSPARM_SHOW_STREAM, String(opts.showActivityPanelOnLoad));
  if (opts.showFiltersOnLoad !== undefined)
    params.set(SYSPARM_FILTER_PINNED, String(opts.showFiltersOnLoad));
  if (opts.groupSort) params.set(SYSPARM_GROUP_SORT, opts.groupSort);
  if (opts.showSplitViewOnLoad) {
    params.set(SYSPARM_SHOW_SPLIT_VIEW, 'true');
    if (opts.highlightedSysId)
      params.set(SYSPARM_HIGHLIGHTED_SYS_ID, opts.highlightedSysId);
  }
  if (opts.table && opts.view !== undefined) {
    params.set(`${SYSPARM_USERPREF_PREFIX}${opts.table}_list.view`, opts.view);
    params.set(`${SYSPARM_USERPREF_PREFIX}${opts.table}.view`, opts.view);
  }

  const qs = params.toString();
  const fullUrl = qs ? `${path}?${qs}` : path;

  if (fullUrl.length >= minLen) {
    const tinyUrl = await createTinyUrl(fullUrl).catch(() => fullUrl);
    navigate(tinyUrl, {shallow: true, replace: true});
  } else {
    navigate(path, {
      shallow: true,
      replace: true,
      query: Object.fromEntries(params)
    });
  }
}
