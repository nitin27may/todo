export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export enum TaskStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED'
}

export interface TaskInput {
  title: string;
  description?: string;
}

export interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: (id: number, status: TaskStatus) => void;
  onTaskDelete: (id: number) => void;
}

export interface TaskItemProps {
  task: Task;
  onStatusToggle: (id: number, status: TaskStatus) => void;
  onDelete: (id: number) => void;
}
