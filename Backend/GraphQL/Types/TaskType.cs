using HotChocolate;
using HotChocolate.Types;
using Backend.Models;

namespace Backend.GraphQL.Types;

public class TaskType : ObjectType<Models.Task>
{
    protected override void Configure(IObjectTypeDescriptor<Models.Task> descriptor)
    {
        descriptor.Field(t => t.Id).Type<NonNullType<IntType>>();
        descriptor.Field(t => t.Title).Type<NonNullType<StringType>>();
        descriptor.Field(t => t.Description).Type<StringType>();
        descriptor.Field(t => t.Status).Type<NonNullType<TaskStatusType>>();
        descriptor.Field(t => t.CreatedAt).Type<NonNullType<DateTimeType>>();
        descriptor.Field(t => t.UpdatedAt).Type<NonNullType<DateTimeType>>();
    }
}

public class TaskStatusType : EnumType<Models.TaskStatus>
{
    protected override void Configure(IEnumTypeDescriptor<Models.TaskStatus> descriptor)
    {
        descriptor.Value(Models.TaskStatus.Pending).Name("PENDING");
        descriptor.Value(Models.TaskStatus.Completed).Name("COMPLETED");
    }
}

public class TaskInputType : InputObjectType<TaskInput>
{
    protected override void Configure(IInputObjectTypeDescriptor<TaskInput> descriptor)
    {
        descriptor.Field(t => t.Title).Type<NonNullType<StringType>>();
        descriptor.Field(t => t.Description).Type<StringType>();
    }
}
