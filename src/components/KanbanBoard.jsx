import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
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
import { AlertTriangle, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import KanbanCardModal from './KanbanCardModal';

// Compact Kanban Card Component
const KanbanCard = ({ item, getStatusIcon, getFollowUpIcon, onCardClick, onSelectionChange, isSelected, isUpdating }) => {
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
      className={`bg-white border rounded-md p-3 mb-2 hover:shadow-md transition-shadow group relative ${
        isUpdating ? 'border-blue-400 bg-blue-50 cursor-not-allowed' : 'border-gray-200 cursor-move'
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
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelectionChange(item.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          />
          {getStatusIcon(item.inventory_status)}
          <span className="text-sm font-medium text-gray-900 truncate">
            {item.item_name}
          </span>
        </div>
        {getFollowUpIcon(item.follow_up_status)}
      </div>
    </div>
  );
};

// Droppable Column Component
const DroppableColumn = ({ title, items, status, getStatusIcon, getFollowUpIcon, onCardClick, onSelectionChange, selectedItems, updatingItems }) => {
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
      ref={setNodeRef}
      className={`flex-1 min-w-0 ${getStatusColor(status)} border-2 rounded-lg p-4 transition-colors ${
        isOver ? 'border-blue-400 bg-blue-100' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        {getColumnStatusIcon(status)}
        <h3 className="font-semibold text-gray-900 capitalize">
          {status.replace('_', ' ')}
        </h3>
        <span className="bg-white px-2 py-1 text-xs font-medium rounded-full">
          {items.length}
        </span>
      </div>
      
      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[200px]">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No items in {status.replace('_', ' ')}
            </div>
          ) : (
            items.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                getStatusIcon={getStatusIcon}
                getFollowUpIcon={getFollowUpIcon}
                onCardClick={onCardClick}
                onSelectionChange={onSelectionChange}
                isSelected={selectedItems.includes(item.id)}
                isUpdating={updatingItems?.has(item.id) || false}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
};

// Main Kanban Board Component
const KanbanBoard = ({ 
  groupedReports, 
  getStatusIcon, 
  getFollowUpIcon, 
  onStatusUpdate, 
  selectedItems, 
  onSelectionChange 
}) => {
  const [activeId, setActiveId] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updatingItems, setUpdatingItems] = useState(new Set());

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

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    // Find the source and destination columns
    const sourceColumn = Object.keys(groupedReports).find(column =>
      groupedReports[column].some(item => item.id === active.id)
    );
    
    // The over.id should be the column status ('open', 'on_progress', 'closed')
    const destinationColumn = over.id;
    
    if (sourceColumn && destinationColumn && sourceColumn !== destinationColumn) {
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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 pb-4 overflow-x-auto">
          <DroppableColumn
            title="Open"
            status="open"
            items={groupedReports.open || []}
            getStatusIcon={getStatusIcon}
            getFollowUpIcon={getFollowUpIcon}
            onCardClick={handleCardClick}
            onSelectionChange={onSelectionChange}
            selectedItems={selectedItems}
            updatingItems={updatingItems}
          />
          
          <DroppableColumn
            title="On Progress"
            status="on_progress"
            items={groupedReports.on_progress || []}
            getStatusIcon={getStatusIcon}
            getFollowUpIcon={getFollowUpIcon}
            onCardClick={handleCardClick}
            onSelectionChange={onSelectionChange}
            selectedItems={selectedItems}
            updatingItems={updatingItems}
          />
          
          <DroppableColumn
            title="Closed"
            status="closed"
            items={groupedReports.closed || []}
            getStatusIcon={getStatusIcon}
            getFollowUpIcon={getFollowUpIcon}
            onCardClick={handleCardClick}
            onSelectionChange={onSelectionChange}
            selectedItems={selectedItems}
            updatingItems={updatingItems}
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