/**
 * Thresholds for the built-in Terminus memory and disk health indicators.
 */

/** Max Node heap before `memory_heap` reports down (512 MB). */
export const MEMORY_HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

/** Max process RSS before `memory_rss` reports down (768 MB). */
export const MEMORY_RSS_LIMIT_BYTES = 768 * 1024 * 1024;

/** Max disk usage fraction before `storage` reports down. */
export const DISK_THRESHOLD_PERCENT = 0.9;

/**
 * Filesystem path probed by the disk health indicator.
 * Windows has no `/`, so probe the system drive root instead.
 */
export const DISK_CHECK_PATH = process.platform === 'win32' ? 'C:\\' : '/';
