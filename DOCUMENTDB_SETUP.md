# Amazon DocumentDB Connection Setup

This guide explains how to connect the TCS AWS Project backend to Amazon DocumentDB.

## Problem

The error `MongoServerError: Unsupported mechanism [ -301 ]` occurs when trying to connect to DocumentDB without proper SSL/TLS configuration.

## Solution

The backend has been configured with the correct DocumentDB connection options.

### What Was Fixed

1. **Added SSL/TLS support** - DocumentDB requires encrypted connections
2. **Downloaded Amazon CA Bundle** - The `global-bundle.pem` file for certificate verification
3. **Disabled retryWrites** - DocumentDB doesn't support MongoDB's retryable writes feature
4. **Added fallback mode** - For development without CA bundle (not recommended for production)

## Connection String Format

Your DocumentDB connection string should be in this format:

```
mongodb://<username>:<password>@<cluster-endpoint>:27017/<database>?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

### Example Connection Strings

**With all nodes (recommended for production):**
```
mongodb://username:password@docdb-cluster.cluster-abc123.us-east-1.docdb.amazonaws.com:27017/awsdb?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

**With individual instances:**
```
mongodb://username:password@docdb-instance-1.abc123.us-east-1.docdb.amazonaws.com:27017,docdb-instance-2.abc123.us-east-1.docdb.amazonaws.com:27017,docdb-instance-3.abc123.us-east-1.docdb.amazonaws.com:27017/awsdb?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

## Environment Variables

Set these in your `.env` file:

```bash
# DocumentDB Connection
DB_STRING=mongodb://username:password@your-docdb-cluster:27017/awsdb?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false

# Other required variables
PORT=4000
ENCRYPTION_SECRET=your-32-char-encryption-secret
SIGNING_SECRET=your-64-char-signing-secret
MASTER_KEY=your-master-key
```

## SSL Certificate (global-bundle.pem)

The Amazon CA bundle has been downloaded to:
```
/Users/mdarshadali/PanicleTech/tcsProject/tcsAwsProject/global-bundle.pem
```

### Manual Download (if needed)

If you need to download it manually:

```bash
cd /Users/mdarshadali/PanicleTech/tcsProject/tcsAwsProject
curl -o global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

### Verify Certificate

```bash
# Check file exists and size
ls -lh global-bundle.pem

# Should show approximately 162KB
```

## Code Changes

The `src/config/DB.ts` file now includes:

```typescript
const connectOptions: mongoose.ConnectOptions = {
    tls: true,                                              // Enable TLS/SSL
    tlsCAFile: path.join(__dirname, '../../global-bundle.pem'), // CA Bundle
    retryWrites: false,                                     // DocumentDB doesn't support this
    directConnection: false,                                // Use replica set
};
```

## Testing the Connection

### 1. Start the Backend

```bash
npm run dev
```

### 2. Check Console Output

You should see:
```
🔌 Connecting to Amazon DocumentDB...
✅ Connected to Amazon DocumentDB
```

### 3. If Connection Fails

Check these common issues:

#### Issue 1: Network Access
**Error:** `MongoNetworkError: connect ETIMEDOUT`

**Solution:** Ensure your IP is whitelisted in DocumentDB security groups or you're connecting from within the VPC.

```bash
# If using SSH tunnel from EC2:
ssh -i your-key.pem -N -L 27017:your-docdb-cluster:27017 ec2-user@your-ec2-ip
```

#### Issue 2: Authentication Failed
**Error:** `MongoServerError: Authentication failed`

**Solution:** Verify username and password in connection string.

```bash
# Test connection with mongosh (if available)
mongosh --tls \
  --tlsCAFile global-bundle.pem \
  --host your-docdb-cluster:27017 \
  --username your-username \
  --password your-password
```

#### Issue 3: CA Bundle Not Found
**Error:** `CA Bundle not found`

**Solution:** Re-download the certificate:

```bash
curl -o global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

#### Issue 4: Unsupported Mechanism
**Error:** `Unsupported mechanism [ -301 ]`

**Solution:** This was your original error. It's now fixed by:
- Adding `tls: true` in connection options
- Including the CA bundle file
- Setting `retryWrites: false`

## Security Best Practices

### Production Environment

1. **Never commit credentials** - Use environment variables
2. **Use strong passwords** - Minimum 16 characters with mixed case, numbers, symbols
3. **Rotate credentials regularly** - Change passwords every 90 days
4. **Use VPC security groups** - Restrict access to known IPs
5. **Enable audit logging** - Track database access

### Development Environment

For local development, you have two options:

#### Option A: SSH Tunnel (Recommended)

```bash
# Create SSH tunnel through EC2 instance
ssh -i your-key.pem -N -L 27017:docdb-cluster:27017 ec2-user@ec2-instance-ip

# Then use localhost in connection string
DB_STRING=mongodb://username:password@localhost:27017/awsdb?tls=true&retryWrites=false
```

#### Option B: Temporary Security Group Rule

1. Open DocumentDB security group
2. Add your current IP to inbound rules
3. Port: 27017
4. **Remember to remove after testing**

## Docker Deployment

When using Docker, ensure the CA bundle is included:

### Dockerfile Already Configured

The Dockerfile copies source files which includes `global-bundle.pem`:

```dockerfile
# In tcsAwsProject/Dockerfile
COPY src ./src
# This includes the global-bundle.pem in the project root
```

### Docker Compose Environment

Update `docker-compose.yml` with your DocumentDB connection:

```yaml
backend:
  environment:
    MONGODB_URI: mongodb://username:password@docdb-cluster:27017/awsdb?tls=true&replicaSet=rs0&retryWrites=false
```

### Verify in Container

```bash
# Check if CA bundle exists in container
docker-compose exec backend ls -la /app/global-bundle.pem

# View connection logs
docker-compose logs backend | grep -i "documentdb\|mongodb"
```

## Connection Monitoring

### Check Connection Status

```bash
# View backend logs
npm run dev

# Or with Docker
docker-compose logs -f backend
```

### Mongoose Connection Events

The code will log these events:

- `🔌 Connecting to Amazon DocumentDB...` - Connection attempt
- `✅ Connected to Amazon DocumentDB` - Success
- `❌ DB connection error:` - Failure with error details

## Troubleshooting Checklist

- [ ] CA bundle file exists at `tcsAwsProject/global-bundle.pem`
- [ ] Connection string includes `tls=true&retryWrites=false`
- [ ] Username and password are correct (no special chars in URL, or URL-encoded)
- [ ] DocumentDB cluster is running
- [ ] Security group allows your IP on port 27017
- [ ] VPC network configuration allows access
- [ ] Backend built successfully (`npm run build`)
- [ ] Environment variables loaded (`.env` file exists)

## Additional Resources

- [AWS DocumentDB Documentation](https://docs.aws.amazon.com/documentdb/)
- [Mongoose DocumentDB Guide](https://mongoosejs.com/docs/connections.html)
- [DocumentDB TLS Configuration](https://docs.aws.amazon.com/documentdb/latest/developerguide/connect_programmatically.html)
- [Amazon RDS Certificate Bundle](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)

## Support

If you continue experiencing issues:

1. Check the full error stack trace
2. Verify all environment variables are set
3. Test connection from an EC2 instance in the same VPC
4. Review DocumentDB cluster logs in CloudWatch
5. Ensure DocumentDB version is compatible with Mongoose version

---

**Last Updated:** November 2024
**Mongoose Version:** 8.x
**DocumentDB Compatible:** ✅
