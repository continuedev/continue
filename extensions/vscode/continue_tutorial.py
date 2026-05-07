import pygame
import sys
import random

# Initialize Pygame
pygame.init()

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GREEN = (0, 255, 0)

# Screen dimensions
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600

# Paddle settings
PADDLE_WIDTH = 15
PADDLE_HEIGHT = 100
PADDLE_SPEED = 7

# Ball settings
BALL_SIZE = 20
BALL_SPEED_X = 6
BALL_SPEED_Y = 6

# Setup screen
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Pong")
clock = pygame.time.Clock()

# Paddle classes
class Paddle(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.image = pygame.Surface([PADDLE_WIDTH, PADDLE_HEIGHT])
        self.image.fill(WHITE)
        self.rect = self.image.get_rect()
        self.rect.x = x
        self.rect.y = y

    def move_up(self):
        self.rect.y -= PADDLE_SPEED
        if self.rect.top < 0:
            self.rect.top = 0

    def move_down(self):
        self.rect.y += PADDLE_SPEED
        if self.rect.bottom > SCREEN_HEIGHT:
            self.rect.bottom = SCREEN_HEIGHT

# Ball class
class Ball(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        self.image = pygame.Surface([BALL_SIZE, BALL_SIZE])
        self.image.fill(GREEN)
        self.rect = self.image.get_rect()
        self.rect.centerx = SCREEN_WIDTH // 2
        self.rect.centery = SCREEN_HEIGHT // 2
        self.speed_x = BALL_SPEED_X
        self.speed_y = BALL_SPEED_Y

    def update(self):
        self.rect.x += self.speed_x
        self.rect.y += self.speed_y

        # Bounce off top and bottom
        if self.rect.top < 0 or self.rect.bottom > SCREEN_HEIGHT:
            self.speed_y = -self.speed_y

        # Bounce off paddles
        if pygame.sprite.collide_rect(self, player1) or pygame.sprite.collide_rect(self, player2):
            self.speed_x = -self.speed_x
            # Ensure ball doesn't get stuck in paddle
            if self.speed_x > 0:
                self.rect.left = player2.rect.right
            else:
                self.rect.right = player1.rect.left

    def reset(self):
        self.rect.centerx = SCREEN_WIDTH // 2
        self.rect.centery = SCREEN_HEIGHT // 2
        # Randomize direction
        direction_x = random.choice([-1, 1])
        direction_y = random.choice([-1, 1])
        self.speed_x = BALL_SPEED_X * direction_x
        self.speed_y = BALL_SPEED_Y * direction_y

# Create paddles
player1 = Paddle(50, SCREEN_HEIGHT // 2 - PADDLE_HEIGHT // 2)
player2 = Paddle(SCREEN_WIDTH - 50 - PADDLE_WIDTH, SCREEN_HEIGHT // 2 - PADDLE_HEIGHT // 2)
ball = Ball()

# Score tracking
font = pygame.font.Font(None, 36)
score1 = 0
score2 = 0

running = True
while running:
    # Event handling
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_r:
                # Reset game
                score1 = 0
                score2 = 0
                ball.reset()

    # Input handling
    keys = pygame.key.get_pressed()
    if keys[pygame.K_w]:
        player1.move_up()
    if keys[pygame.K_s]:
        player1.move_down()
    if keys[pygame.K_UP]:
        player2.move_up()
    if keys[pygame.K_DOWN]:
        player2.move_down()

    # Game logic
    ball.update()

    # Scoring
    if ball.rect.left < 0:
        score2 += 1
        ball.reset()
    if ball.rect.right > SCREEN_WIDTH:
        score1 += 1
        ball.reset()

    # Drawing
    screen.fill(BLACK)
    
    # Draw midline
    pygame.draw.aaline(screen, WHITE, (SCREEN_WIDTH // 2, 0), (SCREEN_WIDTH // 2, SCREEN_HEIGHT))
    
    player1.draw(screen)
    player2.draw(screen)
    ball.draw(screen)
    
    # Draw scores
    text1 = font.render(str(score1), True, WHITE)
    text2 = font.render(str(score2), True, WHITE)
    screen.blit(text1, (SCREEN_WIDTH // 4, 50))
    screen.blit(text2, (SCREEN_WIDTH * 3 // 4, 50))
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
sys.exit()
