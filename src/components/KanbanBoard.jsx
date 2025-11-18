import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, TrendingUp, Clock, CheckCircle, Search } from 'lucide-react';
import KanbanCardModal from './KanbanCardModal';

// Compact Kanban Card Component
const KanbanCard = ({ item, getStatusIcon, getFollowUpIcon, onCardClick, isUpdating }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-md p-3 mb-2 hover:shadow-md transition-shadow relative ${
        isUpdating ? 'border-blue-400 bg-blue-50' : 'border-gray-200 cursor-move'
      }`}
      onClick={() => !isUpdating && onCardClick(item)}
      {...attributes}
      {...listeners}
    >
      {isUpdating && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-50 flex items-center justify-center rounded-md z-10">
          <div className="text-blue-600 text-sm font-medium">Updating...</div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getStatusIcon(item.inventory_status)}
          <span className="text-sm font-medium text-gray-900 truncate">
            {item.item_name}
          </span>
        </div>
        <div className="flex-shrink-0">
          {getFollowUpIcon(item.follow_up_status)}
        </div>
      </div>
    </div>
  );
};

// Droppable Column Component
const DroppableColumn = ({ title, items, status, getStatusIcon, getFollowUpIcon, onCardClick, updatingItems, searchQuery, onSearchChange, inventoryFilter, onInventoryFilterToggle }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const getStatusColor = (columnStatus) => {
    switch (columnStatus) {
      case 'open':
        return 'bg-blue-50 border-blue-200';
      case 'on_progress':
        return 'bg-yellow-50 border-yellow-200';
      case 'closed':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getColumnStatusIcon = (columnStatus) => {
    switch (columnStatus) {
      case 'open':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'on_progress':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'closed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex-1 min-w-0 ${getStatusColor(status)} border-2 rounded-lg transition-colors flex flex-col ${
        isOver ? 'border-blue-400 bg-blue-100' : ''
      }`}
      style={{ maxHeight: 'calc(100vh - 280px)' }}
    >
      <div className="p-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {getColumnStatusIcon(status)}
            <h3 className="font-semibold text-gray-900 capitalize">
              {status.replace('_', ' ')}
            </h3>
            <span className="bg-white px-2 py-1 text-xs font-medium rounded-full">
              {items.length}
            </span>
          </div>

          {/* Inventory Status Filter Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onInventoryFilterToggle('kritis')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                inventoryFilter.includes('kritis')
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Kritis
            </button>
            <button
              onClick={() => onInventoryFilterToggle('over')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                inventoryFilter.includes('over')
                  ? 'bg-purple-800 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Over
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari item..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-4 pb-4"
      >
        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          <div className="min-h-[200px]">
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {searchQuery ? `Tidak ada item yang cocok dengan "${searchQuery}"` : `No items in ${status.replace('_', ' ')}`}
              </div>
            ) : (
              items.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  getStatusIcon={getStatusIcon}
                  getFollowUpIcon={getFollowUpIcon}
                  onCardClick={onCardClick}
                  isUpdating={updatingItems?.has(item.id) || false}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

// Main Kanban Board Component
const KanbanBoard = ({
  groupedReports,
  getStatusIcon,
  getFollowUpIcon,
  onStatusUpdate
}) => {
  const [activeId, setActiveId] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updatingItems, setUpdatingItems] = useState(new Set());

  // Search states for each column
  const [searchQueries, setSearchQueries] = useState({
    open: '',
    on_progress: '',
    closed: ''
  });

  // Inventory status filter states for each column
  // Can be: null (show all), 'kritis', 'over', or ['kritis', 'over'] (show both)
  const [inventoryFilters, setInventoryFilters] = useState({
    open: [],
    on_progress: [],
    closed: []
  });

  // Filter function to search items
  const filterItems = (items, searchQuery, inventoryFilter) => {
    let filtered = items;

    // Apply inventory status filter
    if (inventoryFilter && inventoryFilter.length > 0) {
      filtered = filtered.filter(item => inventoryFilter.includes(item.inventory_status));
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => {
        return (
          item.item_name?.toLowerCase().includes(query) ||
          item.sku?.toLowerCase().includes(query) ||
          item.internal_product_code?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.remarks?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  };

  // Handle search change for a specific column
  const handleSearchChange = (status, query) => {
    setSearchQueries(prev => ({
      ...prev,
      [status]: query
    }));
  };

  // Handle inventory filter toggle for a specific column
  const handleInventoryFilterToggle = (status, inventoryStatus) => {
    setInventoryFilters(prev => {
      const currentFilters = prev[status] || [];
      const newFilters = currentFilters.includes(inventoryStatus)
        ? currentFilters.filter(f => f !== inventoryStatus)
        : [...currentFilters, inventoryStatus];

      return {
        ...prev,
        [status]: newFilters
      };
    });
  };

  // Filtered reports for each column
  const filteredReports = {
    open: filterItems(groupedReports.open || [], searchQueries.open, inventoryFilters.open),
    on_progress: filterItems(groupedReports.on_progress || [], searchQueries.on_progress, inventoryFilters.on_progress),
    closed: filterItems(groupedReports.closed || [], searchQueries.closed, inventoryFilters.closed)
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom collision detection that prioritizes pointer location
  // This works better with scrollable columns
  const customCollisionDetection = (args) => {
    // First, try to find collisions using pointer location
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    // If no pointer collisions, try rectangle intersection
    const intersectionCollisions = rectIntersection(args);
    if (intersectionCollisions.length > 0) {
      return intersectionCollisions;
    }

    // Finally, fall back to closest center
    return closestCenter(args);
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    // Find the source column
    const sourceColumn = Object.keys(groupedReports).find(column =>
      groupedReports[column].some(item => item.id === active.id)
    );

    // Determine destination column
    // Check if over.id is a column status directly
    let destinationColumn = over.id;

    // If not a column status, find which column the card belongs to
    if (!['open', 'on_progress', 'closed'].includes(over.id)) {
      destinationColumn = Object.keys(groupedReports).find(column =>
        groupedReports[column].some(item => item.id === over.id)
      );
    }

    if (sourceColumn && destinationColumn && sourceColumn !== destinationColumn) {
      // Don't clear activeId yet to prevent blinking
      // Add to updating items for loading state
      setUpdatingItems(prev => new Set(prev).add(active.id));

      try {
        // Update the status in the database
        await onStatusUpdate(active.id, destinationColumn);
      } catch (error) {
        console.error('Error updating status:', error);
        // Could add toast notification here
      } finally {
        // Remove from updating items
        setUpdatingItems(prev => {
          const next = new Set(prev);
          next.delete(active.id);
          return next;
        });
      }
    }

    setActiveId(null);
  };

  const handleCardClick = (item) => {
    setSelectedCard(item);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCard(null);
  };

  const handleStatusUpdate = async (itemId, newStatus) => {
    setUpdatingItems(prev => new Set(prev).add(itemId));
    
    try {
      await onStatusUpdate(itemId, newStatus);
      handleModalClose();
    } catch (error) {
      console.error('Error updating status:', error);
      // Could add toast notification here
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  // Find the active item for drag overlay
  const activeItem = activeId 
    ? Object.values(groupedReports).flat().find(item => item.id === activeId)
    : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 pb-4 overflow-x-auto">
          <DroppableColumn
            title="Open"
            status="open"
            items={filteredReports.open}
            getStatusIcon={getStatusIcon}
            getFollowUpIcon={getFollowUpIcon}
            onCardClick={handleCardClick}
            updatingItems={updatingItems}
            searchQuery={searchQueries.open}
            onSearchChange={(query) => handleSearchChange('open', query)}
            inventoryFilter={inventoryFilters.open}
            onInventoryFilterToggle={(inventoryStatus) => handleInventoryFilterToggle('open', inventoryStatus)}
          />

          <DroppableColumn
            title="On Progress"
            status="on_progress"
            items={filteredReports.on_progress}
            getStatusIcon={getStatusIcon}
            getFollowUpIcon={getFollowUpIcon}
            onCardClick={handleCardClick}
            updatingItems={updatingItems}
            searchQuery={searchQueries.on_progress}
            onSearchChange={(query) => handleSearchChange('on_progress', query)}
            inventoryFilter={inventoryFilters.on_progress}
            onInventoryFilterToggle={(inventoryStatus) => handleInventoryFilterToggle('on_progress', inventoryStatus)}
          />

          <DroppableColumn
            title="Closed"
            status="closed"
            items={filteredReports.closed}
            getStatusIcon={getStatusIcon}
            getFollowUpIcon={getFollowUpIcon}
            onCardClick={handleCardClick}
            updatingItems={updatingItems}
            searchQuery={searchQueries.closed}
            onSearchChange={(query) => handleSearchChange('closed', query)}
            inventoryFilter={inventoryFilters.closed}
            onInventoryFilterToggle={(inventoryStatus) => handleInventoryFilterToggle('closed', inventoryStatus)}
          />
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="bg-white border-2 border-blue-400 rounded-md p-3 shadow-lg opacity-90">
              <div className="flex items-center gap-2">
                {getStatusIcon(activeItem.inventory_status)}
                <span className="text-sm font-medium text-gray-900">
                  {activeItem.item_name}
                </span>
                {getFollowUpIcon(activeItem.follow_up_status)}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <KanbanCardModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        item={selectedCard}
        onStatusUpdate={handleStatusUpdate}
        getStatusIcon={getStatusIcon}
        getFollowUpIcon={getFollowUpIcon}
      />
    </>
  );
};

export default KanbanBoard;