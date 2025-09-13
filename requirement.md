# Technical Implementation Documentation: Simple TO-DO List with Real-Time Sync

## Project Overview
A full-stack task management application with real-time synchronization capabilities, built using ASP.NET Core GraphQL backend, React frontend with Adobe React Spectrum, and containerized deployment with Docker.

## Architecture Overview

### Technology Stack
- **Backend**: ASP.NET Core 8.0, GraphQL (HotChocolate), Entity Framework Core
- **Database**: SQL Server (with SQLite fallback for development)
- **Frontend**: React 18, Adobe React Spectrum, Relay GraphQL Client
- **Containerization**: Docker, Docker Compose
- **Real-time**: SignalR for live updates

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  ASP.NET Core   │    │   SQL Server    │
│   (Port 3000)   │◄──►│   GraphQL API   │◄──►│   (Port 1433)   │
│                 │    │   (Port 5000)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         └───────────────────────┘
              SignalR Hub
```

## Backend Implementation Details

### 1. Project Structure
```
Backend/
├── Controllers/
├── Models/
│   ├── Task.cs
│   └── TaskStatus.cs
├── Data/
│   ├── ApplicationDbContext.cs
│   └── DbInitializer.cs
├── GraphQL/
│   ├── Types/
│   │   ├── TaskType.cs
│   │   └── TaskInputType.cs
│   ├── Queries/
│   │   └── TaskQuery.cs
│   ├── Mutations/
│   │   └── TaskMutation.cs
│   └── Subscriptions/
│       └── TaskSubscription.cs
├── Hubs/
│   └── TaskHub.cs
├── Program.cs
└── appsettings.json
```

### 2. Data Models

#### Task Entity
```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("Tasks")]
public class Task
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string? Description { get; set; }
    
    [Required]
    public TaskStatus Status { get; set; } = TaskStatus.Pending;
    
    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [Required]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum TaskStatus
{
    Pending = 0,
    Completed = 1
}

