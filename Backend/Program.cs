using Microsoft.EntityFrameworkCore;
using HotChocolate.AspNetCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Data;
using Backend.GraphQL.Queries;
using Backend.GraphQL.Mutations;
using Backend.GraphQL.Subscriptions;
using Backend.GraphQL.Types;
using Backend.Hubs;
using Backend.Services;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// Add services
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    var environment = builder.Environment.EnvironmentName;
    
    Console.WriteLine($"Environment: {environment}");
    Console.WriteLine($"DefaultConnection: {connectionString}");
    Console.WriteLine($"SqliteConnection: {builder.Configuration.GetConnectionString("SqliteConnection")}");
    
    if (environment == "Development" || environment == "Local")
    {
        // Use SQLite for local development
        Console.WriteLine("Using SQLite for development");
        options.UseSqlite(builder.Configuration.GetConnectionString("SqliteConnection"));
    }
    else
    {
        // Use SQL Server for production
        Console.WriteLine("Using SQL Server for production");
        options.UseSqlServer(connectionString);
    }
});

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

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

// Configure JSON serialization for SignalR
builder.Services.Configure<JsonOptions>(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
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

builder.Services.AddHealthChecks();

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
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
