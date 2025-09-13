using Microsoft.EntityFrameworkCore;
using HotChocolate;
using HotChocolate.Types;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.GraphQL.Mutations;

public class TaskMutation
{
    public async System.Threading.Tasks.Task<Models.Task> CreateTask(TaskInput input, [Service] ApplicationDbContext context, [Service] ITaskNotificationService notificationService)
    {
        var task = new Models.Task
        {
            Title = input.Title,
            Description = input.Description,
            Status = Models.TaskStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Tasks.Add(task);
        await context.SaveChangesAsync();
        
        // Notify all clients about the new task
        await notificationService.NotifyTaskCreated(task);
        
        return task;
    }

    public async System.Threading.Tasks.Task<Models.Task?> UpdateTaskStatus(int id, Models.TaskStatus status, [Service] ApplicationDbContext context, [Service] ITaskNotificationService notificationService)
    {
        var task = await context.Tasks.FindAsync(id);
        if (task == null) return null;

        task.Status = status;
        task.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        
        // Notify all clients about the updated task
        await notificationService.NotifyTaskUpdated(task);
        
        return task;
    }

    public async System.Threading.Tasks.Task<Models.Task?> UpdateTask(int id, TaskInput input, [Service] ApplicationDbContext context, [Service] ITaskNotificationService notificationService)
    {
        var task = await context.Tasks.FindAsync(id);
        if (task == null) return null;

        task.Title = input.Title;
        task.Description = input.Description;
        task.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        
        // Notify all clients about the updated task
        await notificationService.NotifyTaskUpdated(task);
        
        return task;
    }

    public async System.Threading.Tasks.Task<bool> DeleteTask(int id, [Service] ApplicationDbContext context, [Service] ITaskNotificationService notificationService)
    {
        var task = await context.Tasks.FindAsync(id);
        if (task == null) return false;

        context.Tasks.Remove(task);
        await context.SaveChangesAsync();
        
        // Notify all clients about the deleted task
        await notificationService.NotifyTaskDeleted(id);
        
        return true;
    }
}
