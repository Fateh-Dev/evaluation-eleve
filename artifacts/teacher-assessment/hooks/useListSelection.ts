import { useState } from 'react';

export function useListSelection() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const startSelecting = (id?: string) => {
    setIsSelecting(true);
    if (id) setSelectedIds((current) => current.includes(id) ? current : [...current, id]);
  };

  const toggleSelection = (id: string) => {
    setIsSelecting(true);
    setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  };

  const cancelSelection = () => {
    setIsSelecting(false);
    setSelectedIds([]);
  };

  return { isSelecting, selectedIds, startSelecting, toggleSelection, cancelSelection };
}