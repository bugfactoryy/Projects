#include "raylib.h"
#include <vector>
#include <cmath>

using namespace std;

// Game constants
const int SCREEN_WIDTH = 1000;
const int SCREEN_HEIGHT = 700;
const float GRAVITY = 1500.0f;
const float JUMP_FORCE = -650.0f;
const float PLAYER_SPEED = 350.0f;

// Game objects
class GameObject {
public:
    Rectangle rect;
    Color color;
    bool isDeadly;
    
    GameObject(float x, float y, float width, float height, Color col, bool deadly = false) 
        : rect{x, y, width, height}, color(col), isDeadly(deadly) {}
    
    virtual ~GameObject() {}  // Virtual destructor for proper cleanup
    
    virtual void Update(float deltaTime) {}
    virtual void Draw() {
        DrawRectangleRec(rect, color);
    }
    
    // Added Reset method for game objects
    virtual void Reset() {}
};

class Player : public GameObject {
public:
    Vector2 velocity;
    bool isGrounded;
    bool isAlive;
    bool hasWon;
    float jumpBuffer;
    float coyoteTime;
    bool facingRight;
    bool deathCounted; // Track if death has been counted
    
    Player(float x, float y) 
        : GameObject(x, y, 35, 50, SKYBLUE), 
          velocity{0, 0}, 
          isGrounded(false),
          isAlive(true),
          hasWon(false),
          jumpBuffer(0),
          coyoteTime(0),
          facingRight(true),
          deathCounted(false) {}
    
    void Update(float deltaTime) override {
        if (!isAlive || hasWon) return;
        
        // Apply gravity
        velocity.y += GRAVITY * deltaTime;
        
        // Horizontal movement with acceleration
        float targetVelocity = 0;
        if (IsKeyDown(KEY_RIGHT)) {
            targetVelocity = PLAYER_SPEED;
            facingRight = true;
        } else if (IsKeyDown(KEY_LEFT)) {
            targetVelocity = -PLAYER_SPEED;
            facingRight = false;
        }
        
        // Smooth acceleration
        velocity.x = velocity.x + (targetVelocity - velocity.x) * 10 * deltaTime;
        
        // Apply velocity
        rect.x += velocity.x * deltaTime;
        rect.y += velocity.y * deltaTime;
        
        // Screen boundaries
        if (rect.x < 0) rect.x = 0;
        if (rect.x > SCREEN_WIDTH - rect.width) rect.x = SCREEN_WIDTH - rect.width;
        if (rect.y > SCREEN_HEIGHT) Die();
        
        // Coyote time
        if (isGrounded) {
            coyoteTime = 0.15f;
        } else {
            coyoteTime -= deltaTime;
        }
        
        // Jump buffer
        if (IsKeyPressed(KEY_SPACE)) {
            jumpBuffer = 0.1f;
        } else {
            jumpBuffer -= deltaTime;
        }
        
        // Perform jump if conditions met
        if (jumpBuffer > 0 && coyoteTime > 0) {
            velocity.y = JUMP_FORCE;
            isGrounded = false;
            coyoteTime = 0;
            jumpBuffer = 0;
        }
    }
    
    void Die() {
        isAlive = false;
        velocity = {0, 0};
    }
    
    void Reset() override {
        rect.x = 80;
        rect.y = 450;
        velocity = {0, 0};
        isGrounded = false;
        isAlive = true;
        hasWon = false;
        facingRight = true;
        deathCounted = false; // Reset death counter flag
    }
    
    void Draw() override {
        // Draw player body
        Color outline = facingRight ? BLUE : RED;
        DrawRectangleRec(rect, color);
        DrawRectangleLinesEx(rect, 2, outline);
        
        // Draw eyes
        int eyeDirection = facingRight ? 1 : -1;
        DrawCircle(rect.x + rect.width/2 + eyeDirection*8, rect.y + rect.height/3, 5, DARKBLUE);
        
        // Draw hat (Mario-style)
        DrawRectangle(rect.x-5, rect.y-10, rect.width+10, 10, RED);
    }
};

class Platform : public GameObject {
public:
    bool isPermanent;
    
