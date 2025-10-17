package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// User represents a user entity
type User struct {
	UserID string
	Name   string
	Email  string
	Age    int
	Active bool
}

// DynamoDBClient wraps the DynamoDB service client
type DynamoDBClient struct {
	client    *dynamodb.Client
	tableName string
}

// RetryConfig holds retry configuration options
type RetryConfig struct {
	MaxAttempts     int
	MaxBackoffDelay time.Duration
	Mode            aws.RetryMode // "standard", "adaptive"
}

// DefaultRetryConfig returns the default retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:     5,                // Retry up to 5 times (default is 3)
		MaxBackoffDelay: 20 * time.Second, // Max wait between retries
		Mode:            aws.RetryModeStandard,
	}
}

// AdaptiveRetryConfig returns adaptive retry configuration
// Adaptive mode uses machine learning to adjust retry behavior based on success rates
func AdaptiveRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:     5,
		MaxBackoffDelay: 20 * time.Second,
		Mode:            aws.RetryModeAdaptive,
	}
}

// NewDynamoDBClient creates a new DynamoDB client with default retry configuration
func NewDynamoDBClient(region, tableName string) (*DynamoDBClient, error) {
	return NewDynamoDBClientWithRetry(region, tableName, DefaultRetryConfig())
}

// NewDynamoDBClientWithRetry creates a new DynamoDB client with custom retry configuration
func NewDynamoDBClientWithRetry(region, tableName string, retryConfig RetryConfig) (*DynamoDBClient, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
		// Set retry mode (standard or adaptive)
		config.WithRetryMode(retryConfig.Mode),
		// Configure custom retry behavior
		config.WithRetryer(func() aws.Retryer {
			// Start with the appropriate retry mode
			var baseRetryer aws.Retryer
			if retryConfig.Mode == aws.RetryModeAdaptive {
				baseRetryer = retry.NewAdaptiveMode()
			} else {
				baseRetryer = retry.NewStandard()
			}

			// Add max attempts
			withMaxAttempts := retry.AddWithMaxAttempts(baseRetryer, retryConfig.MaxAttempts)

			// Add max backoff delay
			withBackoff := retry.AddWithMaxBackoffDelay(
				withMaxAttempts,
				retryConfig.MaxBackoffDelay,
			)

			// Add custom retryable error codes specific to DynamoDB
			return retry.AddWithErrorCodes(
				withBackoff,
				"ProvisionedThroughputExceededException",
				"ThrottlingException",
				"RequestLimitExceeded",
			)
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to load SDK config: %w", err)
	}

	client := dynamodb.NewFromConfig(cfg)

	log.Printf("✅ DynamoDB client initialized with retry config: MaxAttempts=%d, MaxBackoff=%v, Mode=%s",
		retryConfig.MaxAttempts, retryConfig.MaxBackoffDelay, retryConfig.Mode)

	return &DynamoDBClient{
		client:    client,
		tableName: tableName,
	}, nil
}

// PutUser inserts or updates a user in DynamoDB
func (db *DynamoDBClient) PutUser(ctx context.Context, user User) error {
	_, err := db.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(db.tableName),
		Item: map[string]types.AttributeValue{
			"UserID": &types.AttributeValueMemberS{Value: user.UserID},
			"Name":   &types.AttributeValueMemberS{Value: user.Name},
			"Email":  &types.AttributeValueMemberS{Value: user.Email},
			"Age":    &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", user.Age)},
			"Active": &types.AttributeValueMemberBOOL{Value: user.Active},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to put item: %w", err)
	}

	return nil
}

// GetUser retrieves a user by ID from DynamoDB
func (db *DynamoDBClient) GetUser(ctx context.Context, userID string) (*User, error) {
	result, err := db.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(db.tableName),
		Key: map[string]types.AttributeValue{
			"UserID": &types.AttributeValueMemberS{Value: userID},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get item: %w", err)
	}

	if result.Item == nil {
		return nil, fmt.Errorf("user not found")
	}

	// Parse the response
	user := &User{
		UserID: result.Item["UserID"].(*types.AttributeValueMemberS).Value,
		Name:   result.Item["Name"].(*types.AttributeValueMemberS).Value,
		Email:  result.Item["Email"].(*types.AttributeValueMemberS).Value,
	}

	// Parse age (number)
	if ageAttr, ok := result.Item["Age"].(*types.AttributeValueMemberN); ok {
		fmt.Sscanf(ageAttr.Value, "%d", &user.Age)
	}

	// Parse active (boolean)
	if activeAttr, ok := result.Item["Active"].(*types.AttributeValueMemberBOOL); ok {
		user.Active = activeAttr.Value
	}

	return user, nil
}

// UpdateUser updates specific attributes of a user
func (db *DynamoDBClient) UpdateUser(ctx context.Context, userID, email string, age int) error {
	_, err := db.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(db.tableName),
		Key: map[string]types.AttributeValue{
			"UserID": &types.AttributeValueMemberS{Value: userID},
		},
		UpdateExpression: aws.String("SET Email = :email, Age = :age"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":email": &types.AttributeValueMemberS{Value: email},
			":age":   &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", age)},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to update item: %w", err)
	}

	return nil
}

