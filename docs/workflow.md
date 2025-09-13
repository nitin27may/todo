# 🔄 Application Workflow Diagrams

## Real-time Task Management Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as React UI
    participant GQL as GraphQL API
    participant DB as Database
    participant SR as SignalR Hub
    participant C as Other Clients

    Note over U,C: Task Creation Flow
    U->>UI: Create Task
    UI->>GQL: createTask mutation
    GQL->>DB: INSERT task
    DB-->>GQL: Task created
    GQL->>SR: NotifyTaskCreated
    GQL-->>UI: Task response
    SR->>C: TaskCreated event
    UI->>UI: Update local state
    C->>C: Add task to list

    Note over U,C: Task Status Update Flow
    U->>UI: Toggle task status
    UI->>GQL: updateTaskStatus mutation
    GQL->>DB: UPDATE task status
    DB-->>GQL: Task updated
    GQL->>SR: NotifyTaskUpdated
    GQL-->>UI: Updated task
    SR->>C: TaskUpdated event
    UI->>UI: Update checkbox & styling
    C->>C: Update task in list

    Note over U,C: Task Deletion Flow
    U->>UI: Delete task
    UI->>GQL: deleteTask mutation
    GQL->>DB: DELETE task
    DB-->>GQL: Task deleted
    GQL->>SR: NotifyTaskDeleted
    GQL-->>UI: Success response
    SR->>C: TaskDeleted event
    UI->>UI: Remove from list
    C->>C: Remove from list
```

## System Architecture Flow

```mermaid
graph TB
    subgraph "Client Layer"
        A[User Browser] --> B[React App]
        B --> C[TypeScript Components]
        C --> D[Tailwind CSS Styling]
    end
    
    subgraph "Communication Layer"
        E[GraphQL Client] --> F[HTTP Requests]
        G[SignalR Client] --> H[WebSocket Connection]
    end
    
    subgraph "Infrastructure Layer"
        I[Nginx Reverse Proxy] --> J[Load Balancing]
        J --> K[ASP.NET Core API]
    end
    
    subgraph "API Layer"
        K --> L[GraphQL Engine]
        K --> M[SignalR Hub]
        K --> N[Health Checks]
    end
    
    subgraph "Business Layer"
        L --> O[Task Queries]
        L --> P[Task Mutations]
        M --> Q[Notification Service]
        O --> R[Data Validation]
        P --> R
    end
    
    subgraph "Data Layer"
        R --> S[Entity Framework]
        S --> T[Database Context]
        T --> U[(SQLite/SQL Server)]
    end
    
    subgraph "Real-time Events"
        Q --> V[Task Created Event]
        Q --> W[Task Updated Event]
        Q --> X[Task Deleted Event]
        V --> H
        W --> H
        X --> H
    end
    
    A --> E
    A --> G
    E --> I
    G --> I
    
    style A fill:#e3f2fd
    style K fill:#f3e5f5
    style U fill:#e8f5e8
    style Q fill:#fff3e0
```

## Database Schema Flow

```mermaid
erDiagram
    TASKS {
        int id PK
        string title
        string description
        string status
        datetime createdAt
        datetime updatedAt
    }
    
    TASK_STATUS {
        string PENDING
        string COMPLETED
    }
    
    TASKS ||--|| TASK_STATUS : has
```

## Deployment Flow

```mermaid
graph LR
    subgraph "Development"
        A[Local Development] --> B[Docker Compose]
        B --> C[SQLite Database]
        B --> D[Hot Reload]
    end
    
    subgraph "Production"
        E[Production Build] --> F[Docker Compose Prod]
        F --> G[SQL Server Database]
        F --> H[Nginx Load Balancer]
    end
    
    subgraph "CI/CD Pipeline"
        I[Code Push] --> J[GitHub Actions]
        J --> K[Build & Test]
        K --> L[Docker Build]
        L --> M[Deploy to Production]
    end
    
    A --> I
    E --> M
    
    style A fill:#e1f5fe
    style E fill:#f3e5f5
    style I fill:#e8f5e8
```

## Error Handling Flow

```mermaid
graph TD
    A[User Action] --> B{Valid Input?}
    B -->|No| C[Show Validation Error]
    B -->|Yes| D[Send to API]
    D --> E{API Success?}
    E -->|No| F[Show Error Message]
    E -->|Yes| G[Update UI]
    G --> H[Send SignalR Event]
    H --> I[Update Other Clients]
    
    C --> J[User Corrects Input]
    F --> K[Retry Action]
    J --> A
    K --> A
    
    style C fill:#ffebee
    style F fill:#ffebee
    style G fill:#e8f5e8
    style I fill:#e8f5e8
```

## Performance Optimization Flow

```mermaid
graph TB
    subgraph "Frontend Optimizations"
        A[React.memo] --> B[Prevent Unnecessary Renders]
        C[useCallback] --> D[Optimize Event Handlers]
        E[useMemo] --> F[Cache Expensive Calculations]
        G[Vite Build] --> H[Code Splitting]
    end
    
    subgraph "Backend Optimizations"
        I[EF Core] --> J[Query Optimization]
        K[SignalR] --> L[Connection Pooling]
        M[GraphQL] --> N[Field Selection]
    end
    
    subgraph "Infrastructure Optimizations"
        O[Nginx] --> P[Static File Serving]
        Q[Docker] --> R[Multi-stage Builds]
        S[Database] --> T[Indexing]
    end
    
    B --> U[Faster UI Updates]
    D --> U
    F --> U
    H --> V[Faster Load Times]
    J --> W[Faster Queries]
    L --> X[Better Real-time Performance]
    N --> W
    P --> V
    R --> V
    T --> W
```
