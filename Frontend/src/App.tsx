import React, { useState, useCallback, useEffect } from 'react';
import { Task, TaskStatus } from './types/Task';
import * as signalR from '@microsoft/signalr';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<number>>(new Set());

  // Show success message
  const showSuccess = (message: string) => {
    setShowSuccessMessage(message);
    setTimeout(() => setShowSuccessMessage(null), 3000);
  };

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              allTasks {
                id
                title
                description
                status
                createdAt
                updatedAt
              }
            }
          `,
        }),
      });

      const result = await response.json();
      if (result.data) {
        setTasks(result.data.allTasks);
      } else {
        setError('Failed to fetch tasks');
      }
    } catch (err) {
      setError('Failed to fetch tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create task
  const createTask = useCallback(async (input: { title: string; description?: string }) => {
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation CreateTask($input: TaskInput!) {
              createTask(input: $input) {
                id
                title
                description
                status
                createdAt
                updatedAt
              }
            }
          `,
          variables: { input },
        }),
      });

      const result = await response.json();
      if (result.data) {
        setNewTaskTitle('');
        setNewTaskDescription('');
        showSuccess('Task created successfully!');
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  }, []);

  // Update task status
  const updateTaskStatus = useCallback(async (id: number, status: TaskStatus) => {
    console.log('Updating task status:', { id, status });
    setIsUpdating(id);
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation UpdateTaskStatus($id: Int!, $status: TaskStatus!) {
              updateTaskStatus(id: $id, status: $status) {
                id
                title
                description
                status
                createdAt
                updatedAt
              }
            }
          `,
          variables: { id, status },
        }),
      });

      const result = await response.json();
      console.log('Update task status response:', result);
      if (result.data) {
        const statusText = status === TaskStatus.COMPLETED ? 'completed' : 'marked as pending';
        showSuccess(`Task ${statusText}!`);
      } else if (result.errors) {
        console.error('GraphQL errors:', result.errors);
      }
    } catch (err) {
      console.error('Error updating task:', err);
    } finally {
      setIsUpdating(null);
    }
  }, []);

  // Update task
  const updateTask = useCallback(async (id: number, input: { title: string; description?: string }) => {
    setIsUpdating(id);
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation UpdateTask($id: Int!, $input: TaskInput!) {
              updateTask(id: $id, input: $input) {
                id
                title
                description
                status
                createdAt
                updatedAt
              }
            }
          `,
          variables: { id, input },
        }),
      });

      const result = await response.json();
      if (result.data) {
        setEditingTask(null);
        setEditTitle('');
        setEditDescription('');
        showSuccess('Task updated successfully!');
      }
    } catch (err) {
      console.error('Error updating task:', err);
    } finally {
      setIsUpdating(null);
    }
  }, []);

  // Delete task
  const deleteTask = useCallback(async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    setIsUpdating(id);
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation DeleteTask($id: Int!) {
              deleteTask(id: $id)
            }
          `,
          variables: { id },
        }),
      });

      const result = await response.json();
      if (result.data?.deleteTask) {
        showSuccess('Task deleted successfully!');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    } finally {
      setIsUpdating(null);
    }
  }, []);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      createTask({
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
      });
    }
  };

  // Handle edit form submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask && editTitle.trim()) {
      updateTask(editingTask.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
    }
  };

  // Start editing a task
  const startEditing = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingTask(null);
    setEditTitle('');
    setEditDescription('');
  };

  // Setup SignalR connection
  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl('/taskHub')
      .withAutomaticReconnect()
      .build();

    newConnection.start()
      .then(() => {
        console.log('SignalR Connected');
      })
      .catch((err) => console.error('SignalR Connection Error: ', err));

    // Listen for real-time updates
    newConnection.on('TaskCreated', (task: any) => {
      console.log('Task created:', task);
      // Convert string status to TaskStatus enum
      const normalizedTask: Task = {
        ...task,
        status: task.status === "Completed" ? TaskStatus.COMPLETED : TaskStatus.PENDING
      };
      setTasks(prev => {
        // Check if task already exists to avoid duplicates
        const exists = prev.some(t => t.id === normalizedTask.id);
        if (exists) return prev;
        return [normalizedTask, ...prev];
      });
    });

    newConnection.on('TaskUpdated', (task: any) => {
      console.log('SignalR TaskUpdated received:', task);
      console.log('Task status in SignalR update:', task.status, 'Type:', typeof task.status);
      
      // Convert string status to TaskStatus enum
      const normalizedTask: Task = {
        ...task,
        status: task.status === "Completed" ? TaskStatus.COMPLETED : TaskStatus.PENDING
      };
      console.log('Normalized task status:', normalizedTask.status);
      
      setTasks(prev => {
        const updated = prev.map(t => {
          if (t.id === normalizedTask.id) {
            console.log('Updating task in state:', { old: t, new: normalizedTask });
            console.log('Old status:', t.status, 'New status:', normalizedTask.status);
            
            // Add to recently updated set for visual feedback
            setRecentlyUpdated(prev => new Set(prev).add(normalizedTask.id));
            setTimeout(() => {
              setRecentlyUpdated(prev => {
                const newSet = new Set(prev);
                newSet.delete(normalizedTask.id);
                return newSet;
              });
            }, 2000);
            
            // Force a new object to ensure React detects the change
            return { ...normalizedTask };
          }
          return t;
        });
        console.log('Updated tasks state after SignalR update:', updated);
        return updated;
      });
      // If we're editing this task, update the edit form
      if (editingTask && editingTask.id === normalizedTask.id) {
        setEditTitle(normalizedTask.title);
        setEditDescription(normalizedTask.description || '');
      }
    });

    newConnection.on('TaskDeleted', (taskId: number) => {
      console.log('Task deleted:', taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      // If we're editing the deleted task, cancel editing
      if (editingTask && editingTask.id === taskId) {
        cancelEditing();
      }
    });

    return () => {
      newConnection.stop();
    };
  }, []);

  // Filter tasks
  const filteredTasks = filter === 'ALL' 
    ? tasks 
    : tasks.filter(task => task.status === filter);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-up">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {showSuccessMessage}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Todo List</h1>
              <p className="text-gray-600 mt-1">Stay organized and productive</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live updates</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Add Task Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Task</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <textarea
                placeholder="Add a description (optional)..."
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="input-field min-h-[100px] resize-none"
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="btn-primary"
                disabled={!newTaskTitle.trim()}
              >
                <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Task
              </button>
            </div>
          </form>
        </div>

        {/* Filter and Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center space-x-4 mb-4 sm:mb-0">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filter === 'ALL'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Tasks
              </button>
              <button
                onClick={() => setFilter(TaskStatus.PENDING)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filter === TaskStatus.PENDING
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilter(TaskStatus.COMPLETED)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filter === TaskStatus.COMPLETED
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Completed
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{filteredTasks.length}</span> task{filteredTasks.length !== 1 ? 's' : ''}
            {filter === 'ALL' && (
              <span className="ml-2">
                ({tasks.filter(t => t.status === TaskStatus.PENDING).length} pending, {tasks.filter(t => t.status === TaskStatus.COMPLETED).length} completed)
              </span>
            )}
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
              <p className="text-gray-600">
                {filter === 'ALL' 
                  ? "Get started by adding your first task above."
                  : `No ${filter.toLowerCase()} tasks at the moment.`
                }
              </p>
            </div>
          ) : (
            filteredTasks.map((task, index) => (
              <div
                key={`${task.id}-${task.status}-${task.updatedAt}`}
                className={`task-card animate-slide-up ${
                  task.status === TaskStatus.COMPLETED ? 'task-card-completed' : ''
                } ${isUpdating === task.id ? 'opacity-50' : ''} ${
                  recentlyUpdated.has(task.id) ? 'ring-2 ring-green-500 bg-green-50' : ''
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {editingTask && editingTask.id === task.id ? (
                  // Edit Mode
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="input-field min-h-[80px] resize-none"
                        rows={2}
                        placeholder="Add a description (optional)..."
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="btn-secondary"
                        disabled={isUpdating === task.id}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={!editTitle.trim() || isUpdating === task.id}
                      >
                        {isUpdating === task.id ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  // View Mode
                  <div className="flex items-start space-x-4">
                    <button
                      onClick={() => {
                        console.log('Current task status:', task.status, 'Type:', typeof task.status);
                        console.log('TaskStatus.PENDING:', TaskStatus.PENDING);
                        console.log('TaskStatus.COMPLETED:', TaskStatus.COMPLETED);
                        console.log('String comparison - task.status === TaskStatus.PENDING:', task.status === TaskStatus.PENDING);
                        console.log('String comparison - task.status === "PENDING":', task.status === "PENDING");
                        
                        // Use enum comparison since we normalize status in SignalR handlers
                        const newStatus = task.status === TaskStatus.PENDING 
                          ? TaskStatus.COMPLETED 
                          : TaskStatus.PENDING;
                        
                        console.log('New status will be:', newStatus);
                        
                        // Send the update to the server - SignalR will handle UI update
                        updateTaskStatus(task.id, newStatus);
                      }}
                      disabled={isUpdating === task.id}
                      className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        task.status === TaskStatus.COMPLETED
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-primary-500'
                      } ${isUpdating === task.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {task.status === TaskStatus.COMPLETED && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-lg font-medium ${
                        task.status === TaskStatus.COMPLETED
                          ? 'text-gray-500 line-through' 
                          : 'text-gray-900'
                      }`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className={`mt-1 ${
                          task.status === TaskStatus.COMPLETED
                            ? 'text-gray-400 line-through' 
                            : 'text-gray-600'
                        }`}>
                          {task.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center text-xs text-gray-500 space-x-4">
                        <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                        <span>Updated: {new Date(task.updatedAt).toLocaleDateString()}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.status === TaskStatus.COMPLETED
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {task.status === TaskStatus.COMPLETED ? 'Completed' : 'Pending'}
                        </span>
                        {isUpdating === task.id && (
                          <span className="text-primary-600 font-medium">Updating...</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => startEditing(task)}
                        className="btn-secondary text-sm py-1 px-3"
                        disabled={isUpdating === task.id}
                        title="Edit task"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="btn-danger text-sm py-1 px-3"
                        disabled={isUpdating === task.id}
                        title="Delete task"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default App;