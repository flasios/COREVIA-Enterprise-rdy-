/**
 * Extracted from ExecutionPhaseTab.tsx — MultiTaskSelector component.
 *
 * Hierarchical task selector with search, expand/collapse, and multi-select.
 * Used by ChangeRequestForm to select affected tasks.
 */
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { WbsTaskData } from '../../../types';

export function MultiTaskSelector({
  tasks,
  selectedTaskIds,
  onSelectionChange,
  initialTask,
}: {
  tasks: WbsTaskData[];
  selectedTaskIds: string[];
  onSelectionChange: (taskIds: string[]) => void;
  initialTask?: WbsTaskData | null;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const hierarchicalTasks = useMemo(() => {
    const parentMap = new Map<string | null, WbsTaskData[]>();

    const filteredTasks = !searchQuery
      ? tasks
      : tasks.filter(
          (t) =>
            (t.taskName || t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.wbsCode || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

    for (const task of filteredTasks) {
      const parentId = task.parentTaskId || null;
      if (!parentMap.has(parentId)) parentMap.set(parentId, []);
      parentMap.get(parentId)!.push(task);
    }
    return parentMap;
  }, [tasks, searchQuery]);

  const toggleTask = (taskId: string) => {
    if (selectedTaskIds.includes(taskId)) {
      onSelectionChange(selectedTaskIds.filter((id) => id !== taskId));
    } else {
      onSelectionChange([...selectedTaskIds, taskId]);
    }
  };

  const toggleParent = (parentId: string) => {
    const next = new Set(expandedParents);
    if (next.has(parentId)) next.delete(parentId);
    else next.add(parentId);
    setExpandedParents(next);
  };

  const selectAll = () => onSelectionChange(tasks.map((t) => t.id));
  const clearAll = () => onSelectionChange(initialTask ? [initialTask.id] : []);

  const renderTask = (task: WbsTaskData, depth = 0) => {
    const children = hierarchicalTasks.get(task.id) || [];
    const isExpanded = expandedParents.has(task.id);
    const isSelected = selectedTaskIds.includes(task.id);

    return (
      <div key={task.id}>
        <div
          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-primary/10' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => toggleTask(task.id)}
        >
          {children.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleParent(task.id);
              }}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>
          )}
          {children.length === 0 && <div className="w-5" />}
          <CheckSquare className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-xs flex-1 truncate">{task.wbsCode ? `${task.wbsCode} — ` : ''}{task.taskName || task.title}</span>
          <Badge variant="outline" className="text-[9px]">{task.status || 'pending'}</Badge>
        </div>
        {isExpanded && children.map((child) => renderTask(child, depth + 1))}
      </div>
    );
  };

  const rootTasks = hierarchicalTasks.get(null) || [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={selectAll}>All</Button>
        <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={clearAll}>Clear</Button>
      </div>
      <div className="text-[10px] text-muted-foreground">{selectedTaskIds.length} task(s) selected</div>
      <ScrollArea className="h-48 border rounded-md p-1">
        {rootTasks.map((t) => renderTask(t))}
        {rootTasks.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">No tasks found</div>
        )}
      </ScrollArea>
    </div>
  );
}