// DeleteUser removes a user from DynamoDB
func (db *DynamoDBClient) DeleteUser(ctx context.Context, userID string) error {
	_, err := db.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(db.tableName),
		Key: map[string]types.AttributeValue{
			"UserID": &types.AttributeValueMemberS{Value: userID},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to delete item: %w", err)
	}

	return nil
}

// QueryActiveUsers queries all active users with pagination
func (db *DynamoDBClient) QueryActiveUsers(ctx context.Context) ([]User, error) {
	// Note: This requires a Global Secondary Index (GSI) on 'Active' attribute
	// For demonstration, we'll use Scan with filter (not recommended for production)

	input := &dynamodb.ScanInput{
		TableName:        aws.String(db.tableName),
		FilterExpression: aws.String("Active = :active"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":active": &types.AttributeValueMemberBOOL{Value: true},
		},
	}

	paginator := dynamodb.NewScanPaginator(db.client, input)

	var users []User
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get page: %w", err)
		}

		for _, item := range page.Items {
			user := User{
				UserID: item["UserID"].(*types.AttributeValueMemberS).Value,
				Name:   item["Name"].(*types.AttributeValueMemberS).Value,
				Email:  item["Email"].(*types.AttributeValueMemberS).Value,
			}

			if ageAttr, ok := item["Age"].(*types.AttributeValueMemberN); ok {
				fmt.Sscanf(ageAttr.Value, "%d", &user.Age)
			}

			if activeAttr, ok := item["Active"].(*types.AttributeValueMemberBOOL); ok {
				user.Active = activeAttr.Value
			}

			users = append(users, user)
		}
	}

	return users, nil
}

// BatchPutUsers inserts multiple users in a single batch operation
func (db *DynamoDBClient) BatchPutUsers(ctx context.Context, users []User) error {
	// DynamoDB allows max 25 items per batch write
	batchSize := 25

	for i := 0; i < len(users); i += batchSize {
		end := i + batchSize
		if end > len(users) {
			end = len(users)
		}

		batch := users[i:end]
		writeRequests := make([]types.WriteRequest, len(batch))

		for j, user := range batch {
			writeRequests[j] = types.WriteRequest{
				PutRequest: &types.PutRequest{
					Item: map[string]types.AttributeValue{
						"UserID": &types.AttributeValueMemberS{Value: user.UserID},
						"Name":   &types.AttributeValueMemberS{Value: user.Name},
						"Email":  &types.AttributeValueMemberS{Value: user.Email},
						"Age":    &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", user.Age)},
						"Active": &types.AttributeValueMemberBOOL{Value: user.Active},
					},
				},
			}
		}

		_, err := db.client.BatchWriteItem(ctx, &dynamodb.BatchWriteItemInput{
			RequestItems: map[string][]types.WriteRequest{
				db.tableName: writeRequests,
			},
		})
		if err != nil {
			return fmt.Errorf("failed to batch write items: %w", err)
		}
	}

	return nil
}

func main() {
	// Initialize DynamoDB client
	dbClient, err := NewDynamoDBClient("us-west-2", "Users")
	if err != nil {
		log.Fatalf("Failed to create DynamoDB client: %v", err)
	}

	ctx := context.TODO()

	// Example 1: Put a new user
	user := User{
		UserID: "user123",
		Name:   "John Doe",
		Email:  "john@example.com",
		Age:    30,
		Active: true,
	}

	if err := dbClient.PutUser(ctx, user); err != nil {
		log.Printf("Failed to put user: %v", err)
	} else {
		fmt.Println("✅ User inserted successfully")
	}

	// Example 2: Get the user
	retrievedUser, err := dbClient.GetUser(ctx, "user123")
	if err != nil {
		log.Printf("Failed to get user: %v", err)
	} else {
		fmt.Printf("✅ Retrieved user: %+v\n", retrievedUser)
	}

	// Example 3: Update user
	if err := dbClient.UpdateUser(ctx, "user123", "john.doe@example.com", 31); err != nil {
		log.Printf("Failed to update user: %v", err)
	} else {
		fmt.Println("✅ User updated successfully")
	}

	// Example 4: Query active users
	activeUsers, err := dbClient.QueryActiveUsers(ctx)
	if err != nil {
		log.Printf("Failed to query active users: %v", err)
	} else {
		fmt.Printf("✅ Found %d active users\n", len(activeUsers))
	}

	// Example 5: Batch insert users
	batchUsers := []User{
		{UserID: "user001", Name: "Alice", Email: "alice@example.com", Age: 25, Active: true},
		{UserID: "user002", Name: "Bob", Email: "bob@example.com", Age: 28, Active: true},
		{UserID: "user003", Name: "Charlie", Email: "charlie@example.com", Age: 35, Active: false},
	}

	if err := dbClient.BatchPutUsers(ctx, batchUsers); err != nil {
		log.Printf("Failed to batch insert users: %v", err)
	} else {
		fmt.Println("✅ Batch insert successful")
	}

	// Example 6: Delete user
	if err := dbClient.DeleteUser(ctx, "user123"); err != nil {
		log.Printf("Failed to delete user: %v", err)
	} else {
		fmt.Println("✅ User deleted successfully")
	}
}