    Platform(float x, float y, float w, float h, Color col, bool permanent = true)
        : GameObject(x, y, w, h, col, false), isPermanent(permanent) {}
    
    void Draw() override {
        // Draw platform with outline
        DrawRectangleRec(rect, color);
        DrawRectangleLinesEx(rect, 2, ColorAlpha(DARKBROWN, 0.7f));
        
        // Platform pattern
        for (int i = 0; i < rect.width; i += 20) {
            DrawLine(rect.x + i, rect.y, rect.x + i, rect.y + rect.height, ColorAlpha(DARKBROWN, 0.5f));
        }
    }
};

class MovingPlatform : public Platform {
public:
    float startY, endY;
    float moveSpeed;
    float moveTimer;
    bool movingUp;
    
    MovingPlatform(float x, float y, float w, float h, Color col, float range, bool movesUp, bool deadly = false)
        : Platform(x, y, w, h, col, false),
          startY(y),
          endY(movesUp ? y - range : y + range),
          moveSpeed(1.0f),
          moveTimer(0),
          movingUp(movesUp) {
        isDeadly = deadly;
    }
    
    void Update(float deltaTime) override {
        moveTimer += deltaTime;
        
        // Move continuously without resetting timer
        float progress = fmod(moveTimer, 5.0f) / 5.0f;
        
        if (movingUp) {
            rect.y = endY + (startY - endY) * (1 - progress);
        } else {
            rect.y = startY + (endY - startY) * progress;
        }
    }
    
    // Reset platform to initial position
    void Reset() override {
        rect.y = startY;
        moveTimer = 0.0f;
    }
    
    void Draw() override {
        // Draw deadly platform with spikes
        if (isDeadly) {
            Color platColor = movingUp ? Color{220, 20, 20, 255} : Color{180, 20, 20, 255};
            DrawRectangleRec(rect, platColor);
            
            // Draw spikes on top
            int spikeCount = rect.width / 15;
            for (int i = 0; i < spikeCount; i++) {
                DrawTriangle(
                    {rect.x + i*15 + 7.5f, rect.y},
                    {rect.x + i*15, rect.y + 15},
                    {rect.x + i*15 + 15, rect.y + 15},
                    Color{255, 50, 50, 255}
                );
            }
        } else {
            Platform::Draw();
            // Draw movement direction indicator
            Color arrowColor = movingUp ? GREEN : RED;
            DrawTriangle(
                {rect.x + rect.width/2, rect.y - 15},
                {rect.x + rect.width/2 - 10, rect.y - 5},
                {rect.x + rect.width/2 + 10, rect.y - 5},
                arrowColor
            );
        }
    }
};

class Spikes : public GameObject {
public:
    Spikes(float x, float y, float width) 
        : GameObject(x, y, width, 30, RED, true) {}
    
    void Draw() override {
        // Draw spike triangles
        int spikeCount = rect.width / 20;
        for (int i = 0; i < spikeCount; i++) {
            DrawTriangle(
                {rect.x + i*20 + 10, rect.y},
                {rect.x + i*20, rect.y + rect.height},
                {rect.x + i*20 + 20, rect.y + rect.height},
                Color{200, 30, 30, 255}
            );
        }
        
        // Draw blood stains
        for (int i = 0; i < spikeCount; i += 2) {
            DrawCircle(rect.x + i*20 + 10, rect.y + rect.height + 5, 3, MAROON);
        }
    }
};

class FinishLine : public GameObject {
public:
    FinishLine(float x, float y) 
        : GameObject(x, y, 30, 100, LIME) {}
    
    void Draw() override {
        DrawRectangleRec(rect, color);
        // Draw flag
        DrawRectangle(rect.x + rect.width, rect.y, 40, 30, GOLD);
        DrawTriangle(
            {rect.x + rect.width, rect.y},
            {rect.x + rect.width, rect.y + 30},
            {rect.x + rect.width + 40, rect.y + 15},
            RED
        );
        
        // Draw pole stripes
        for (int i = 0; i < rect.height; i += 10) {
            DrawRectangle(rect.x, rect.y + i, rect.width, 5, DARKGRAY);
        }
    }
};