public class TaskInput
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string? Description { get; set; }
}
```

#### Entity Framework Configuration
```csharp
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }
    
    public DbSet<Task> Tasks { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Task>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.Status).HasConversion<int>();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");
            
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
        });
    }
}
```

### 3. GraphQL Schema Definition

#### Complete GraphQL Schema
```graphql
type Task {
  id: Int!
  title: String!
  description: String
  status: TaskStatus!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum TaskStatus {
  PENDING
  COMPLETED
}

input TaskInput {
  title: String!
  description: String
}

type Query {
  getAllTasks: [Task!]!
  getTaskById(id: Int!): Task
}

type Mutation {
  createTask(input: TaskInput!): Task!
  updateTaskStatus(id: Int!, status: TaskStatus!): Task!
  deleteTask(id: Int!): Boolean!
}

type Subscription {
  taskCreated: Task!
  taskUpdated: Task!
  taskDeleted: Int!
}
```

#### GraphQL Type Definitions (C#)
```csharp
// TaskType.cs
public class TaskType : ObjectType<Task>
{
    protected override void Configure(IObjectTypeDescriptor<Task> descriptor)
    {
        descriptor.Field(t => t.Id).Type<NonNullType<IntType>>();
        descriptor.Field(t => t.Title).Type<NonNullType<StringType>>();
        descriptor.Field(t => t.Description).Type<StringType>();
        descriptor.Field(t => t.Status).Type<NonNullType<TaskStatusType>>();
        descriptor.Field(t => t.CreatedAt).Type<NonNullType<DateTimeType>>();
        descriptor.Field(t => t.UpdatedAt).Type<NonNullType<DateTimeType>>();
    }
}

// TaskStatusType.cs
public class TaskStatusType : EnumType<TaskStatus>
{
    protected override void Configure(IEnumTypeDescriptor<TaskStatus> descriptor)
    {
        descriptor.Value(TaskStatus.Pending).Name("PENDING");
        descriptor.Value(TaskStatus.Completed).Name("COMPLETED");
    }
}

// TaskInputType.cs
public class TaskInputType : InputObjectType<TaskInput>
{
    protected override void Configure(IInputObjectTypeDescriptor<TaskInput> descriptor)
    {
        descriptor.Field(t => t.Title).Type<NonNullType<StringType>>();
        descriptor.Field(t => t.Description).Type<StringType>();
    }
}
```

#### Query Resolvers
```csharp
public class TaskQuery
{
    [UseDbContext(typeof(ApplicationDbContext))]
    public async Task<IEnumerable<Task>> GetAllTasks([ScopedService] ApplicationDbContext context)
    {
        return await context.Tasks
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    [UseDbContext(typeof(ApplicationDbContext))]
    public async Task<Task?> GetTaskById(int id, [ScopedService] ApplicationDbContext context)
    {
        return await context.Tasks.FindAsync(id);
    }
}
```

#### Mutation Resolvers
```csharp
public class TaskMutation
{
    [UseDbContext(typeof(ApplicationDbContext))]
    public async Task<Task> CreateTask(TaskInput input, [ScopedService] ApplicationDbContext context)
    {
        var task = new Task
        {
            Title = input.Title,
            Description = input.Description,
            Status = TaskStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Tasks.Add(task);
        await context.SaveChangesAsync();
        return task;
    }

    [UseDbContext(typeof(ApplicationDbContext))]
    public async Task<Task?> UpdateTaskStatus(int id, TaskStatus status, [ScopedService] ApplicationDbContext context)
    {
        var task = await context.Tasks.FindAsync(id);
        if (task == null) return null;

        task.Status = status;
        task.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        return task;
    }

    [UseDbContext(typeof(ApplicationDbContext))]
    public async Task<bool> DeleteTask(int id, [ScopedService] ApplicationDbContext context)
    {
        var task = await context.Tasks.FindAsync(id);
        if (task == null) return false;

        context.Tasks.Remove(task);
        await context.SaveChangesAsync();
        return true;
    }
}
```

#### Subscription Resolvers
```csharp
public class TaskSubscription
{
    [Subscribe]
    public Task OnTaskCreated([EventMessage] Task task) => Task.FromResult(task);

    [Subscribe]
    public Task OnTaskUpdated([EventMessage] Task task) => Task.FromResult(task);

    [Subscribe]
    public Task OnTaskDeleted([EventMessage] int taskId) => Task.FromResult(taskId);
}
```

### 4. Entity Framework Configuration

#### DbContext Setup
- Connection string configuration for SQL Server and SQLite
- Task entity configuration with proper indexing
- Database migration strategy
- Seed data for development

#### Connection Strings
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=db;Database=TodoDb;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=true;",
    "SqliteConnection": "Data Source=todo.db"
  }
}
```

### 5. SignalR Hub Implementation

#### TaskHub.cs
```csharp
using Microsoft.AspNetCore.SignalR;

public class TaskHub : Hub
{
    public async Task JoinGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }

    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }

    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "AllUsers");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "AllUsers");
        await base.OnDisconnectedAsync(exception);
    }
}
```

#### SignalR Service Integration
```csharp
// Program.cs configuration
builder.Services.AddSignalR();

// In Configure method
app.MapHub<TaskHub>("/taskHub");

// Service for publishing events
public interface ITaskNotificationService
{
    Task NotifyTaskCreated(Task task);
    Task NotifyTaskUpdated(Task task);
    Task NotifyTaskDeleted(int taskId);
}

public class TaskNotificationService : ITaskNotificationService
{
    private readonly IHubContext<TaskHub> _hubContext;

    public TaskNotificationService(IHubContext<TaskHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyTaskCreated(Task task)
    {
        await _hubContext.Clients.All.SendAsync("TaskCreated", task);
    }

    public async Task NotifyTaskUpdated(Task task)
    {
        await _hubContext.Clients.All.SendAsync("TaskUpdated", task);
    }

    public async Task NotifyTaskDeleted(int taskId)
    {
        await _hubContext.Clients.All.SendAsync("TaskDeleted", taskId);
    }
}
```

### 6. API Endpoints
- GraphQL endpoint: `/graphql`
- GraphQL Playground: `/graphql/playground`
- SignalR Hub: `/taskHub`
- Health check: `/health`

## Frontend Implementation Details

### 1. Project Structure
```
Frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── TaskList.tsx
│   │   ├── TaskItem.tsx
│   │   ├── AddTaskForm.tsx
│   │   └── TaskFilter.tsx
│   ├── hooks/
│   │   ├── useTasks.ts
│   │   └── useTaskMutations.ts
│   ├── graphql/
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   └── fragments.ts
│   ├── types/
│   │   └── Task.ts
│   ├── utils/
│   │   └── relayEnvironment.ts
│   ├── App.tsx
│   └── index.tsx
├── package.json
└── Dockerfile
```

### 2. Dependencies
```json
{
  "name": "todo-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "relay": "relay-compiler"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@adobe/react-spectrum": "^3.0.0",
    "@adobe/react-spectrum-icons": "^3.0.0",
    "react-relay": "^14.0.0",
    "relay-runtime": "^14.0.0",
    "@microsoft/signalr": "^8.0.0",
    "graphql": "^16.8.0",
    "react-router-dom": "^6.8.0",
    "date-fns": "^2.29.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "eslint": "^8.45.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.3",
    "relay-compiler": "^14.0.0",
    "typescript": "^5.0.0",
    "vite": "^4.0.0"
  }
}
```

### 3. Vite Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/graphql': 'http://localhost:5000',
      '/taskHub': {
        target: 'http://localhost:5000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
```

### 4. TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 5. Component Specifications

#### TypeScript Types
```typescript
// src/types/Task.ts
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
```

#### TaskList Component
```typescript
// src/components/TaskList.tsx
import React from 'react';
import { View, Heading, Flex, Picker, Item } from '@adobe/react-spectrum';
import { TaskItem } from './TaskItem';
import { Task, TaskStatus } from '../types/Task';

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: (id: number, status: TaskStatus) => void;
  onTaskDelete: (id: number) => void;
  filter: TaskStatus | 'ALL';
  onFilterChange: (filter: TaskStatus | 'ALL') => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onTaskUpdate,
  onTaskDelete,
  filter,
  onFilterChange
}) => {
  const filteredTasks = filter === 'ALL' 
    ? tasks 
    : tasks.filter(task => task.status === filter);

  return (
    <View>
      <Flex direction="column" gap="size-200">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading level={2}>Tasks ({filteredTasks.length})</Heading>
          <Picker
            label="Filter"
            selectedKey={filter}
            onSelectionChange={(key) => onFilterChange(key as TaskStatus | 'ALL')}
          >
            <Item key="ALL">All Tasks</Item>
            <Item key={TaskStatus.PENDING}>Pending</Item>
            <Item key={TaskStatus.COMPLETED}>Completed</Item>
          </Picker>
        </Flex>
        
        <Flex direction="column" gap="size-100">
          {filteredTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onStatusToggle={onTaskUpdate}
              onDelete={onTaskDelete}
            />
          ))}
        </Flex>
      </Flex>
    </View>
  );
};
```

#### TaskItem Component
```typescript
// src/components/TaskItem.tsx
import React from 'react';
import { 
  View, 
  Flex, 
  Text, 
  Button, 
  ButtonGroup,
  Checkbox,
  ActionButton,
  Divider
} from '@adobe/react-spectrum';
import { Delete, Edit } from '@adobe/react-spectrum-icons';
import { Task, TaskStatus } from '../types/Task';
import { format } from 'date-fns';

