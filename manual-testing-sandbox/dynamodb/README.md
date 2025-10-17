# DynamoDB Integration with Go (AWS SDK v2)

This example demonstrates how to integrate Amazon DynamoDB into your Go application using the AWS SDK for Go v2.

## Features

✅ **Complete CRUD Operations**

- Create (PutItem)
- Read (GetItem)
- Update (UpdateItem)
- Delete (DeleteItem)

✅ **Advanced Operations**

- Batch Write (up to 25 items)
- Query with Pagination
- Scan with Filters

✅ **Best Practices**

- Proper error handling
- Context support
- Structured logging
- Type-safe attribute handling

## Prerequisites

1. **Go 1.21+** installed
2. **AWS Account** with DynamoDB access
3. **AWS Credentials** configured (via environment variables, IAM role, or credentials file)

## Setup

### 1. Install Dependencies

```bash
cd dynamodb
go mod download
```

### 2. Create DynamoDB Table

You need a DynamoDB table named `Users` with the following schema:

**Primary Key:**

- Partition Key: `UserID` (String)

You can create it via AWS Console, CLI, or using the following AWS CLI command:

```bash
aws dynamodb create-table \
  --table-name Users \
  --attribute-definitions \
    AttributeName=UserID,AttributeType=S \
  --key-schema \
    AttributeName=UserID,KeyType=HASH \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-west-2
```

### 3. Configure AWS Credentials

**Option A: Environment Variables**

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-west-2
```

**Option B: AWS Credentials File**

```bash
~/.aws/credentials
```

**Option C: IAM Role** (if running on EC2/ECS/Lambda)

- The SDK will automatically use the instance/task role

## Usage

### Run the Example

```bash
go run main.go
```

### Expected Output

```
✅ User inserted successfully
✅ Retrieved user: &{UserID:user123 Name:John Doe Email:john@example.com Age:30 Active:true}
✅ User updated successfully
✅ Found X active users
✅ Batch insert successful
✅ User deleted successfully
```

## Code Examples

### Initialize Client

```go
dbClient, err := NewDynamoDBClient("us-west-2", "Users")
if err != nil {
    log.Fatal(err)
}
```

### Put Item

```go
user := User{
    UserID: "user123",
    Name:   "John Doe",
    Email:  "john@example.com",
    Age:    30,
    Active: true,
}

err := dbClient.PutUser(ctx, user)
```

### Get Item

```go
user, err := dbClient.GetUser(ctx, "user123")
if err != nil {
    log.Fatal(err)
}
fmt.Printf("User: %+v\n", user)
```

### Update Item

```go
err := dbClient.UpdateUser(ctx, "user123", "newemail@example.com", 31)
```

### Delete Item

```go
err := dbClient.DeleteUser(ctx, "user123")
```

### Batch Insert

```go
users := []User{
    {UserID: "user001", Name: "Alice", Email: "alice@example.com", Age: 25, Active: true},
    {UserID: "user002", Name: "Bob", Email: "bob@example.com", Age: 28, Active: true},
}

err := dbClient.BatchPutUsers(ctx, users)
```

### Query with Pagination

```go
activeUsers, err := dbClient.QueryActiveUsers(ctx)
```

## AWS SDK v2 Best Practices

### ✅ Use IAM Roles Instead of Hardcoded Credentials

```go
// The SDK automatically uses IAM roles when available
cfg, err := config.LoadDefaultConfig(context.TODO(),
    config.WithRegion("us-west-2"),
)
```

### ✅ Implement Retry Logic with Exponential Backoff

```go
import "github.com/aws/aws-sdk-go-v2/aws/retry"

cfg, err := config.LoadDefaultConfig(context.TODO(),
    config.WithRetryer(func() aws.Retryer {
        return retry.AddWithMaxAttempts(retry.NewStandard(), 5)
    }),
)
```

### ✅ Handle Pagination Properly

```go
paginator := dynamodb.NewScanPaginator(client, input)

for paginator.HasMorePages() {
    page, err := paginator.NextPage(ctx)
    // ... process page
}
```

### ✅ Use Context for Timeouts

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := client.GetItem(ctx, input)
```

### ✅ Batch Operations for Bulk Inserts/Deletes

```go
// Process in batches of 25 (DynamoDB limit)
for i := 0; i < len(items); i += 25 {
    batch := items[i:min(i+25, len(items))]
    // ... batch write
}
```

## Common Errors and Solutions

### Error: `ResourceNotFoundException`

**Solution:** Create the DynamoDB table first (see Setup section)

### Error: `ValidationException: One or more parameter values were invalid`

**Solution:** Check that your attribute types match the table schema

### Error: `ProvisionedThroughputExceededException`

**Solution:**

- Implement exponential backoff retry
- Consider using On-Demand billing mode
- Increase provisioned capacity

### Error: `UnrecognizedClientException`

**Solution:** Verify AWS credentials are properly configured

## Performance Optimization

### 1. **Use Batch Operations**

```go
// ✅ Good: Batch write 25 items at once
BatchWriteItem()

// ❌ Bad: 25 individual PutItem calls
```

### 2. **Enable Connection Pooling**

```go
import awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"

cfg, err := config.LoadDefaultConfig(context.TODO(),
    config.WithHTTPClient(awshttp.NewBuildableClient().
        WithTransportOptions(func(tr *http.Transport) {
            tr.MaxIdleConns = 100
            tr.IdleConnTimeout = 90 * time.Second
        }),
    ),
)
```

### 3. **Use Query Instead of Scan**

```go
// ✅ Good: Query with partition key
QueryInput{KeyConditionExpression: "UserID = :id"}

// ❌ Bad: Scan entire table
ScanInput{FilterExpression: "UserID = :id"}
```

## Security Best Practices

1. **Never hardcode credentials** - Use IAM roles, environment variables, or AWS SSM Parameter Store
2. **Enable encryption at rest** - Use AWS KMS for sensitive data
3. **Use VPC endpoints** - Keep traffic within AWS network
4. **Implement least privilege IAM policies**
5. **Enable CloudTrail logging** for audit trails

## Cost Optimization

1. **Use On-Demand pricing** for unpredictable workloads
2. **Enable Auto Scaling** for provisioned capacity
3. **Use Time to Live (TTL)** to automatically delete expired items
4. **Optimize queries** to reduce read/write capacity units

## Additional Resources

- [AWS SDK for Go v2 Documentation](https://aws.github.io/aws-sdk-go-v2/docs/)
- [DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

## License

MIT License - Feel free to use this code in your projects!
