import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'dropdown' | 'text';
  filterOptions?: { value: string; label: string }[];
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  filters?: Record<string, string>;
  onFilterChange?: (field: string, value: string) => void;
  expandable?: boolean;
  renderExpanded?: (row: T) => React.ReactNode;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  rowKey?: (row: T) => string;
  emptyMessage?: string;
}

/**
 * Universal sortable/filterable DataTable component.
 * Supports client-side sorting, filtering (auto-detect dropdown vs text),
 * row expansion, selection, and custom cell renderers.
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  sortField: controlledSortField,
  sortDirection: controlledSortDirection,
  onSort,
  filters: controlledFilters,
  onFilterChange,
  expandable = false,
  renderExpanded,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  rowKey = (row: T) => row.id ?? row.key ?? JSON.stringify(row),
  emptyMessage = 'No data found.',
}: DataTableProps<T>) {
  // Internal sort state (used if not controlled)
  const [internalSortField, setInternalSortField] = useState<string>('');
  const [internalSortDirection, setInternalSortDirection] = useState<'asc' | 'desc'>('asc');

  // Internal filter state (used if not controlled)
  const [internalFilters, setInternalFilters] = useState<Record<string, string>>({});

  // Expansion state
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Determine if controlled or internal
  const sortField = controlledSortField ?? internalSortField;
  const sortDirection = controlledSortDirection ?? internalSortDirection;
  const filters = controlledFilters ?? internalFilters;

  const handleSort = (field: string) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    if (onSort) {
      onSort(field, newDirection);
    } else {
      setInternalSortField(field);
      setInternalSortDirection(newDirection);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    if (onFilterChange) {
      onFilterChange(field, value);
    } else {
      setInternalFilters((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Compute distinct values per filterable column (for auto-detection)
  const columnDistinctValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const col of columns) {
      if (!col.filterable) continue;
      if (col.filterOptions) continue; // already has explicit options
      const distinct = new Set<string>();
      for (const row of data) {
        const val = row[col.key];
        if (val != null && val !== '') {
          distinct.add(String(val));
        }
      }
      result[col.key] = Array.from(distinct).sort();
    }
    return result;
  }, [columns, data]);

  // Determine filter type for each filterable column
  const getFilterType = (col: Column<T>): 'dropdown' | 'text' => {
    if (col.filterType) return col.filterType;
    if (col.filterOptions) return 'dropdown';
    const distinct = columnDistinctValues[col.key];
    if (distinct && distinct.length <= 20) return 'dropdown';
    return 'text';
  };

  // Apply client-side filtering
  const filteredData = useMemo(() => {
    let result = data;
    for (const col of columns) {
      const filterValue = filters[col.key];
      if (!filterValue) continue;
      const filterType = getFilterType(col);
      if (filterType === 'dropdown') {
        result = result.filter((row) => String(row[col.key] ?? '') === filterValue);
      } else {
        const search = filterValue.toLowerCase();
        result = result.filter((row) => {
          const val = row[col.key];
          return val != null && String(val).toLowerCase().includes(search);
        });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filters, columns, columnDistinctValues]);

  // Apply client-side sorting
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [filteredData, sortField, sortDirection]);

  // Selection helpers
  const allKeys = useMemo(() => new Set(sortedData.map(rowKey)), [sortedData, rowKey]);
  const isAllSelected = selectable && selectedKeys && selectedKeys.size > 0 && allKeys.size > 0 &&
    Array.from(allKeys).every((k) => selectedKeys.has(k));

  const toggleSelectAll = () => {
    if (!onSelectionChange || !selectedKeys) return;
    if (isAllSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(allKeys));
    }
  };

  const toggleSelect = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectionChange(next);
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Check if any column is filterable
  const hasFilters = columns.some((c) => c.filterable);

  const colSpan = columns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden flex flex-col max-h-[calc(100vh-280px)]">
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            {/* Column headers */}
            <tr className="border-b border-border bg-muted/50">
              {selectable && (
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}
              {expandable && <th className="px-3 py-3 w-8" />}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-4 py-3 text-left font-medium text-muted-foreground',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground'
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="inline-flex flex-col ml-0.5">
                        {sortField === col.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5 text-foreground" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-foreground" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>

            {/* Filter row */}
            {hasFilters && (
              <tr className="border-b border-border bg-muted/30">
                {selectable && <th className="px-3 py-2" />}
                {expandable && <th className="px-3 py-2" />}
                {columns.map((col) => (
                  <th key={`filter-${col.key}`} className="px-4 py-2">
                    {col.filterable ? (
                      getFilterType(col) === 'dropdown' ? (
                        <select
                          value={filters[col.key] || ''}
                          onChange={(e) => handleFilterChange(col.key, e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">All</option>
                          {(col.filterOptions || (columnDistinctValues[col.key] || []).map((v) => ({ value: v, label: v }))).map((opt) => {
                            const option = typeof opt === 'string' ? { value: opt, label: opt } : opt;
                            return (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={filters[col.key] || ''}
                          onChange={(e) => handleFilterChange(col.key, e.target.value)}
                          placeholder={`Filter ${col.label.toLowerCase()}...`}
                          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      )
                    ) : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const key = rowKey(row);
                const isExpanded = expandedKeys.has(key);
                const isSelected = selectedKeys?.has(key) ?? false;

                return (
                  <DataTableRow
                    key={key}
                    row={row}
                    rowKey={key}
                    columns={columns}
                    selectable={selectable}
                    isSelected={isSelected}
                    onToggleSelect={() => toggleSelect(key)}
                    expandable={expandable}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleExpand(key)}
                    renderExpanded={renderExpanded}
                    colSpan={colSpan}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {/* Filtered count indicator */}
      {filteredData.length !== data.length && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground bg-muted/30">
          Showing {sortedData.length} of {data.length} rows (filtered)
        </div>
      )}
    </div>
  );
}

function DataTableRow<T extends Record<string, any>>({
  row,
  rowKey,
  columns,
  selectable,
  isSelected,
  onToggleSelect,
  expandable,
  isExpanded,
  onToggleExpand,
  renderExpanded,
  colSpan,
}: {
  row: T;
  rowKey: string;
  columns: Column<T>[];
  selectable: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  expandable: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  renderExpanded?: (row: T) => React.ReactNode;
  colSpan: number;
}) {
  return (
    <>
      <tr
        className={clsx(
          'border-b border-border/50 hover:bg-muted/30 transition-colors',
          isSelected && 'bg-blue-50/50 dark:bg-blue-950/20',
          (expandable || selectable) && 'cursor-pointer'
        )}
        onClick={expandable ? onToggleExpand : undefined}
      >
        {selectable && (
          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
            />
          </td>
        )}
        {expandable && (
          <td className="px-3 py-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </td>
        )}
        {columns.map((col) => (
          <td key={col.key} className="px-4 py-3" style={col.width ? { width: col.width } : undefined}>
            {col.render ? col.render(row[col.key], row) : (
              <span className="text-sm">{row[col.key] != null ? String(row[col.key]) : '—'}</span>
            )}
          </td>
        ))}
      </tr>
      {expandable && isExpanded && renderExpanded && (
        <tr className="border-b border-border/50 bg-muted/20">
          <td colSpan={colSpan} className="px-8 py-4">
            {renderExpanded(row)}
          </td>
        </tr>
      )}
    </>
  );
}