interface TaskItemProps {
  task: Task;
  onStatusToggle: (id: number, status: TaskStatus) => void;
  onDelete: (id: number) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onStatusToggle,
  onDelete
}) => {
  const handleStatusToggle = () => {
    const newStatus = task.status === TaskStatus.PENDING 
      ? TaskStatus.COMPLETED 
      : TaskStatus.PENDING;
    onStatusToggle(task.id, newStatus);
  };

  return (
    <View
      padding="size-200"
      backgroundColor={task.status === TaskStatus.COMPLETED ? 'gray-100' : 'gray-50'}
      borderRadius="medium"
      borderWidth="thin"
      borderColor="gray-300"
    >
      <Flex direction="column" gap="size-100">
        <Flex justifyContent="space-between" alignItems="flex-start">
          <Flex alignItems="center" gap="size-100">
            <Checkbox
              isSelected={task.status === TaskStatus.COMPLETED}
              onChange={handleStatusToggle}
              aria-label={`Mark task as ${task.status === TaskStatus.PENDING ? 'completed' : 'pending'}`}
            />
            <View>
              <Text
                fontSize="size-200"
                fontWeight="bold"
                textDecoration={task.status === TaskStatus.COMPLETED ? 'line-through' : 'none'}
                color={task.status === TaskStatus.COMPLETED ? 'gray-500' : 'gray-900'}
              >
                {task.title}
              </Text>
              {task.description && (
                <Text
                  fontSize="size-100"
                  color="gray-600"
                  textDecoration={task.status === TaskStatus.COMPLETED ? 'line-through' : 'none'}
                >
                  {task.description}
                </Text>
              )}
            </View>
          </Flex>
          
          <ButtonGroup>
            <ActionButton
              onPress={() => onDelete(task.id)}
              aria-label="Delete task"
            >
              <Delete />
            </ActionButton>
          </ButtonGroup>
        </Flex>
        
        <Divider size="S" />
        
        <Flex justifyContent="space-between" alignItems="center">
          <Text fontSize="size-75" color="gray-500">
            Created: {format(new Date(task.createdAt), 'MMM dd, yyyy HH:mm')}
          </Text>
          <Text fontSize="size-75" color="gray-500">
            Updated: {format(new Date(task.updatedAt), 'MMM dd, yyyy HH:mm')}
          </Text>
        </Flex>
      </Flex>
    </View>
  );
};
```

#### AddTaskForm Component
```typescript
// src/components/AddTaskForm.tsx
import React, { useState } from 'react';
import { 
  View, 
  Flex, 
  TextField, 
  TextArea, 
  Button, 
  ButtonGroup,
  Heading,
  Alert
} from '@adobe/react-spectrum';
import { TaskInput } from '../types/Task';

