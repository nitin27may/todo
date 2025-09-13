# 🚀 Complete Setup Guide

This guide will walk you through setting up the Todo List Application from scratch.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Docker** (v20.10+) - [Download here](https://www.docker.com/get-started)
- **Docker Compose** (v2.0+) - Usually included with Docker Desktop
- **Git** - [Download here](https://git-scm.com/downloads)

### Optional (for local development)
- **Node.js** (v18+) - [Download here](https://nodejs.org/)
- **.NET 8.0 SDK** - [Download here](https://dotnet.microsoft.com/download)

## 🏗️ Installation Steps

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone <your-repo-url>
cd todo

# Verify the structure
ls -la
```

You should see:
```
todo/
├── Backend/
├── Frontend/
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

### Step 2: Environment Setup

#### For Development (SQLite)
No additional setup required! The application will use SQLite by default.

#### For Production (SQL Server)
Create a `.env` file in the root directory:

```bash
# Create environment file
touch .env
```

Add the following content:
```env
# Database Configuration
SA_PASSWORD=YourStrong@Passw0rd123!
ACCEPT_EULA=Y

# Application Configuration
ASPNETCORE_ENVIRONMENT=Production
```

### Step 3: Start the Application

#### Option A: Development Mode (Recommended for first-time users)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

#### Option B: Production Mode

```bash
# Start with SQL Server
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 4: Verify Installation

1. **Check if all containers are running:**
   ```bash
   docker-compose ps
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001
   - GraphQL Playground: http://localhost:5001/graphql/playground
   - Health Check: http://localhost:5001/health

3. **Test the application:**
   - Create a new task
   - Toggle task status
   - Open multiple browser tabs to see real-time sync
   - Edit existing tasks

## 🔧 Configuration Options

### Database Configuration

#### SQLite (Development)
- **File**: `todo.db` (created automatically)
- **Location**: `/app/data/todo.db` in container
- **Backup**: Copy the file from the container

#### SQL Server (Production)
- **Server**: `db` (container name)
- **Database**: `TodoDb`
- **Port**: `1433`
- **Username**: `sa`
- **Password**: Set in environment variables

### Port Configuration

Default ports can be changed in `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "3000:80"  # Change 3000 to your preferred port
  backend:
    ports:
      - "5001:80"  # Change 5001 to your preferred port
```

### Environment Variables

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| `ASPNETCORE_ENVIRONMENT` | Development | Production | .NET environment |
| `ConnectionStrings__DefaultConnection` | SQLite path | SQL Server connection | Database connection string |
| `SA_PASSWORD` | - | Required | SQL Server password |
| `ACCEPT_EULA` | - | Y | SQL Server license acceptance |

## 🐛 Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use
```bash
# Error: ports are not available
# Solution: Change ports in docker-compose.yml
```

#### 2. Database Connection Failed
```bash
# Check if database container is running
docker-compose ps

# Restart database
docker-compose restart db
```

#### 3. Frontend Not Loading
```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose build frontend
```

#### 4. SignalR Connection Issues
```bash
# Check backend logs
docker-compose logs backend

# Verify WebSocket support in browser
# Open browser console and check for WebSocket errors
```

#### 5. Permission Issues (Linux/Mac)
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
```

### Debug Mode

Enable debug logging:

```bash
# Start with debug configuration
docker-compose -f docker-compose.yml -f docker-compose.debug.yml up
```

### Reset Everything

If you encounter persistent issues:

```bash
# Stop all containers
docker-compose down

# Remove all containers and volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
docker-compose up -d
```

## 🔍 Monitoring and Logs

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Health Checks
```bash
# Check application health
curl http://localhost:5001/health

# Check database connectivity
curl http://localhost:5001/health/db
```

### Performance Monitoring
```bash
# Container resource usage
docker stats

# Container details
docker-compose ps
```

## 🚀 Advanced Setup

### Local Development Setup

If you prefer to run without Docker:

#### Backend Setup
```bash
cd Backend

# Install dependencies
dotnet restore

# Run database migrations
dotnet ef database update

# Start the application
dotnet run
```

#### Frontend Setup
```bash
cd Frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Custom Configuration

#### Custom Database
1. Update connection string in `appsettings.json`
2. Update `docker-compose.yml` if needed
3. Run migrations: `dotnet ef database update`

#### Custom Domain
1. Update Nginx configuration
2. Update CORS settings in `Program.cs`
3. Update frontend API URLs

## 📊 Performance Tuning

### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX IX_Tasks_Status ON Tasks(Status);
CREATE INDEX IX_Tasks_CreatedAt ON Tasks(CreatedAt);
```

### Docker Optimization
```yaml
# Use multi-stage builds
# Optimize image sizes
# Use .dockerignore files
```

### Frontend Optimization
```bash
# Enable production build
npm run build

# Analyze bundle size
npm run build -- --analyze
```

## 🔒 Security Considerations

### Production Security
1. Change default passwords
2. Use HTTPS in production
3. Configure proper CORS policies
4. Enable database encryption
5. Use environment variables for secrets

### Development Security
1. Don't commit `.env` files
2. Use strong passwords
3. Keep dependencies updated
4. Use `.gitignore` properly

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [ASP.NET Core Documentation](https://docs.microsoft.com/en-us/aspnet/core/)
- [React Documentation](https://reactjs.org/docs/)
- [GraphQL Documentation](https://graphql.org/learn/)
- [SignalR Documentation](https://docs.microsoft.com/en-us/aspnet/core/signalr/)

## 🤝 Getting Help

If you encounter issues:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review the logs: `docker-compose logs -f`
3. Check the [GitHub Issues](https://github.com/your-repo/issues)
4. Create a new issue with:
   - Your operating system
   - Docker version
   - Error messages
   - Steps to reproduce

---

**Happy Coding! 🎉**

For more information, see the main [README.md](../README.md) file.
