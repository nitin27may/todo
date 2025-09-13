using Microsoft.EntityFrameworkCore;
using HotChocolate;
using HotChocolate.Types;
using Backend.Data;
using Backend.Models;

namespace Backend.GraphQL.Queries;

public class TaskQuery
{
    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetAllTasks([Service] ApplicationDbContext context)
    {
        return await context.Tasks
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<Models.Task?> GetTaskById(int id, [Service] ApplicationDbContext context)
    {
        return await context.Tasks.FindAsync(id);
    }
}