interface AddTaskFormProps {
  onSubmit: (input: TaskInput) => Promise<void>;
  isLoading?: boolean;
}

export const AddTaskForm: React.FC<AddTaskFormProps> = ({
  onSubmit,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<TaskInput>({
    title: '',
    description: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }
    
    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      await onSubmit(formData);
      setFormData({ title: '', description: '' });
      setErrors({});
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  return (
    <View padding="size-200" backgroundColor="gray-50" borderRadius="medium">
      <Heading level={3} marginBottom="size-200">Add New Task</Heading>
      
      <form onSubmit={handleSubmit}>
        <Flex direction="column" gap="size-200">
          <TextField
            label="Title"
            value={formData.title}
            onChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
            isRequired
            isInvalid={!!errors.title}
            errorMessage={errors.title}
            maxLength={200}
            placeholder="Enter task title..."
          />
          
          <TextArea
            label="Description"
            value={formData.description || ''}
            onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
            isInvalid={!!errors.description}
            errorMessage={errors.description}
            maxLength={1000}
            placeholder="Enter task description (optional)..."
            rows={3}
          />
          
          <ButtonGroup>
            <Button
              type="submit"
              variant="cta"
              isDisabled={isLoading || !formData.title.trim()}
            >
              {isLoading ? 'Adding...' : 'Add Task'}
            </Button>
          </ButtonGroup>
        </Flex>
      </form>
    </View>
  );
};
```

### 6. GraphQL Integration

#### Relay Environment Setup
```typescript
// src/utils/relayEnvironment.ts
import { Environment, Network, RecordSource, Store } from 'relay-runtime';

const fetchQuery = async (operation: any, variables: any) => {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: operation.text,
      variables,
    }),
  });

  return response.json();
};

const network = Network.create(fetchQuery);
const store = new Store(new RecordSource());

export const relayEnvironment = new Environment({
  network,
  store,
});
```

#### GraphQL Queries and Mutations
```typescript
// src/graphql/queries.ts
import { graphql } from 'relay-runtime';

export const GET_ALL_TASKS_QUERY = graphql`
  query queries_GetAllTasksQuery {
    getAllTasks {
      id
      title
      description
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_TASK_BY_ID_QUERY = graphql`
  query queries_GetTaskByIdQuery($id: Int!) {
    getTaskById(id: $id) {
      id
      title
      description
      status
      createdAt
      updatedAt
    }
  }
`;
```