int main() {
    // Initialize window
    InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "DIE AGAIN: Platform Peril");
    SetTargetFPS(60);
    
    // Create game objects
    Player player(80, 450);
    
    vector<GameObject*> gameObjects;
    vector<MovingPlatform*> movingPlatforms;  // New vector to track moving platforms
    
    // Fixed platforms (brown) - arranged in challenging pattern
    Platform* p1 = new Platform(0, 550, 150, 50, BROWN);
    Platform* p2 = new Platform(250, 550, 100, 50, BROWN);
    Platform* p3 = new Platform(450, 500, 100, 50, BROWN);
    Platform* p4 = new Platform(650, 450, 100, 50, BROWN);
    Platform* p5 = new Platform(850, 400, 150, 50, BROWN);
    
    // First movable platform - deadly with spikes
    MovingPlatform* mp1 = new MovingPlatform(0, 300, 150, 50, PURPLE, 200, false, true);
    
    // Second movable platform - deadly with spikes, now touches permanent box
    MovingPlatform* mp2 = new MovingPlatform(250, 500, 100, 50, PURPLE, 200, true, true);
    
    // Third movable platform - deadly spikes, goes under fixed box
    MovingPlatform* mp3 = new MovingPlatform(650, 300, 100, 50, PURPLE, 300, false, true);
    
    // Spikes positioned under gaps
    Spikes* spikes1 = new Spikes(150, 600, 100);
    Spikes* spikes2 = new Spikes(350, 600, 100);
    Spikes* spikes3 = new Spikes(550, 600, 100);
    Spikes* spikes4 = new Spikes(750, 600, 100);
    
    // Finish line
    FinishLine* finish = new FinishLine(900, 300);
    
    // Add to collections
    gameObjects.push_back(p1);
    gameObjects.push_back(p2);
    gameObjects.push_back(p3);
    gameObjects.push_back(p4);
    gameObjects.push_back(p5);
    gameObjects.push_back(mp1);
    gameObjects.push_back(mp2);
    gameObjects.push_back(mp3);
    gameObjects.push_back(spikes1);
    gameObjects.push_back(spikes2);
    gameObjects.push_back(spikes3);
    gameObjects.push_back(spikes4);
    gameObjects.push_back(finish);
    
    // Add moving platforms to special vector
    movingPlatforms.push_back(mp1);
    movingPlatforms.push_back(mp2);
    movingPlatforms.push_back(mp3);
    
    // Game state
    int deaths = 0;
    bool showTimer = true;
    float gameTime = 0;
    
    // Main game loop
    while (!WindowShouldClose()) {
        float deltaTime = GetFrameTime();
        gameTime += deltaTime;
        
        // Reset game
        if ((!player.isAlive || player.hasWon) && IsKeyPressed(KEY_R)) {
            player.Reset();
            
            // Reset all moving platforms to their starting positions
            for (MovingPlatform* mp : movingPlatforms) {
                mp->Reset();
            }
            
            deaths = player.hasWon ? 0 : deaths;
            player.hasWon = false;
            gameTime = 0;
        }
        
        // Update objects
        if (player.isAlive && !player.hasWon) {
            player.Update(deltaTime);
            for (MovingPlatform* mp : movingPlatforms) {
                mp->Update(deltaTime);
            }
        }
        
        // Check collisions
        player.isGrounded = false;
        
        for (GameObject* obj : gameObjects) {
            Platform* platform = dynamic_cast<Platform*>(obj);
            if (platform && CheckCollisionRecs(player.rect, platform->rect)) {
                // Platform collision from top (safe platforms)
                if (!platform->isDeadly && player.velocity.y > 0 && 
                    player.rect.y + player.rect.height <= platform->rect.y + 15) {
                    player.rect.y = platform->rect.y - player.rect.height;
                    player.velocity.y = 0;
                    player.isGrounded = true;
                }
                // Deadly platform collision (any contact)
                else if (platform->isDeadly) {
                    // Only count death once per death event
                    if (player.isAlive) {
                        player.Die();
                        deaths++;
                        player.deathCounted = true;
                    }
                }
            }
        }
        
        // Check spike collision
        for (GameObject* obj : gameObjects) {
            if (obj->isDeadly && CheckCollisionRecs(player.rect, obj->rect)) {
                // Only count death once per death event
                if (player.isAlive) {
                    player.Die();
                    deaths++;
                    player.deathCounted = true;
                    break;
                }
            }
        }
        
        // Check finish line collision
        if (CheckCollisionRecs(player.rect, finish->rect)) {
            player.hasWon = true;
        }
        
        // Draw everything
        BeginDrawing();
        ClearBackground(RAYWHITE);
        
        // Draw sky background
        DrawRectangleGradientV(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 
                              SKYBLUE, Color{25, 25, 112, 255});
        
        // Draw simple clouds
        for (int i = 0; i < 5; i++) {
            float x1 = 200 + fmod(gameTime * 20 + i*150, SCREEN_WIDTH);
            float x2 = 600 + fmod(gameTime * 30 + i*200, SCREEN_WIDTH);
            
            DrawCircle(x1, 80 + i*30, 30, WHITE);
            DrawCircle(x1 + 20, 70 + i*30, 40, WHITE);
            DrawCircle(x2, 120 + i*40, 50, WHITE);
            DrawCircle(x2 + 30, 110 + i*40, 60, WHITE);
        }
        
        // Draw game objects
        for (GameObject* obj : gameObjects) {
            obj->Draw();
        }
        player.Draw();
        
        // Draw UI
        DrawRectangle(10, 10, 200, 80, ColorAlpha(BLACK, 0.5f));
        DrawText(TextFormat("Deaths: %d", deaths), 20, 20, 30, RED);
        
        if (showTimer) {
            DrawText(TextFormat("Time: %.1f", gameTime), 20, 60, 30, GREEN);
        }
        
        // Movement instructions
        DrawText("Controls: Arrow Keys to Move, SPACE to Jump", 
                SCREEN_WIDTH/2 - 250, SCREEN_HEIGHT - 30, 20, YELLOW);
        
        // Game state messages
        if (!player.isAlive) {
            DrawRectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, Fade(RED, 0.3f));
            DrawText("YOU DIED!", SCREEN_WIDTH/2 - 120, SCREEN_HEIGHT/2 - 50, 70, RED);
            DrawText("Press R to Restart", SCREEN_WIDTH/2 - 150, SCREEN_HEIGHT/2 + 50, 40, WHITE);
            
            // Draw death message
            const char* messages[] = {
                "DIE AGAIN!",
                "PERISH!",
                "FAILURE!",
                "TRY HARDER!",
                "GIT GUD!"
            };
            int msgIndex = deaths % 5;
            DrawText(messages[msgIndex], SCREEN_WIDTH/2 - 100, SCREEN_HEIGHT/2 + 120, 40, ORANGE);
        }
        
        if (player.hasWon) {
            DrawRectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, Fade(GREEN, 0.3f));
            DrawText("VICTORY!", SCREEN_WIDTH/2 - 120, SCREEN_HEIGHT/2 - 50, 70, GOLD);
            DrawText(TextFormat("Deaths: %d  Time: %.1fs", deaths, gameTime), 
                    SCREEN_WIDTH/2 - 180, SCREEN_HEIGHT/2 + 50, 40, WHITE);
            DrawText("Press R to Play Again", SCREEN_WIDTH/2 - 180, SCREEN_HEIGHT/2 + 120, 40, WHITE);
            
            // Draw fireworks
            for (int i = 0; i < 10; i++) {
                Color fireColor = GetColor(0xE25822FF); // Flame color
                float offset = sin(gameTime * 5 + i) * 50;
                DrawCircle(100 + i*100, 200 + offset, 15, fireColor);
                DrawCircle(80 + i*100, 180 + offset, 10, YELLOW);
            }
        }
        
        // Draw level number
        DrawText("Level 1: Crushing Descent", 20, SCREEN_HEIGHT - 50, 25, GOLD);
        
        EndDrawing();
    }  // End of while loop
    
    // Cleanup
    for (GameObject* obj : gameObjects) {
        delete obj;
    }
    
    CloseWindow();
    return 0;
}  // End of main