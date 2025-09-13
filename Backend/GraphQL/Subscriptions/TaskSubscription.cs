using HotChocolate;
using HotChocolate.Types;
using Backend.Models;

namespace Backend.GraphQL.Subscriptions;

public class TaskSubscription
{
    [Subscribe]
    public System.Threading.Tasks.Task<Models.Task> OnTaskCreated([EventMessage] Models.Task task) => System.Threading.Tasks.Task.FromResult(task);

    [Subscribe]
    public System.Threading.Tasks.Task<Models.Task> OnTaskUpdated([EventMessage] Models.Task task) => System.Threading.Tasks.Task.FromResult(task);

    [Subscribe]
    public System.Threading.Tasks.Task<int> OnTaskDeleted([EventMessage] int taskId) => System.Threading.Tasks.Task.FromResult(taskId);
}