```typescript
// src/graphql/mutations.ts
import { graphql } from 'relay-runtime';

export const CREATE_TASK_MUTATION = graphql`
  mutation mutations_CreateTaskMutation($input: TaskInput!) {
    createTask(input: $input) {
      id
      title
      description
      status
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_TASK_STATUS_MUTATION = graphql`
  mutation mutations_UpdateTaskStatusMutation($id: Int!, $status: TaskStatus!) {
    updateTaskStatus(id: $id, status: $status) {
      id
      title
      description
      status
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_TASK_MUTATION = graphql`
  mutation mutations_DeleteTaskMutation($id: Int!) {
    deleteTask(id: $id)
  }
`;
```

#### GraphQL Fragments
```typescript
// src/graphql/fragments.ts
import { graphql } from 'relay-runtime';

export const TASK_FRAGMENT = graphql`
  fragment TaskItem_task on Task {
    id
    title
    description
    status
    createdAt
    updatedAt
  }
`;
```

#### Custom Hooks for GraphQL Operations
```typescript
// src/hooks/useTasks.ts
import { useQuery, useMutation } from 'react-relay';
import { useCallback } from 'react';
import { GET_ALL_TASKS_QUERY } from '../graphql/queries';
import { CREATE_TASK_MUTATION, UPDATE_TASK_STATUS_MUTATION, DELETE_TASK_MUTATION } from '../graphql/mutations';
import { TaskInput, TaskStatus } from '../types/Task';

export const useTasks = () => {
  const { data, isLoading, error, refetch } = useQuery(GET_ALL_TASKS_QUERY, {});

  return {
    tasks: data?.getAllTasks || [],
    isLoading,
    error,
    refetch
  };
};

export const useTaskMutations = () => {
  const [createTaskMutation, isCreating] = useMutation(CREATE_TASK_MUTATION);
  const [updateTaskStatusMutation, isUpdating] = useMutation(UPDATE_TASK_STATUS_MUTATION);
  const [deleteTaskMutation, isDeleting] = useMutation(DELETE_TASK_MUTATION);

  const createTask = useCallback(async (input: TaskInput) => {
    return new Promise((resolve, reject) => {
      createTaskMutation({
        variables: { input },
        onCompleted: (response) => {
          resolve(response.createTask);
        },
        onError: (error) => {
          reject(error);
        }
      });
    });
  }, [createTaskMutation]);

  const updateTaskStatus = useCallback(async (id: number, status: TaskStatus) => {
    return new Promise((resolve, reject) => {
      updateTaskStatusMutation({
        variables: { id, status },
        onCompleted: (response) => {
          resolve(response.updateTaskStatus);
        },
        onError: (error) => {
          reject(error);
        }
      });
    });
  }, [updateTaskStatusMutation]);

  const deleteTask = useCallback(async (id: number) => {
    return new Promise((resolve, reject) => {
      deleteTaskMutation({
        variables: { id },
        onCompleted: (response) => {
          resolve(response.deleteTask);
        },
        onError: (error) => {
          reject(error);
        }
      });
    });
  }, [deleteTaskMutation]);

  return {
    createTask,
    updateTaskStatus,
    deleteTask,
    isCreating,
    isUpdating,
    isDeleting
  };
};
```

### 7. Real-time Updates

#### SignalR Connection Hook
```typescript
// src/hooks/useSignalR.ts
import { useEffect, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

interface UseSignalRReturn {
  connection: signalR.HubConnection | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  startConnection: () => Promise<void>;
  stopConnection: () => Promise<void>;
}

export const useSignalR = (): UseSignalRReturn => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startConnection = useCallback(async () => {
    if (connection) return;

    setIsConnecting(true);
    setError(null);

    try {
      const newConnection = new signalR.HubConnectionBuilder()
        .withUrl('/taskHub')
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: retryContext => {
            if (retryContext.previousRetryCount === 0) {
              return 0;
            }
            return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
          }
        })
        .build();

      newConnection.onclose((error) => {
        console.log('SignalR connection closed:', error);
        setIsConnected(false);
        setConnection(null);
      });

      newConnection.onreconnecting((error) => {
        console.log('SignalR reconnecting:', error);
        setIsConnected(false);
      });

      newConnection.onreconnected((connectionId) => {
        console.log('SignalR reconnected:', connectionId);
        setIsConnected(true);
      });

      await newConnection.start();
      setConnection(newConnection);
      setIsConnected(true);
    } catch (err) {
      console.error('SignalR connection error:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, [connection]);

  const stopConnection = useCallback(async () => {
    if (connection) {
      await connection.stop();
      setConnection(null);
      setIsConnected(false);
    }
  }, [connection]);

  useEffect(() => {
    startConnection();

    return () => {
      stopConnection();
    };
  }, []);

  return {
    connection,
    isConnected,
    isConnecting,
    error,
    startConnection,
    stopConnection
  };
};
```

#### Real-time Task Updates Hook
```typescript
// src/hooks/useRealTimeTasks.ts
import { useEffect, useCallback } from 'react';
import { useSignalR } from './useSignalR';
import { Task, TaskStatus } from '../types/Task';

interface UseRealTimeTasksProps {
  onTaskCreated: (task: Task) => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: number) => void;
}

export const useRealTimeTasks = ({
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted
}: UseRealTimeTasksProps) => {
  const { connection, isConnected } = useSignalR();

  useEffect(() => {
    if (!connection || !isConnected) return;

    const handleTaskCreated = (task: Task) => {
      console.log('Task created:', task);
      onTaskCreated(task);
    };

    const handleTaskUpdated = (task: Task) => {
      console.log('Task updated:', task);
      onTaskUpdated(task);
    };

    const handleTaskDeleted = (taskId: number) => {
      console.log('Task deleted:', taskId);
      onTaskDeleted(taskId);
    };

    connection.on('TaskCreated', handleTaskCreated);
    connection.on('TaskUpdated', handleTaskUpdated);
    connection.on('TaskDeleted', handleTaskDeleted);

    return () => {
      connection.off('TaskCreated', handleTaskCreated);
      connection.off('TaskUpdated', handleTaskUpdated);
      connection.off('TaskDeleted', handleTaskDeleted);
    };
  }, [connection, isConnected, onTaskCreated, onTaskUpdated, onTaskDeleted]);

  return { isConnected };
};
```

### 6. State Management
- Relay for server state
- Local state for UI interactions
- Optimistic updates for better UX
- Error state handling

## Docker Configuration

### 1. Backend Dockerfile
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["Backend/Backend.csproj", "Backend/"]
RUN dotnet restore "Backend/Backend.csproj"
COPY . .
WORKDIR "/src/Backend"
RUN dotnet build "Backend.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Backend.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Backend.dll"]
```

### 2. Frontend Dockerfile
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY Frontend/package*.json ./
RUN npm ci --only=production
COPY Frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY Frontend/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3. Nginx Configuration
```nginx
# Frontend/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Proxy API requests to backend
        location /graphql {
            proxy_pass http://backend:80;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Proxy SignalR hub
        location /taskHub {
            proxy_pass http://backend:80;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

        # Gzip compression
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_proxied expired no-cache no-store private must-revalidate auth;
        gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    }
}
```

### 4. Docker Compose Configuration
```yaml
version: '3.8'
services:
  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: todo-db
    environment:
      SA_PASSWORD: "YourStrong@Passw0rd"
      ACCEPT_EULA: "Y"
      MSSQL_PID: "Express"
    ports:
      - "1433:1433"
    volumes:
      - sqlserver_data:/var/opt/mssql
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Passw0rd -Q 'SELECT 1'"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    networks:
      - todo-network

  backend:
    build: 
      context: ./Backend
      dockerfile: Dockerfile
    container_name: todo-backend
    ports:
      - "5000:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:80
      - ConnectionStrings__DefaultConnection=Server=db;Database=TodoDb;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=true;MultipleActiveResultSets=true;
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - todo-network

  frontend:
    build: 
      context: ./Frontend
      dockerfile: Dockerfile
    container_name: todo-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - todo-network

volumes:
  sqlserver_data:
    driver: local

networks:
  todo-network:
    driver: bridge
```

### 5. Environment Configuration
```yaml
# .env file for local development
# Backend
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=http://localhost:5000
ConnectionStrings__DefaultConnection=Server=localhost;Database=TodoDb;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=true;MultipleActiveResultSets=true;

# Database
SA_PASSWORD=YourStrong@Passw0rd
ACCEPT_EULA=Y

# Frontend
VITE_API_URL=http://localhost:5000
VITE_GRAPHQL_ENDPOINT=http://localhost:5000/graphql
VITE_SIGNALR_HUB=http://localhost:5000/taskHub
```

## Development Workflow

### 1. Local Development Setup
1. Clone repository
2. Run `docker-compose up -d` for database
3. Start backend: `cd Backend && dotnet run`
4. Start frontend: `cd Frontend && npm start`

### 2. Database Migrations
- Initial migration: `dotnet ef migrations add InitialCreate`
- Apply migrations: `dotnet ef database update`
- Seed data: `dotnet run --seed`

### 3. Testing Strategy
- Backend: Unit tests for GraphQL resolvers, integration tests for API
- Frontend: Component tests with React Testing Library
- E2E: Playwright tests for critical user flows

## Performance Considerations

### 1. Backend Optimizations
- Entity Framework query optimization
- GraphQL query complexity analysis
- SignalR connection pooling
- Database indexing strategy

### 2. Frontend Optimizations
- React.memo for component optimization
- Relay query deduplication
- Lazy loading for large task lists
- Virtual scrolling for performance

### 3. Caching Strategy
- Redis for session state
- CDN for static assets
- Database query result caching

## Security Considerations

### 1. Backend Security
- CORS configuration
- Input validation and sanitization
- SQL injection prevention
- Rate limiting for API endpoints

### 2. Frontend Security
- XSS prevention
- CSRF protection
- Secure cookie handling
- Content Security Policy

## Monitoring and Logging

### 1. Application Insights
- Performance monitoring
- Error tracking
- User analytics
- Custom metrics

### 2. Logging Strategy
- Structured logging with Serilog
- Log levels configuration
- Centralized log aggregation
- Real-time log monitoring

## Deployment Strategy

### 1. Environment Configuration
- Development: Local Docker Compose
- Staging: Azure Container Instances
- Production: Azure Kubernetes Service

### 2. CI/CD Pipeline
- GitHub Actions for automated builds
- Docker image registry
- Automated testing
- Blue-green deployment

## AI Development Guidelines

### 1. Code Generation Prompts

#### Backend Development Prompts
```
"Create an ASP.NET Core 8.0 Web API project with the following specifications:
- Use HotChocolate for GraphQL with subscriptions
- Entity Framework Core with SQL Server
- SignalR for real-time updates
- Include the Task entity with validation attributes
- Implement CRUD operations with proper error handling
- Add health checks and CORS configuration
- Include structured logging with Serilog"
```

#### Frontend Development Prompts
```
"Create a React 18 application with TypeScript using:
- Adobe React Spectrum for UI components
- Relay GraphQL client for data fetching
- SignalR client for real-time updates
- Custom hooks for state management
- Proper error boundaries and loading states
- Responsive design with mobile support
- Accessibility features (ARIA labels, keyboard navigation)"
```

#### Component-Specific Prompts
```
"Generate a TaskItem component using Adobe React Spectrum with:
- Checkbox for status toggle
- Delete button with confirmation
- Responsive layout
- Loading states
- Error handling
- TypeScript interfaces
- Accessibility features
- Real-time update support"
```

### 2. Testing Prompts

#### Unit Test Prompts
```
"Generate unit tests for the TaskMutation resolver with:
- Test successful task creation
- Test validation errors
- Test database exceptions
- Mock dependencies properly
- Use xUnit and Moq frameworks
- Include edge cases and error scenarios"
```

#### Integration Test Prompts
```
"Create integration tests for the GraphQL API with:
- Test all CRUD operations
- Test real-time subscriptions
- Test error responses
- Use TestServer for ASP.NET Core
- Include database seeding
- Test CORS configuration"
```

#### Frontend Test Prompts
```
"Generate React component tests using React Testing Library with:
- Test user interactions
- Test GraphQL integration
- Test real-time updates
- Mock SignalR connection
- Test error states
- Test accessibility features
- Include snapshot tests"
```

### 3. Docker Configuration Prompts
```
"Create Docker configuration for a full-stack application with:
- Multi-stage builds for optimization
- Health checks for all services
- Proper networking between containers
- Environment variable configuration
- Volume management for data persistence
- Security best practices
- Production-ready configuration"
```

### 4. Database Migration Prompts
```
"Generate Entity Framework migrations with:
- Initial database schema
- Proper indexing strategy
- Data seeding for development
- Rollback procedures
- Performance optimizations
- Foreign key constraints
- Audit trail fields"
```

### 5. Security Implementation Prompts
```
"Implement security features for the application:
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens
- Rate limiting
- Authentication and authorization
- Secure headers configuration
- Data encryption at rest and in transit"
```

### 6. Performance Optimization Prompts
```
"Optimize application performance with:
- Database query optimization
- Caching strategies
- CDN configuration
- Image optimization
- Code splitting
- Lazy loading
- Memory management
- Connection pooling"
```

### 7. Monitoring and Logging Prompts
```
"Set up monitoring and logging with:
- Application Insights integration
- Custom metrics and counters
- Error tracking and alerting
- Performance monitoring
- Log aggregation
- Health check endpoints
- Distributed tracing
- Real-time dashboards"
```

### 8. CI/CD Pipeline Prompts
```
"Create CI/CD pipeline with:
- GitHub Actions workflows
- Automated testing
- Docker image building
- Security scanning
- Deployment automation
- Environment promotion
- Rollback procedures
- Notification systems"
```

### 9. Documentation Generation Prompts
```
"Generate comprehensive documentation including:
- API documentation with examples
- Database schema documentation
- Deployment guides
- Troubleshooting guides
- User manuals
- Developer onboarding guides
- Architecture decision records
- Performance tuning guides"
```

### 10. Error Handling Prompts
```
"Implement comprehensive error handling with:
- Global error boundaries
- Custom error types
- User-friendly error messages
- Logging and monitoring
- Retry mechanisms
- Circuit breaker patterns
- Graceful degradation
- Error recovery strategies"
```

## Success Criteria

### 1. Functional Requirements
- ✅ Create, read, update, delete tasks
- ✅ Real-time synchronization
- ✅ Status toggle functionality
- ✅ Responsive UI design

### 2. Non-Functional Requirements
- ✅ Sub-second response times
- ✅ 99.9% uptime
- ✅ Mobile-responsive design
- ✅ Cross-browser compatibility

### 3. Technical Requirements
- ✅ Docker containerization
- ✅ GraphQL API implementation
- ✅ SignalR real-time updates
- ✅ Database persistence

## Additional Technical Specifications

### 1. Program.cs Configuration
```csharp
// Backend/Program.cs
using Microsoft.EntityFrameworkCore;
using HotChocolate.AspNetCore;
using HotChocolate.AspNetCore.Playground;
using Microsoft.AspNetCore.SignalR;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddGraphQLServer()
    .AddQueryType<TaskQuery>()
    .AddMutationType<TaskMutation>()
    .AddSubscriptionType<TaskSubscription>()
    .AddType<TaskType>()
    .AddType<TaskStatusType>()
    .AddType<TaskInputType>()
    .AddInMemorySubscriptions()
    .AddProjections()
    .AddFiltering()
    .AddSorting();

builder.Services.AddSignalR();
builder.Services.AddScoped<ITaskNotificationService, TaskNotificationService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>();

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UsePlayground();
}

