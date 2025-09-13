using Backend.Models;
using Backend.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Backend.Services;

public interface ITaskNotificationService
{
    System.Threading.Tasks.Task NotifyTaskCreated(Models.Task task);
    System.Threading.Tasks.Task NotifyTaskUpdated(Models.Task task);
    System.Threading.Tasks.Task NotifyTaskDeleted(int taskId);
}

public class TaskNotificationService : ITaskNotificationService
{
    private readonly IHubContext<TaskHub> _hubContext;

    public TaskNotificationService(IHubContext<TaskHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async System.Threading.Tasks.Task NotifyTaskCreated(Models.Task task)
    {
        var taskWithStringStatus = new
        {
            id = task.Id,
            title = task.Title,
            description = task.Description,
            status = task.Status.ToString(),
            createdAt = task.CreatedAt,
            updatedAt = task.UpdatedAt
        };
        await _hubContext.Clients.All.SendAsync("TaskCreated", taskWithStringStatus);
    }

    public async System.Threading.Tasks.Task NotifyTaskUpdated(Models.Task task)
    {
        Console.WriteLine($"Sending TaskUpdated notification for task {task.Id} with status {task.Status}");
        var taskWithStringStatus = new
        {
            id = task.Id,
            title = task.Title,
            description = task.Description,
            status = task.Status.ToString(),
            createdAt = task.CreatedAt,
            updatedAt = task.UpdatedAt
        };
        await _hubContext.Clients.All.SendAsync("TaskUpdated", taskWithStringStatus);
        Console.WriteLine($"TaskUpdated notification sent for task {task.Id}");
    }

    public async System.Threading.Tasks.Task NotifyTaskDeleted(int taskId)
    {
        await _hubContext.Clients.All.SendAsync("TaskDeleted", taskId);
    }
}