app.UseCors("AllowAll");
app.UseRouting();
app.UseWebSockets();
app.MapGraphQL();
app.MapHub<TaskHub>("/taskHub");
app.MapHealthChecks("/health");

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.EnsureCreated();
}

app.Run();
```

### 2. Main App Component
```typescript
// Frontend/src/App.tsx
import React, { useState, useCallback } from 'react';
import { Provider as SpectrumProvider, defaultTheme } from '@adobe/react-spectrum';
import { RelayEnvironmentProvider } from 'react-relay';
import { relayEnvironment } from './utils/relayEnvironment';
import { TaskList } from './components/TaskList';
import { AddTaskForm } from './components/AddTaskForm';
import { useTasks, useTaskMutations } from './hooks/useTasks';
import { useRealTimeTasks } from './hooks/useRealTimeTasks';
import { Task, TaskStatus } from './types/Task';

function App() {
  const { tasks, isLoading, error, refetch } = useTasks();
  const { createTask, updateTaskStatus, deleteTask, isCreating, isUpdating, isDeleting } = useTaskMutations();
  const [filter, setFilter] = useState<TaskStatus | 'ALL'>('ALL');

  const handleTaskCreated = useCallback((task: Task) => {
    refetch();
  }, [refetch]);

  const handleTaskUpdated = useCallback((task: Task) => {
    refetch();
  }, [refetch]);

  const handleTaskDeleted = useCallback((taskId: number) => {
    refetch();
  }, [refetch]);

  useRealTimeTasks({
    onTaskCreated: handleTaskCreated,
    onTaskUpdated: handleTaskUpdated,
    onTaskDeleted: handleTaskDeleted
  });

  const handleCreateTask = useCallback(async (input: { title: string; description?: string }) => {
    try {
      await createTask(input);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  }, [createTask]);

  const handleUpdateTask = useCallback(async (id: number, status: TaskStatus) => {
    try {
      await updateTaskStatus(id, status);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }, [updateTaskStatus]);

  const handleDeleteTask = useCallback(async (id: number) => {
    try {
      await deleteTask(id);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, [deleteTask]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <SpectrumProvider theme={defaultTheme}>
      <RelayEnvironmentProvider environment={relayEnvironment}>
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
          <h1>Todo List</h1>
          <AddTaskForm onSubmit={handleCreateTask} isLoading={isCreating} />
          <TaskList
            tasks={tasks}
            onTaskUpdate={handleUpdateTask}
            onTaskDelete={handleDeleteTask}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>
      </RelayEnvironmentProvider>
    </SpectrumProvider>
  );
}

export default App;
```

### 3. Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "relay": "relay-compiler --src ./src --schema ./schema.graphql --language typescript --artifactDirectory ./src/__generated__",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### 4. Relay Compiler Configuration
```json
{
  "relay": {
    "src": "./src",
    "schema": "./schema.graphql",
    "language": "typescript",
    "artifactDirectory": "./src/__generated__",
    "exclude": ["**/node_modules/**", "**/__generated__/**"]
  }
}
```

### 5. ESLint Configuration
```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["react-refresh"],
  "rules": {
    "react-refresh/only-export-components": [
      "warn",
      { "allowConstantExport": true }
    ]
  }
}
```

## Next Steps for AI Implementation

1. **Backend Setup**: Generate ASP.NET Core project with GraphQL
2. **Database Models**: Create Entity Framework models and migrations
3. **GraphQL Schema**: Implement resolvers and mutations
4. **SignalR Hub**: Add real-time functionality
5. **Frontend Setup**: Create React app with Adobe React Spectrum
6. **GraphQL Client**: Configure Relay for data fetching
7. **Docker Configuration**: Create Dockerfiles and docker-compose.yml
8. **Testing**: Implement unit and integration tests
9. **Documentation**: Generate README and API documentation
10. **Deployment**: Set up CI/CD pipeline

## AI Implementation Checklist

### Phase 1: Backend Foundation (15-20 minutes)
- [ ] Create ASP.NET Core project structure
- [ ] Set up Entity Framework with Task model
- [ ] Configure GraphQL with HotChocolate
- [ ] Implement CRUD operations
- [ ] Add SignalR hub
- [ ] Set up health checks and CORS

### Phase 2: Frontend Foundation (15-20 minutes)
- [ ] Create React app with Vite
- [ ] Install and configure Adobe React Spectrum
- [ ] Set up Relay GraphQL client
- [ ] Create basic component structure
- [ ] Implement SignalR connection
- [ ] Add TypeScript types

### Phase 3: Integration & Testing (10-15 minutes)
- [ ] Connect frontend to backend
- [ ] Test real-time updates
- [ ] Add error handling
- [ ] Implement loading states
- [ ] Test all CRUD operations

### Phase 4: Docker & Deployment (10-15 minutes)
- [ ] Create Dockerfiles
- [ ] Set up docker-compose.yml
- [ ] Test containerized deployment
- [ ] Add environment configuration
- [ ] Test health checks

This documentation provides comprehensive technical specifications that can be used with AI tools like GitHub Copilot or Cursor AI to generate the complete implementation. Each section includes specific details about technologies, configurations, and implementation patterns that will guide the AI-assisted development process.
